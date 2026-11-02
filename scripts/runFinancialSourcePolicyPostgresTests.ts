/**
 * True PostgreSQL financial-source policy integration. Synthetic identities.
 * The critical invariant is exactly one winning checker in a concurrent
 * UPDATE ... WHERE status=pending AND revision=expected transition.
 */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync, createHash, sign } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import { FinancialSourceIntakeService } from "../lib/backend/domains/reconciliation/financialSourceIntakeService";
import { FinancialSignerOnboardingService } from "../lib/backend/domains/reconciliation/financialSignerOnboardingService";
import { InMemoryObjectStorageAdapter } from "../lib/backend/domains/documents/documentStorage";
import { FinancialSourceImportJournalService, type FinancialVersionedImportStorage } from "../lib/backend/domains/reconciliation/financialSourceImportJournalService";
import { manifestSigningBytes, type SignedFinancialSourceManifest } from "../lib/backend/domains/reconciliation/financialSourceProvenanceGate";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Disposable DATABASE_URL required");
const suffix = randomUUID().slice(0, 12);
const org = "source-pg-" + suffix;
const userIds = ["proposer-" + suffix, "checker-a-" + suffix, "checker-b-" + suffix];
const now = new Date().toISOString();
const ctx = (id: string): TenantContext => ({
  organizationId: org, userId: id, userEmail: id + "@example.invalid",
  userRole: "Administrator",
  permissions: [...getPermissionsForRole("Administrator")],
  requestId: "source-pg-test-" + suffix, timestamp: now,
});

let checkpoint = "initialization";
const hardStop = setTimeout(() => {
  console.error("FAIL: source policy PostgreSQL test deadline at stage:", checkpoint);
  process.exit(1);
}, 65000);

