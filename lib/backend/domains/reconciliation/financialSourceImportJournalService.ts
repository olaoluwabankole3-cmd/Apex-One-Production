/**
 * Recovery-safe FINANCIAL SOURCE import journal — synthetic/internal only.
 *
 * S3 and PostgreSQL have no distributed transaction. First persist intent,
 * then acquire an atomic upload claim, then upload encrypted versioned bytes,
 * verify exact S3 COMPLIANCE retention, persist version receipt, and finally
 * create the visible snapshot in a DB transaction together with an audit.
 *
 * Crash BEFORE receipt: quarantine, NEVER blindly re-upload the same WORM key.
 * Crash AFTER receipt: revalidate pinned S3 version and finalize without bytes.
 * This does NOT authenticate bank signers or permit real institutional data.
 */
import { createHash } from "node:crypto";
import { DatabaseStore } from "../../database/store";
import type { FinancialSourceImportRecord, FinancialSourceRegistryRecord, FinancialSourceSnapshotRecord } from "../../database/schema";
import type { TenantContext } from "../../core/errors";
import { ConflictError, CrossTenantViolationError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { getPermissionsForRole, requirePermission } from "../../core/security";
import type { ObjectStorageWriteResult } from "../documents/documentStorage";
import { financialSourceSnapshotKey } from "./financialSourceIntegrityGate";
import {
  checkFinancialSnapshotObjectLock, verifyFinancialManifestSignature,
  type SignedFinancialSourceManifest, type FinancialVersionedCustodyStorage,
} from "./financialSourceProvenanceGate";
import { validateFinancialCsvForInternalIntake } from "./csvPreviewService";

export interface FinancialVersionedImportStorage extends FinancialVersionedCustodyStorage {
  putObject(key: string, data: Buffer, mimeType: string): Promise<ObjectStorageWriteResult>;
}

export interface FinancialImportInput {
  registryId: string;
  idempotencyKey: string;
  csvBytes: Buffer;
  manifest: SignedFinancialSourceManifest;
  signatureBase64: string;
}

function internalGate(): void {
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT === "production") throw new NotFoundError("Internal source import");
  if (process.env.TEST_ENV === "true") return;
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging" ||
      process.env.CORTEX_INTERNAL_FINANCIAL_SOURCE_INTAKE_ENABLED !== "true" ||
      process.env.CORTEX_VERSIONED_FINANCIAL_IMPORT_ENABLED !== "true") {
    throw new NotFoundError("Internal source import");
  }
}

async function access(ctx: TenantContext, db: DatabaseStore, capability: "financial:read" | "financial:write") {
  requirePermission(ctx, capability);
  // The custom PostgreSQL connection is sequential, never use Promise.all here.
  const membership = await db.findUserMembership(ctx.userId, ctx.organizationId);
  const user = await db.findUserById(ctx.userId);
  if (!membership || !user || user.status !== "active" ||
      membership.role !== ctx.userRole ||
      !getPermissionsForRole(membership.role).includes(capability)) {
    throw new ForbiddenError("Current institutional membership is not authorized for financial source imports");
  }
}

async function getScoped<T extends { id: string; organizationId: string }>(
  repo: { findById(id: string, ctx: TenantContext, name?: string): Promise<T> },
  ctx: TenantContext, id: string, kind: string
): Promise<T> {
  try {
    return await repo.findById(id, ctx, kind);
  } catch (error) {
    if (error instanceof CrossTenantViolationError) throw new NotFoundError(kind);
    throw error;
  }
}

function journalAudit(ctx: TenantContext, action: string, id: string, metadata: Record<string, unknown>) {
  return {
    organizationId: ctx.organizationId, actorId: ctx.userId,
    actorEmail: ctx.userEmail, action,
    resource: "FinancialSourceImport", resourceId: id, requestId: ctx.requestId,
    status: "success" as const, timestamp: new Date().toISOString(),
    metadata: {
      sourceAuthenticityVerified: false, coverageVerified: false,
      financialLossAssessed: false, bankRetentionPolicyVerified: false,
      ...metadata,
    },
  };
}

