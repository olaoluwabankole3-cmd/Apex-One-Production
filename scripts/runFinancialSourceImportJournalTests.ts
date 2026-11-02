/**
 * Synthetic fail-closed S3/PostgreSQL saga test. Fake versioned S3 exercises
 * the strict contract; real encrypted S3 and PostgreSQL separately tested in
 * production CI. No user supplied bank records or real-bank credentials.
 */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { OrganizationMembershipRecord, UserRecord } from "../lib/backend/database/schema";
import {
  FinancialSourceImportJournalService, type FinancialVersionedImportStorage
} from "../lib/backend/domains/reconciliation/financialSourceImportJournalService";
import { manifestSigningBytes, type SignedFinancialSourceManifest } from "../lib/backend/domains/reconciliation/financialSourceProvenanceGate";

const suffix = randomUUID().slice(0, 12);
const org = "journal-test-" + suffix;
const foreignOrg = "foreign-" + suffix;
const now = new Date().toISOString();
const csv = Buffer.from(
  "reference,currency,amount_minor,record_id,recorded_at\nSETTLEMENT-001,NGN,10000,bank-src-1,2026-11-01T09:00:00Z\n",
  "utf8"
);
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const db = DatabaseStore.createFreshStore();
db.clearAll();
for (const [id, tenant, role, status] of [
  ["registrar", org, "Administrator", "active"], ["checker", org, "Administrator", "active"],
  ["custodian", org, "Administrator", "active"], ["outsider", foreignOrg, "Administrator", "active"],
  ["disabled", org, "Administrator", "disabled"],
] as const) {
  const user: UserRecord = { id, email: id + "@example.invalid", name: id,
    title: role, status, createdAt: now };
  const member: OrganizationMembershipRecord = { id: "m-" + id,
    organizationId: tenant, userId: id, role, joinedAt: now };
  db.users.set(id, user);
  db.memberships.set(member.id, member);
}
const ctx = (userId: string, organizationId = org): TenantContext => ({
  organizationId, userId, userEmail: userId + "@example.invalid",
  userRole: "Administrator", permissions: [...getPermissionsForRole("Administrator")],
  requestId: "import-journal-tests", timestamp: now,
});
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const utc = (offsetMs: number) => new Date(Date.now() + offsetMs)
  .toISOString().replace(/\.\d{3}Z$/, "Z");
const objects = new Map<string, { data: Buffer; version: string }>();
let failUpload = false;
let corruptStored = false;
let receiptOnlyFailure = false;
let uploadCount = 0;
const storage: FinancialVersionedImportStorage = {
  async putObject(key, bytes, mime) {
    if (failUpload) throw new Error("simulated S3 object outage");
    assert.equal(mime, "text/csv");
    uploadCount++;
    const versionId = "version-" + uploadCount;
    objects.set(key, { data: Buffer.from(bytes), version: versionId });
    if (receiptOnlyFailure) throw new Error("S3 write succeeded but no receipt returned");
    return { uri: "s3://synthetic-worm/" + key, bytes: bytes.length,
      checksumSha256: sha(bytes), encryption: "AES-256-GCM", versionId };
  },
  async getObjectVersion(key, versionId) {
    const value = objects.get(key);
    if (!value || value.version !== versionId) return null;
    return { data: corruptStored ? Buffer.from("tampered") : value.data, mimeType: "text/csv" };
  },
  async inspectObjectVersionRetention(key, versionId) {
    const value = objects.get(key);
    if (!value) return null;
    return { versionId: value.version, mode: "COMPLIANCE",
      retainUntil: utc(30 * 86400_000) };
  },
};

