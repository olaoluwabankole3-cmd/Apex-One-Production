/**
 * CORTEX financial-source custody foundation: INTERNAL-ONLY.
 *
 * Staff may configure a source definition, a DIFFERENT active administrator
 * approves it, and a trusted internal test harness stages bounded CSV bytes in
 * encrypted S3. All source/bank-origin, retention, coverage and loss claims
 * remain FALSE. This module MUST NOT be exposed directly as an upload route.
 *
 * S3 and PostgreSQL are not a single transaction. Unexpected DB failure can
 * leave an orphan encrypted blob; it never creates an authorized source. A
 * future recovery sweeper must reconcile those orphans under retention policy.
 */
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "../../core/errors";
import { ConflictError, CrossTenantViolationError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { getPermissionsForRole, requirePermission } from "../../core/security";
import { DatabaseStore } from "../../database/store";
import type {
  FinancialSourceRegistryRecord, FinancialSourceSnapshotRecord
} from "../../database/schema";
import type { IObjectStorageService } from "../documents/documentStorage";
import { S3CompatibleObjectStorageService } from "../documents/documentStorage";
import {
  financialSourceSnapshotKey, reconcilePinnedFinancialSourceSnapshots,
  type FinancialStoredSourceReadResult
} from "./financialSourceIntegrityGate";
import { validateFinancialCsvForInternalIntake } from "./csvPreviewService";
import {
  pinFinancialSigner, verifyFinancialManifestSignature,
  checkFinancialSnapshotObjectLock,
  type SignedFinancialSourceManifest,
  type FinancialSignerInput,
  type ManifestCryptographicCheck,
  type VersionRetentionCheck,
} from "./financialSourceProvenanceGate";

const MAX_BYTES = 128 * 1024;
const SOURCE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const CUSTODY_MIME = "text/csv";

type Kind = FinancialSourceRegistryRecord["kind"];
type Role = FinancialSourceRegistryRecord["role"];

function gateIntake(): void {
  // A mistakenly enabled test flag may never bypass the production NO-GO.
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new NotFoundError("Internal financial source intake");
  }
  if (process.env.TEST_ENV === "true") return;
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging" ||
      process.env.CORTEX_INTERNAL_FINANCIAL_SOURCE_INTAKE_ENABLED !== "true") {
    throw new NotFoundError("Internal financial source intake");
  }
}

function authorized(ctx: TenantContext, db: DatabaseStore, permission: "org:admin" | "financial:read" | "financial:write") {
  requirePermission(ctx, permission);
  // The wire-level PostgreSQL adapter uses one connection per transaction.
  // Do not issue two queries to that connection concurrently: the wire
  // protocol reader is sequential and simultaneous queries can deadlock it.
  return (async () => {
    const membership = await db.findUserMembership(ctx.userId, ctx.organizationId);
    const user = await db.findUserById(ctx.userId);
    if (!membership || !user || user.status !== "active" ||
        membership.role !== ctx.userRole ||
        !getPermissionsForRole(membership.role).includes(permission)) {
      throw new ForbiddenError("Current institution membership does not allow financial source custody actions");
    }
  })();
}

function safeByteBuffer(input: Buffer): Buffer {
  if (!Buffer.isBuffer(input) || input.byteLength === 0 || input.byteLength > MAX_BYTES) {
    throw new ValidationError("Financial source CSV must contain 1 to 131072 bytes");
  }
  return Buffer.from(input);
}

function safeRead(data: Buffer | string): Buffer {
  return Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data, "utf8");
}

function matchDigest(data: Buffer, expectedHex: string): boolean {
  const digest = createHash("sha256").update(data).digest();
  const expected = Buffer.from(expectedHex, "hex");
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

async function scopedFind<T extends { id: string; organizationId: string }>(
  repo: { findById(id: string, ctx: TenantContext, resourceName?: string): Promise<T> },
  ctx: TenantContext, id: string, name: string
): Promise<T> {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{4,90}$/.test(id)) throw new ValidationError("Invalid internal record identifier");
  try {
    return await repo.findById(id, ctx, name);
  } catch (error) {
    if (error instanceof CrossTenantViolationError) throw new NotFoundError(name);
    throw error;
  }
}

function audit(ctx: TenantContext, action: string, id: string, metadata: Record<string, unknown>) {
  return {
    organizationId: ctx.organizationId,
    actorId: ctx.userId, actorEmail: ctx.userEmail, action,
    resource: "FinancialSourceIntake",
    resourceId: id,
    requestId: ctx.requestId, status: "success" as const,
    timestamp: new Date().toISOString(),
    metadata: { sourceAuthenticityVerified: false,
      storageImmutabilityVerified: false, coverageVerified: false,
      financialLossAssessed: false, ...metadata },
  };
}