function sha(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function ensureBytes(bytes: Buffer): Buffer {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 131072) {
    throw new ValidationError("Financial import requires 1 to 131072 bytes");
  }
  return Buffer.from(bytes);
}

function identity(ctx: TenantContext, idempotencyKey: string, registryId: string) {
  if (typeof idempotencyKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{7,79}$/.test(idempotencyKey)) {
    throw new ValidationError("Opaque financial import idempotency key must contain 8-80 safe characters");
  }
  const digest = sha(JSON.stringify([ctx.organizationId, registryId, idempotencyKey]));
  return {
    importId: "fimp-" + digest.slice(0, 40),
    sourceId: "snapshot-" + digest.slice(0, 32),
    snapshotId: "fsource-" + digest.slice(0, 40),
    keySha256: sha(idempotencyKey),
  };
}

function snapshotOf(record: FinancialSourceImportRecord): FinancialSourceSnapshotRecord {
  return {
    id: record.snapshotId,
    organizationId: record.organizationId,
    sourceRegistryId: record.sourceRegistryId,
    kind: record.kind, role: record.role, sourceId: record.sourceId,
    expectedSha256: record.expectedSha256, expectedBytes: record.expectedBytes,
    rowCount: record.rowCount,
    recordedByUserId: record.initiatedByUserId, createdAt: record.createdAt,
    encryption: "AES-256-GCM", byteIntegrityCheckedAtIntake: true,
    ...(record.storageVersionId ? { storageVersionId: record.storageVersionId } : {}),
    storageImmutabilityVerified: false,
    sourceAuthenticityVerified: false,
    coverageVerified: false, financialLossAssessed: false,
  };
}

export class FinancialSourceImportJournalService {
  constructor(private readonly db: DatabaseStore, private readonly storage: FinancialVersionedImportStorage) {}