async function main() {
  checkpoint = "database bootstrap";
  const db = DatabaseStore.createPostgresStore(databaseUrl!);
  await db.bootstrapPersistence();
  checkpoint = "organization creation";
  await db.createOrganizationRecord({
    id: org, name: "Synthetic source custody institution",
    displayName: "Synthetic source custody institution",
    slug: org, industry: "financial services",
    plan: "enterprise", currency: "NGN", currencySymbol: "₦",
    timezone: "Africa/Lagos", createdAt: now, updatedAt: now,
  });
  checkpoint = "test identity creation";
  for (const id of userIds) {
    await db.createUserRecord({
      id, email: id + "@example.invalid", name: id, title: "Institution administrator",
      status: "active", createdAt: now,
    });
    await db.createMembershipRecord({
      id: "m-" + id, userId: id, organizationId: org,
      role: "Administrator", joinedAt: now,
    });
  }
  checkpoint = "create approval service";
  // Test-only instrumentation to identify any PostgreSQL transaction stall.
  const originalTransaction = db.runInTransaction.bind(db);
  (db as any).runInTransaction = async (context: TenantContext, work: (uow: any) => Promise<any>) => {
    checkpoint = "opening financial source transaction";
    return originalTransaction(context, async (uow) => {
      checkpoint = "transaction entered";
      return work(uow);
    });
  };
  const originalCreate = db.financialSourceRegistryRepo.create.bind(db.financialSourceRegistryRepo);
  (db.financialSourceRegistryRepo as any).create = async (...args: Parameters<typeof originalCreate>) => {
    checkpoint = "inserting policy record";
    const result = await originalCreate(...args);
    checkpoint = "policy record inserted";
    return result;
  };
  const auditInsert = db.recordAuditLog.bind(db);
  db.recordAuditLog = async (record) => {
    checkpoint = "inserting audit receipt";
    const result = await auditInsert(record);
    checkpoint = "audit receipt inserted";
    return result;
  };
  const service = new FinancialSourceIntakeService(db, new InMemoryObjectStorageAdapter());
  const policy = await service.proposeSource(ctx(userIds[0]), {
    sourceLabel: "synthetic-core-settlement-source",
    kind: "settlement", role: "expected",
  });
  assert.equal(policy.status, "pending");
  checkpoint = "self approval denial";
  await assert.rejects(() => service.decideSource(ctx(userIds[0]), {
    registryId: policy.id, expectedRevision: 1,
    verdict: "approved", reason: "Self authorization must never be possible",
  }), /may not approve/i);

  checkpoint = "competing source reviewers";
  const [a, b] = await Promise.allSettled([
    service.decideSource(ctx(userIds[1]), {
      registryId: policy.id, expectedRevision: 1,
      verdict: "approved", reason: "First reviewer independently authorizes synthetic intake",
    }),
    service.decideSource(ctx(userIds[2]), {
      registryId: policy.id, expectedRevision: 1,
      verdict: "rejected", reason: "Concurrent reviewer attempts rejection of source policy",
    }),
  ]);
  checkpoint = "concurrent review results";
  assert.equal([a, b].filter(x => x.status === "fulfilled").length, 1);
  assert.equal([a, b].filter(x => x.status === "rejected").length, 1);
  const after = await db.financialSourceRegistryRepo.findById(policy.id, ctx(userIds[0]));
  assert.equal(after.revision, 2);
  assert(["approved", "rejected"].includes(after.status));
  assert.notEqual(after.reviewedByUserId, userIds[0]);
  const audit = await db.auditLogsRepo.findMany(ctx(userIds[0]), { limit: 100 });
  assert.equal(audit.items.filter(x => x.resourceId === policy.id && x.action === "financial_source:reviewed").length, 1);

  checkpoint = "restart persistence";
  const restarted = DatabaseStore.createPostgresStore(databaseUrl!);
  await restarted.bootstrapPersistence();
  const persisted = await restarted.financialSourceRegistryRepo.findById(policy.id, ctx(userIds[1]));
  assert.equal(persisted.status, after.status);
  assert.equal(persisted.revision, 2);
  assert.equal(persisted.externalSourceAuthorityVerified, false);

  // Failure in the audit insert must rollback the conditional source approval.
  checkpoint = "audit failure rollback";
  const second = await service.proposeSource(ctx(userIds[0]), {
    sourceLabel: "synthetic-rollback-source", kind: "fee", role: "observed",
  });
  const originalAudit = db.recordAuditLog.bind(db);
  db.recordAuditLog = async () => { throw new Error("synthetic audit outage"); };
  try {
    await assert.rejects(() => service.decideSource(ctx(userIds[1]), {
      registryId: second.id, expectedRevision: 1, verdict: "approved",
      reason: "This approval must rollback without durable audit",
    }), /synthetic audit outage/i);
  } finally {
    db.recordAuditLog = originalAudit;
  }
  const reverted = await restarted.financialSourceRegistryRepo.findById(second.id, ctx(userIds[1]));
  assert.equal(reverted.status, "pending");
  assert.equal(reverted.revision, 1);
  checkpoint = "financial import journal true PostgreSQL";
  const keys = generateKeyPairSync("ed25519");
  const keyInfo = {
    keyId: "internal-signer-" + suffix,
    ed25519PublicKeySpkiDerBase64: keys.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
  const signedPolicy = await service.proposeSource(ctx(userIds[0]), {
    sourceLabel: "synthetic-worm-journal-source",
    kind: "settlement", role: "expected", signingKey: keyInfo,
  });
  await service.decideSource(ctx(userIds[1]), {
    registryId: signedPolicy.id, expectedRevision: 1,
    verdict: "approved", reason: "Synthetic signed source approved by independent bank tester",
  });
  const bytes = Buffer.from(
    "reference,currency,amount_minor,record_id,recorded_at\nSETTLEMENT-001,NGN,10000,record-ref-1,2026-11-01T09:00:00Z\n",
    "utf8"
  );
  const digest = createHash("sha256").update(bytes).digest("hex");
  const iso = (offset: number) => new Date(Date.now() + offset).toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifest: SignedFinancialSourceManifest = {
    schemaVersion: 1, organizationId: org, registryId: signedPolicy.id,
    sourceReference: "pg-integration-fixture-" + suffix,
    kind: "settlement", role: "expected",
    sha256: digest, bytes: bytes.length,
    issuedAt: iso(-120000), expiresAt: iso(86400_000),
  };
  const signatureBase64 = sign(null, manifestSigningBytes(manifest), keys.privateKey).toString("base64");
  const storedVersions = new Map<string, { version: string; bytes: Buffer }>();
  const retainUntil = iso(7 * 86400_000);
  const storage: FinancialVersionedImportStorage = {
    async putObject(key, data, mime) {
      assert.equal(mime, "text/csv");
      const version = "pg-version-" + randomUUID();
      storedVersions.set(key, { version, bytes: Buffer.from(data) });
      return {
        uri: "s3://synthetic-pg-evidence/" + key,
        bytes: data.length, checksumSha256: createHash("sha256").update(data).digest("hex"),
        encryption: "AES-256-GCM", versionId: version,
      };
    },
    async getObjectVersion(key, versionId) {
      const item = storedVersions.get(key);
      return item?.version === versionId ? { data: item.bytes, mimeType: "text/csv" } : null;
    },
    async inspectObjectVersionRetention(key, versionId) {
      const item = storedVersions.get(key);
      return item?.version === versionId ? { versionId, mode: "COMPLIANCE", retainUntil } : null;
    },
  };
  const svc = new FinancialSourceImportJournalService(db, storage);
  const payload = (key: string) => ({
    registryId: signedPolicy.id, idempotencyKey: key,
    csvBytes: bytes, manifest, signatureBase64,
  });
  const prepared = await svc.prepare(ctx(userIds[0]), payload("pg-journal-0001"));
  const again = await svc.prepare(ctx(userIds[0]), payload("pg-journal-0001"));
  assert.equal(prepared.id, again.id);
  const concurrentUploads = await Promise.allSettled([
    svc.upload(ctx(userIds[0]), prepared.id, bytes),
    svc.upload(ctx(userIds[1]), prepared.id, bytes),
  ]);
  assert.equal(concurrentUploads.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(concurrentUploads.filter(x => x.status === "rejected").length, 1);
  const stored = await restarted.financialSourceImportsRepo.findById(prepared.id, ctx(userIds[1]));
  assert.equal(stored.state, "stored");
  assert(stored.storageVersionId?.startsWith("pg-version-"));
  const finalizations = await Promise.allSettled([
    svc.finalize(ctx(userIds[0]), prepared.id),
    svc.finalize(ctx(userIds[1]), prepared.id),
  ]);
  assert(finalizations.some(x => x.status === "fulfilled"));
  const committed = await restarted.financialSourceImportsRepo.findById(prepared.id, ctx(userIds[1]));
  assert.equal(committed.state, "committed");
  assert.equal((await restarted.financialSourceSnapshotsRepo.findById(prepared.snapshotId, ctx(userIds[1]))).storageVersionId, committed.storageVersionId);
  assert.equal((await svc.recover(ctx(userIds[1]), prepared.id)).state, "committed");

  checkpoint = "financial journal audit rollback";
  const separate = await svc.prepare(ctx(userIds[0]), payload("pg-journal-0002"));
  await svc.upload(ctx(userIds[0]), separate.id, bytes);
  const oldAudit = db.recordAuditLog.bind(db);
  db.recordAuditLog = async log => {
    if (log.action === "financial_source:import_committed") throw new Error("synthetic journal audit failure");
    return oldAudit(log);
  };
  try {
    await assert.rejects(() => svc.finalize(ctx(userIds[1]), separate.id), /synthetic journal audit failure/i);
  } finally {
    db.recordAuditLog = oldAudit;
  }
  assert.equal((await restarted.financialSourceImportsRepo.findById(separate.id, ctx(userIds[1]))).state, "stored");
  await assert.rejects(() => restarted.financialSourceSnapshotsRepo.findById(separate.snapshotId, ctx(userIds[1])), /not found/i);
  const recovered = await svc.recover(ctx(userIds[1]), separate.id);
  assert.equal(recovered.state, "committed");
  const auditSet = await restarted.auditLogsRepo.findMany(ctx(userIds[0]), { limit: 100 });
  assert.equal(auditSet.items.filter(x => x.action === "financial_source:import_committed" && x.resourceId === separate.id).length, 1);

  checkpoint = "financial signer proof challenge PostgreSQL";
  const signerOnboarding = new FinancialSignerOnboardingService(db);
  const challenge = await signerOnboarding.requestChallenge(ctx(userIds[0]), signedPolicy.id);
  assert.equal(challenge.dossier.status, "challenge_pending");
  const signerProof = sign(null, challenge.signingBytes, keys.privateKey).toString("base64");
  const proof = await signerOnboarding.provePossession(ctx(userIds[0]), {
    dossierId: challenge.dossier.id, nonceBase64: challenge.nonceBase64,
    signatureBase64: signerProof,
  });
  assert.equal(proof.status, "proof_verified");
  assert.equal(proof.bankKeyOwnershipIndependentlyVerified, false);
  const restartedProof = await restarted.financialSignerOnboardingRepo.findById(proof.id, ctx(userIds[1]));
  assert.equal(restartedProof.revision, 2);

  checkpoint = "financial signer independent review PostgreSQL CAS";
  const proofReview = {
    dossierId: proof.id, expectedRevision: 2, verdict: "reviewed" as const,
    reason: "Reviewed synthetic signature proof and mock external evidence only",
    externalEvidenceRef: "synthetic-bank-authority-evidence-"+suffix,
    externalEvidenceSha256: createHash("sha256").update("synthetic-external-authority-fixture").digest("hex"),
  };
  await assert.rejects(() => signerOnboarding.reviewDossier(ctx(userIds[0]), proofReview), /independent/i);
  const decisions = await Promise.allSettled([
    signerOnboarding.reviewDossier(ctx(userIds[1]), proofReview),
    signerOnboarding.reviewDossier(ctx(userIds[2]), proofReview),
  ]);
  assert.equal(decisions.filter(x => x.status === "fulfilled").length, 1);
  const signedDossier = await restarted.financialSignerOnboardingRepo.findById(proof.id, ctx(userIds[1]));
  assert.equal(signedDossier.status, "reviewed");
  assert.equal(signedDossier.bankKeyOwnershipIndependentlyVerified, false);
  assert.equal(signedDossier.revision, 3);

  checkpoint = "financial source emergency signer revocation PostgreSQL";
  const revokeRace = await Promise.allSettled([
    service.revokeSource(ctx(userIds[1]), {
      registryId: signedPolicy.id, expectedRevision: 2,
      reason: "Emergency synthetic source signing key revoke by checker one",
    }),
    service.revokeSource(ctx(userIds[2]), {
      registryId: signedPolicy.id, expectedRevision: 2,
      reason: "Competing synthetic source signing key revoke by checker two",
    }),
  ]);
  assert.equal(revokeRace.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(revokeRace.filter(x => x.status === "rejected").length, 1);
  const revokedSource = await restarted.financialSourceRegistryRepo.findById(signedPolicy.id, ctx(userIds[0]));
  assert.equal(revokedSource.status, "revoked");
  assert.equal(revokedSource.revision, 3);
  await assert.rejects(() => svc.prepare(ctx(userIds[0]), payload("pg-journal-after-revoke")), /approved|requires/i);
  await assert.rejects(() => signerOnboarding.requestChallenge(ctx(userIds[0]), signedPolicy.id), /not approved/i);
  const signerAudits = await restarted.auditLogsRepo.findMany(ctx(userIds[0]), { limit: 100 });
  assert.equal(signerAudits.items.filter(x => x.action === "financial_source:signer_revoked" &&
      x.resourceId === signedPolicy.id).length, 1);
  assert.equal(signerAudits.items.filter(x => x.action === "financial_signer:dossier_reviewed" &&
      x.resourceId === proof.id).length, 1);

  clearTimeout(hardStop);
  console.log("PASS: PostgreSQL atomic independent source checker, serialized races, restart durability and audit rollback");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