async function main() {
  const { FinancialSourceIntakeService } = await import(
    "../lib/backend/domains/reconciliation/financialSourceIntakeService"
  );
  const { InMemoryObjectStorageAdapter } = await import(
    "../lib/backend/domains/documents/documentStorage"
  );
  const policyService = new FinancialSourceIntakeService(db, new InMemoryObjectStorageAdapter());
  const signingKey = { keyId: "trusted-synthetic-key-" + suffix,
    ed25519PublicKeySpkiDerBase64: publicKey.export({ type: "spki", format: "der" }).toString("base64") };
  const source = await policyService.proposeSource(ctx("registrar"), {
    sourceLabel: "synthetic-expected-" + suffix, kind: "settlement",
    role: "expected", signingKey,
  });
  await policyService.decideSource(ctx("checker"), {
    registryId: source.id, expectedRevision: 1,
    verdict: "approved", reason: "Independent synthetic source registry approval",
  });
  const manifest: SignedFinancialSourceManifest = {
    schemaVersion: 1, organizationId: org, registryId: source.id,
    sourceReference: "synthetic-run-" + suffix, kind: "settlement",
    role: "expected", sha256: sha(csv), bytes: csv.length,
    issuedAt: utc(-60000), expiresAt: utc(2 * 86400_000),
  };
  const signatureBase64 = sign(null, manifestSigningBytes(manifest), privateKey).toString("base64");
  const svc = new FinancialSourceImportJournalService(db, storage);
  const inp = (key: string) => ({
    registryId: source.id, idempotencyKey: key, csvBytes: csv,
    manifest, signatureBase64,
  });

  const prepared = await svc.prepare(ctx("custodian"), inp("import-run-0001"));
  assert.equal(prepared.state, "prepared");
  assert.equal(prepared.expectedSha256, sha(csv));
  assert.equal(prepared.sourceAuthenticityVerified, false);
  assert.equal(prepared.financialLossAssessed, false);
  assert.equal((await svc.prepare(ctx("custodian"), inp("import-run-0001"))).id, prepared.id);
  await assert.rejects(() => svc.prepare(ctx("custodian"), {
    ...inp("import-run-0001"), csvBytes: Buffer.from(csv.toString().replace("10000", "11000")),
  }), /does not match|idempotency/i);
  await assert.rejects(() => svc.prepare(ctx("outsider", foreignOrg), inp("import-run-0002")), /not found/i);
  await assert.rejects(() => svc.prepare(ctx("disabled"), inp("import-run-0002")), /membership/i);
  await assert.rejects(() => svc.prepare(ctx("custodian"), {
    ...inp("import-run-0002"), signatureBase64: "a".repeat(88),
  }), /signature/i);

  const results = await Promise.allSettled([
    svc.upload(ctx("custodian"), prepared.id, csv),
    svc.upload(ctx("custodian"), prepared.id, csv),
  ]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(results.filter(x => x.status === "rejected").length, 1);
  assert.equal(uploadCount, 1);
  const stored = await db.financialSourceImportsRepo.findById(prepared.id, ctx("custodian"));
  assert.equal(stored.state, "stored");
  assert.equal(stored.storageVersionId, "version-1");
  const completed = await svc.recover(ctx("custodian"), prepared.id);
  assert.equal(completed.state, "committed");
  assert.equal(completed.snapshot?.storageVersionId, stored.storageVersionId);
  assert.equal(completed.snapshot?.financialLossAssessed, false);
  assert.equal((await svc.recover(ctx("custodian"), prepared.id)).state, "committed");
  assert.equal(uploadCount, 1);
  await assert.rejects(() => svc.upload(ctx("custodian"), prepared.id, csv), /not prepared/i);

  // Crash after version receipt but before DB snapshot commit. Recovery uses
  // the pinned version, never requires the original byte payload again.
  const second = await svc.prepare(ctx("custodian"), inp("import-run-0003"));
  await svc.upload(ctx("custodian"), second.id, csv);
  const auditFn = db.recordAuditLog.bind(db);
  db.recordAuditLog = async log => {
    if (log.action === "financial_source:import_committed") throw new Error("simulated audit database outage");
    return auditFn(log);
  };
  await assert.rejects(() => svc.finalize(ctx("custodian"), second.id), /simulated audit/i);
  db.recordAuditLog = auditFn;
  assert.equal((await db.financialSourceImportsRepo.findById(second.id, ctx("custodian"))).state, "stored");
  await assert.rejects(() => db.financialSourceSnapshotsRepo.findById(second.snapshotId, ctx("custodian")), /not found/i);
  assert.equal((await svc.recover(ctx("custodian"), second.id)).state, "committed");

  // S3 failure is quarantined and cannot be naively retried.
  const third = await svc.prepare(ctx("custodian"), inp("import-run-0004"));
  failUpload = true;
  await assert.rejects(() => svc.upload(ctx("custodian"), third.id, csv), /simulated S3/i);
  failUpload = false;
  assert.equal((await svc.recover(ctx("custodian"), third.id)).state, "quarantined");
  await assert.rejects(() => svc.upload(ctx("custodian"), third.id, csv), /not prepared/i);

  // Unknown receipt after S3 success is also quarantined, never overwritten.
  const fourth = await svc.prepare(ctx("custodian"), inp("import-run-0005"));
  receiptOnlyFailure = true;
  const beforeCount = uploadCount;
  await assert.rejects(() => svc.upload(ctx("custodian"), fourth.id, csv), /no receipt/i);
  receiptOnlyFailure = false;
  assert.equal(uploadCount, beforeCount + 1);
  assert.equal((await svc.recover(ctx("custodian"), fourth.id)).state, "quarantined");
  assert.equal(uploadCount, beforeCount + 1);

  // Recovery worker sees an in-flight state from a crash BEFORE S3 receipt.
  const fifth = await svc.prepare(ctx("custodian"), inp("import-run-0006"));
  await db.runInTransaction(ctx("custodian"), async () => {
    await db.transitionFinancialSourceImport(ctx("custodian"), fifth.id, "prepared", 1, "uploading");
  });
  // A recently claimed upload may still be active. Recovery does not race it.
  assert.equal((await svc.recover(ctx("custodian"), fifth.id)).state, "uploading");
  const aged = await db.financialSourceImportsRepo.findById(fifth.id, ctx("custodian"));
  db.financialSourceImports.set(fifth.id, {
    ...aged, updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  });
  assert.equal((await svc.recover(ctx("custodian"), fifth.id)).state, "quarantined");

  // A once-verified object that is later tampered with cannot be committed.
  const sixth = await svc.prepare(ctx("custodian"), inp("import-run-0007"));
  await svc.upload(ctx("custodian"), sixth.id, csv);
  corruptStored = true;
  await assert.rejects(() => svc.finalize(ctx("custodian"), sixth.id), /custody check/i);
  corruptStored = false;
  assert.equal((await db.financialSourceImportsRepo.findById(sixth.id, ctx("custodian"))).state, "stored");

  const audits = await db.auditLogsRepo.findMany(ctx("checker"), { limit: 100 });
  assert(audits.items.some(x => x.action === "financial_source:import_prepared"));
  assert(audits.items.some(x => x.action === "financial_source:import_version_pinned"));
  assert(audits.items.some(x => x.action === "financial_source:import_quarantined"));
  assert(audits.items.some(x => x.action === "financial_source:import_committed"));
  const auditText = JSON.stringify(audits.items);
  assert(!auditText.includes("SETTLEMENT-001"));
  assert(!auditText.includes("bank-src-1"));
  console.log("PASS: signed journal prepare, immutable version, idempotency, concurrent upload claim, commit rollback, recovery quarantine, tamper and cross-tenant controls");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