  public async prepare(ctx: TenantContext, input: FinancialImportInput): Promise<FinancialSourceImportRecord> {
    internalGate();
    await access(ctx, this.db, "financial:read");
    await access(ctx, this.db, "financial:write");
    const bytes = ensureBytes(input.csvBytes);
    const key = identity(ctx, input.idempotencyKey, input.registryId);
    const registry = await getScoped(this.db.financialSourceRegistryRepo, ctx, input.registryId, "FinancialSourceRegistry");
    if (registry.status !== "approved" || !registry.signingKey) {
      throw new ConflictError("Import requires an independently approved financial source signing key");
    }
    let csv: string;
    try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new ValidationError("Financial source import requires valid UTF-8 CSV"); }
    const validated = validateFinancialCsvForInternalIntake(ctx, registry.kind, registry.role, {
      feedId: key.sourceId, csv,
    });
    const candidate: FinancialSourceSnapshotRecord = {
      id: key.snapshotId, organizationId: ctx.organizationId,
      sourceRegistryId: registry.id, kind: registry.kind, role: registry.role,
      sourceId: key.sourceId, expectedSha256: validated.sha256,
      expectedBytes: bytes.length, rowCount: validated.rows,
      recordedByUserId: ctx.userId, createdAt: new Date().toISOString(),
      encryption: "AES-256-GCM", byteIntegrityCheckedAtIntake: true,
      storageImmutabilityVerified: false, sourceAuthenticityVerified: false,
      coverageVerified: false, financialLossAssessed: false,
    };
    const manifestCheck = verifyFinancialManifestSignature(
      input.manifest, input.signatureBase64, registry, candidate
    );
    return this.db.runInTransaction(ctx, async () => {
      await access(ctx, this.db, "financial:write");
      const latest = await getScoped(this.db.financialSourceRegistryRepo, ctx, registry.id, "FinancialSourceRegistry");
      if (latest.status !== "approved" ||
          latest.signingKey?.keyFingerprintSha256 !== manifestCheck.signerKeyFingerprintSha256) {
        throw new ConflictError("Financial signing source policy changed during preparation");
      }
      let existing: FinancialSourceImportRecord | undefined;
      try { existing = await this.db.financialSourceImportsRepo.findById(key.importId, ctx); }
      catch (err) { if (!(err instanceof NotFoundError)) throw err; }
      if (existing) {
        if (existing.expectedSha256 !== validated.sha256 ||
            existing.expectedBytes !== bytes.length ||
            existing.sourceRegistryId !== registry.id ||
            existing.manifestFingerprintSha256 !== manifestCheck.manifestFingerprintSha256 ||
            existing.idempotencyKeySha256 !== key.keySha256) {
          throw new ConflictError("Idempotency key conflicts with an existing financial source import");
        }
        return existing;
      }
      const now = new Date().toISOString();
      const item = await this.db.financialSourceImportsRepo.create({
        id: key.importId,
        sourceRegistryId: registry.id, idempotencyKeySha256: key.keySha256,
        sourceId: key.sourceId, snapshotId: key.snapshotId,
        kind: registry.kind, role: registry.role,
        expectedSha256: validated.sha256, expectedBytes: bytes.length,
        rowCount: validated.rows, initiatedByUserId: ctx.userId,
        createdAt: now, updatedAt: now,
        revision: 1, state: "prepared",
        manifestFingerprintSha256: manifestCheck.manifestFingerprintSha256,
        signingKeyFingerprintSha256: manifestCheck.signerKeyFingerprintSha256,
        sourceAuthenticityVerified: false, coverageVerified: false, financialLossAssessed: false,
      }, ctx);
      await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_prepared", item.id, {
        sourceRegistryId: item.sourceRegistryId, sha256: item.expectedSha256,
        sourceBytes: item.expectedBytes, manifestFingerprint: item.manifestFingerprintSha256,
        revision: 1,
      }));
      return item;
    });
  }

  /**
   * Claim is written BEFORE S3. Interrupted upload is quarantined on recovery:
   * its exact S3 version may be unknowable, so do not overwrite/retry blindly.
   */
  public async upload(ctx: TenantContext, importId: string, csvBytes: Buffer): Promise<FinancialSourceImportRecord> {
    internalGate();
    await access(ctx, this.db, "financial:write");
    const bytes = ensureBytes(csvBytes);
    const original = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
    if (original.state !== "prepared" || original.expectedBytes !== bytes.length ||
        original.expectedSha256 !== sha(bytes)) {
      throw new ConflictError("Import is not prepared for exactly these source bytes");
    }
    const claimed = await this.db.runInTransaction(ctx, async () => {
      await access(ctx, this.db, "financial:write");
      const current = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
      if (current.state !== "prepared" || current.revision !== original.revision) {
        throw new ConflictError("Financial import is already claimed by another worker");
      }
      const next = await this.db.transitionFinancialSourceImport(ctx, importId,
        "prepared", current.revision, "uploading");
      await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_claimed", importId, {
        revision: next.revision,
      }));
      return next;
    });
    const key = financialSourceSnapshotKey(ctx.organizationId, {
      sourceId: claimed.sourceId,
      expectedBytes: claimed.expectedBytes, expectedSha256: claimed.expectedSha256,
    });
    try {
      const receipt = await this.storage.putObject(key, bytes, "text/csv");
      if (receipt.encryption !== "AES-256-GCM" ||
          receipt.bytes !== bytes.length || receipt.checksumSha256 !== claimed.expectedSha256 ||
          !receipt.versionId || receipt.versionId === "null") {
        throw new ConflictError("Encrypted storage did not return a pinned S3 version receipt");
      }
      // A positive retention observation is REQUIRED for this strict path.
      await checkFinancialSnapshotObjectLock(ctx.organizationId, {
        ...snapshotOf(claimed), storageVersionId: receipt.versionId,
      }, this.storage);
      return this.db.runInTransaction(ctx, async () => {
        await access(ctx, this.db, "financial:write");
        const next = await this.db.transitionFinancialSourceImport(ctx, importId,
          "uploading", claimed.revision, "stored", {
            storageVersionId: receipt.versionId,
          });
        await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_version_pinned", importId, {
          versionId: receipt.versionId, revision: next.revision,
          complianceHeaderObserved: true,
        }));
        return next;
      });
    } catch (err) {
      // If DB was lost after receipt, the journal remains uploading. The
      // sweeper quarantines it; no alternative version is guessed as proof.
      try {
        await this.db.runInTransaction(ctx, async () => {
          await access(ctx, this.db, "financial:write");
          const current = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
          if (current.state === "uploading") {
            const next = await this.db.transitionFinancialSourceImport(ctx, importId,
              "uploading", current.revision, "quarantined", {
                quarantineCode: "storage_verification_failed",
              });
            await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_quarantined", importId, {
              code: "storage_verification_failed", revision: next.revision,
            }));
          }
        });
      } catch {
        // Never hide the original failure or assume either DB or S3 committed.
      }
      throw err;
    }
  }

  /** Resume a verified object receipt without requiring raw financial bytes. */
  public async finalize(ctx: TenantContext, importId: string): Promise<FinancialSourceSnapshotRecord> {
    internalGate();
    await access(ctx, this.db, "financial:write");
    const current = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
    if (current.state === "committed") {
      return getScoped(this.db.financialSourceSnapshotsRepo, ctx, current.snapshotId, "FinancialSourceSnapshot");
    }
    if (current.state !== "stored" || !current.storageVersionId) {
      throw new ConflictError("Only an import with a verified pinned S3 version may be finalized");
    }
    await checkFinancialSnapshotObjectLock(ctx.organizationId, snapshotOf(current), this.storage);
    return this.db.runInTransaction(ctx, async () => {
      await access(ctx, this.db, "financial:write");
      const fresh = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
      if (fresh.state !== "stored" || fresh.revision !== current.revision) {
        throw new ConflictError("Import was already finalized or changed");
      }
      const policy: FinancialSourceRegistryRecord = await getScoped(
        this.db.financialSourceRegistryRepo, ctx, fresh.sourceRegistryId, "FinancialSourceRegistry"
      );
      if (policy.status !== "approved" ||
          policy.signingKey?.keyFingerprintSha256 !== fresh.signingKeyFingerprintSha256) {
        throw new ConflictError("Financial source signing policy was changed");
      }
      const snapshot = await this.db.financialSourceSnapshotsRepo.create({
        ...snapshotOf(fresh),
        id: fresh.snapshotId,
        // Repository injects tenant from ctx, not from a caller.
      }, ctx);
      const next = await this.db.transitionFinancialSourceImport(ctx,
        importId, "stored", fresh.revision, "committed");
      await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_committed", importId, {
        snapshotId: snapshot.id, storageVersionId: fresh.storageVersionId,
        revision: next.revision,
      }));
      return snapshot;
    });
  }

  /** Only stored imports are resumable; unknown upload receipts are isolated. */
  public async recover(ctx: TenantContext, importId: string):
    Promise<{ state: FinancialSourceImportRecord["state"]; snapshot?: FinancialSourceSnapshotRecord }> {
    internalGate();
    await access(ctx, this.db, "financial:write");
    const item = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
    if (item.state === "stored" || item.state === "committed") {
      return { state: "committed", snapshot: await this.finalize(ctx, importId) };
    }
    if (item.state === "uploading") {
      // An active worker may legitimately be writing the object. Only a stale
      // claim can be treated as an interrupted upload; never race an active
      // worker and force it into quarantine mid-write.
      const age = Date.now() - Date.parse(item.updatedAt);
      if (!Number.isFinite(age) || age < 5 * 60_000) return { state: "uploading" };
      const quarantined = await this.db.runInTransaction(ctx, async () => {
        await access(ctx, this.db, "financial:write");
        const current = await getScoped(this.db.financialSourceImportsRepo, ctx, importId, "FinancialSourceImport");
        if (current.state !== "uploading" ||
            !Number.isFinite(Date.parse(current.updatedAt)) ||
            Date.now() - Date.parse(current.updatedAt) < 5 * 60_000) {
          throw new ConflictError("Import still active or changed while recovering");
        }
        const next = await this.db.transitionFinancialSourceImport(ctx, importId,
          "uploading", current.revision, "quarantined", { quarantineCode: "upload_interrupted" });
        await this.db.recordAuditLog(journalAudit(ctx, "financial_source:import_quarantined", importId, {
          code: "upload_interrupted", revision: next.revision,
        }));
        return next;
      });
      return { state: quarantined.state };
    }
    return { state: item.state };
  }
}