export class FinancialSourceIntakeService {
  constructor(
    private readonly db: DatabaseStore,
    private readonly storage: IObjectStorageService
  ) {}

  /** Register a source definition, NOT an authenticated bank connector. */
  public async proposeSource(ctx: TenantContext, input: {
    sourceLabel: string; kind: Kind; role: Role;
    signingKey?: FinancialSignerInput;
  }): Promise<FinancialSourceRegistryRecord> {
    gateIntake();
    await authorized(ctx, this.db, "org:admin");
    const label = input?.sourceLabel;
    if (typeof label !== "string" || !SOURCE_LABEL.test(label)) {
      throw new ValidationError("Source label must be a safe opaque identifier");
    }
    if (!["settlement", "fee"].includes(input.kind) ||
        !["expected", "observed"].includes(input.role)) {
      throw new ValidationError("Source kind or role is not supported");
    }
    const signingKey = input.signingKey === undefined ? undefined : pinFinancialSigner(input.signingKey);
    return this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "org:admin");
      const now = new Date().toISOString();
      const record = await this.db.financialSourceRegistryRepo.create({
        id: randomUUID(), sourceLabel: label,
        kind: input.kind, role: input.role,
        status: "pending", createdByUserId: ctx.userId,
        createdAt: now, revision: 1, updatedAt: now,
        externalSourceAuthorityVerified: false,
        ...(signingKey ? { signingKey } : {}),
      }, ctx);
      await this.db.recordAuditLog(audit(ctx, "financial_source:proposed", record.id, {
        kind: record.kind, role: record.role, revision: record.revision,
        ...(signingKey ? { signerKeyId: signingKey.keyId, signerFingerprint: signingKey.keyFingerprintSha256 } : {}),
      }));
      return record;
    });
  }

  /** Independent second active admin approves or rejects synthetic intake. */
  public async decideSource(ctx: TenantContext, input: {
    registryId: string; expectedRevision: number;
    verdict: "approved" | "rejected"; reason: string;
  }): Promise<FinancialSourceRegistryRecord> {
    gateIntake();
    await authorized(ctx, this.db, "org:admin");
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== 1 ||
        !["approved", "rejected"].includes(input.verdict) ||
        typeof input.reason !== "string" ||
        input.reason.length < 12 || input.reason.length > 400) {
      throw new ValidationError("Invalid independent source review decision");
    }
    return this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "org:admin");
      const before = await scopedFind(this.db.financialSourceRegistryRepo, ctx, input.registryId, "FinancialSourceRegistry");
      if (before.status !== "pending" || before.revision !== input.expectedRevision) {
        throw new ConflictError("Source proposal changed or was already reviewed");
      }
      if (before.createdByUserId === ctx.userId) {
        throw new ForbiddenError("Source proposer may not approve or reject their own source definition");
      }
      const now = new Date().toISOString();
      const updated = await this.db.decideFinancialSourceRegistry(ctx, before.id, input.expectedRevision, {
        status: input.verdict, reviewedByUserId: ctx.userId,
        reviewedAt: now, reviewReason: input.reason, revision: 2, updatedAt: now,
      });
      await this.db.recordAuditLog(audit(ctx, "financial_source:reviewed", before.id, {
        verdict: input.verdict, reviewerId: ctx.userId,
        proposedById: before.createdByUserId, revision: 2,
      }));
      return updated;
    });
  }

  /**
   * An emergency source signing-key revoke is effective IMMEDIATELY.
   * Cannot be undone by changing a status; new keys require a new registry
   * and independent review. All already committed snapshots remain auditable.
   */
  public async revokeSource(ctx:TenantContext,input:{
    registryId:string;expectedRevision:number;reason:string;
  }):Promise<FinancialSourceRegistryRecord>{
    gateIntake();await authorized(ctx,this.db,"org:admin");
    if(!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision<2 ||
       typeof input.reason!=="string" || input.reason.length<12 || input.reason.length>400) {
      throw new ValidationError("Invalid emergency source revocation");
    }
    return this.db.runInTransaction(ctx,async()=>{
      await authorized(ctx,this.db,"org:admin");
      const current=await scopedFind(this.db.financialSourceRegistryRepo,ctx,input.registryId,"FinancialSourceRegistry");
      if(current.status!=="approved" || current.revision!==input.expectedRevision)
        throw new ConflictError("Source already revoked or revision changed");
      const revoked=await this.db.revokeFinancialSourceRegistry(ctx,current.id,input.expectedRevision,ctx.userId,input.reason);
      await this.db.recordAuditLog(audit(ctx,"financial_source:signer_revoked",current.id,{
        revision:revoked.revision,revokedByUserId:ctx.userId,reason:input.reason,
        fingerprintSha256:current.signingKey?.keyFingerprintSha256??null,
        previouslySignedRecordsRemainUnverified:true,
      }));
      return revoked;
    });
  }

  /**
   * Trusted SERVER-SIDE synthetic handoff. No HTTP upload endpoint.
   * Exact raw bytes and SHA are derived here, never accepted as browser claims.
   */
  public async ingestInternalSnapshot(ctx: TenantContext, input: {
    registryId: string; csvBytes: Buffer;
  }): Promise<FinancialSourceSnapshotRecord> {
    gateIntake();
    await authorized(ctx, this.db, "financial:read");
    await authorized(ctx, this.db, "financial:write");
    if (process.env.TEST_ENV !== "true" &&
        !(this.storage instanceof S3CompatibleObjectStorageService)) {
      throw new ForbiddenError("Internal financial intake requires encrypted S3-compatible storage");
    }
    const policy = await scopedFind(this.db.financialSourceRegistryRepo, ctx, input.registryId, "FinancialSourceRegistry");
    if (policy.status !== "approved") throw new ConflictError("Financial source definition has no independent approval");

    const bytes = safeByteBuffer(input.csvBytes);
    let csv: string;
    try {
      csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ValidationError("Financial source CSV is not valid UTF-8");
    }
    const sourceId = "snapshot-" + randomUUID().replace(/-/g, "");
    const validated = validateFinancialCsvForInternalIntake(ctx, policy.kind, policy.role, {
      feedId: sourceId, csv,
    });
    const descriptor = {
      sourceId, expectedSha256: validated.sha256, expectedBytes: bytes.length,
    };
    const key = financialSourceSnapshotKey(ctx.organizationId, descriptor);
    const stored = await this.storage.putObject(key, bytes, CUSTODY_MIME);
    if (stored.bytes !== bytes.length || stored.checksumSha256 !== validated.sha256 ||
        (process.env.TEST_ENV !== "true" && stored.encryption !== "AES-256-GCM")) {
      throw new ValidationError("Stored financial source receipt does not match pinned bytes");
    }
    const reread = await this.storage.getObject(key);
    if (!reread || reread.mimeType !== CUSTODY_MIME ||
        safeRead(reread.data).length !== bytes.length ||
        !matchDigest(safeRead(reread.data), validated.sha256)) {
      throw new ValidationError("Post-write financial source integrity verification failed");
    }

    // No raw bytes, transaction identifiers, amounts, or source records enter
    // PostgreSQL or the audit trail. If DB write fails, an orphan encrypted
    // object remains for a future bounded retention sweeper.
    return this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "financial:write");
      const latest = await scopedFind(this.db.financialSourceRegistryRepo, ctx, policy.id, "FinancialSourceRegistry");
      if (latest.status !== "approved") throw new ConflictError("Source approval no longer active");
      const record = await this.db.financialSourceSnapshotsRepo.create({
        id: randomUUID(), sourceRegistryId: policy.id, kind: policy.kind,
        role: policy.role, sourceId, expectedSha256: validated.sha256,
        expectedBytes: bytes.length, rowCount: validated.rows,
        recordedByUserId: ctx.userId, createdAt: new Date().toISOString(),
        encryption: stored.encryption,
        byteIntegrityCheckedAtIntake: true,
        ...(stored.versionId ? { storageVersionId: stored.versionId } : {}),
        storageImmutabilityVerified: false,
        sourceAuthenticityVerified: false,
        coverageVerified: false,
        financialLossAssessed: false,
      }, ctx);
      await this.db.recordAuditLog(audit(ctx, "financial_source:snapshot_ingested", record.id, {
        sourceRegistryId: policy.id, kind: policy.kind, role: policy.role,
        sourceId, sha256: validated.sha256, bytes: bytes.length,
        rowCount: validated.rows, encryption: stored.encryption,
      }));
      return record;
    });
  }

  /**
   * Signature validity is key-matching only. The pinned public key was
   * reviewed by two local administrators; it is NOT independently attested as
   * owned by the purported bank or payment processor.
   */
  public async checkSnapshotManifestSignature(ctx: TenantContext, input: {
    snapshotId: string;
    manifest: SignedFinancialSourceManifest;
    signatureBase64: string;
  }): Promise<ManifestCryptographicCheck> {
    gateIntake();
    await authorized(ctx, this.db, "financial:read");
    const snapshot = await scopedFind(this.db.financialSourceSnapshotsRepo, ctx, input.snapshotId, "FinancialSourceSnapshot");
    const registry = await scopedFind(this.db.financialSourceRegistryRepo, ctx, snapshot.sourceRegistryId, "FinancialSourceRegistry");
    const result = verifyFinancialManifestSignature(
      input.manifest, input.signatureBase64, registry, snapshot
    );
    await this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "financial:read");
      await this.db.recordAuditLog(audit(ctx, "financial_source:manifest_signature_checked", snapshot.id, {
        sourceRegistryId: registry.id, signerKeyId: result.signerKeyId,
        signerKeyFingerprint: result.signerKeyFingerprintSha256,
        manifestFingerprint: result.manifestFingerprintSha256,
        bankKeyOwnershipIndependentlyVerified: false,
      }));
    });
    return result;
  }

  /**
   * Version-specific S3 COMPLIANCE headers are an OBSERVATION, not a guarantee
   * that the bank's retention policy is satisfied. The version must have been
   * returned by S3 itself at intake; no unversioned/latest key is accepted.
   */
  public async checkSnapshotRetention(ctx: TenantContext, snapshotId: string): Promise<VersionRetentionCheck> {
    gateIntake();
    await authorized(ctx, this.db, "financial:read");
    if (!(this.storage instanceof S3CompatibleObjectStorageService)) {
      throw new ConflictError("S3 version-specific retention inspection requires the encrypted S3 adapter");
    }
    const snapshot = await scopedFind(this.db.financialSourceSnapshotsRepo, ctx, snapshotId, "FinancialSourceSnapshot");
    const result = await checkFinancialSnapshotObjectLock(ctx.organizationId, snapshot, this.storage);
    await this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "financial:read");
      await this.db.recordAuditLog(audit(ctx, "financial_source:retention_observed", snapshot.id, {
        s3VersionId: result.s3VersionId, retainUntil: result.retainUntil,
        complianceModeObserved: true, bankRetentionPolicyVerified: false,
      }));
    });
    return result;
  }

  /** Authorized, read-only preview of TWO independently approved sources. */
  public async previewPair(ctx: TenantContext, input: {
    expectedSnapshotId: string; observedSnapshotId: string;
  }): Promise<FinancialStoredSourceReadResult> {
    gateIntake();
    await authorized(ctx, this.db, "financial:read");
    await authorized(ctx, this.db, "financial:write");
    if (input.expectedSnapshotId === input.observedSnapshotId) {
      throw new ValidationError("Two different source snapshots are required");
    }
    const expected = await scopedFind(this.db.financialSourceSnapshotsRepo, ctx, input.expectedSnapshotId, "FinancialSourceSnapshot");
    const observed = await scopedFind(this.db.financialSourceSnapshotsRepo, ctx, input.observedSnapshotId, "FinancialSourceSnapshot");
    if (expected.role !== "expected" || observed.role !== "observed" ||
        expected.kind !== observed.kind ||
        expected.sourceId === observed.sourceId) {
      throw new ValidationError("Financial preview pair has incompatible source roles or kind");
    }
    for (const entry of [expected, observed]) {
      const source = await scopedFind(this.db.financialSourceRegistryRepo, ctx, entry.sourceRegistryId, "FinancialSourceRegistry");
      if (source.status !== "approved" || source.kind !== entry.kind || source.role !== entry.role) {
        throw new ConflictError("Financial preview source registration is no longer approved or mismatched");
      }
    }
    const result = await reconcilePinnedFinancialSourceSnapshots(ctx, {
      kind: expected.kind,
      expected: { sourceId: expected.sourceId,
        expectedSha256: expected.expectedSha256, expectedBytes: expected.expectedBytes },
      observed: { sourceId: observed.sourceId,
        expectedSha256: observed.expectedSha256, expectedBytes: observed.expectedBytes },
    }, this.storage);
    await this.db.runInTransaction(ctx, async () => {
      await authorized(ctx, this.db, "financial:read");
      await this.db.recordAuditLog(audit(ctx, "financial_source:pair_previewed", expected.id, {
        expectedSnapshotId: expected.id, observedSnapshotId: observed.id,
        kind: expected.kind, candidateCount: result.preview.reconciliation.cases.length,
      }));
    });
    return result;
  }
}
