/**
 * CORTEX — financial byte-integrity gate, synthetic S3/LocalStack integration.
 *
 * Run after test:s3 in the S3 Document Storage Integration CI job.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError, type TenantContext } from "../lib/backend/core/errors";
import {
  InMemoryObjectStorageAdapter,
  S3CompatibleObjectStorageService,
  type IObjectStorageService,
} from "../lib/backend/domains/documents/documentStorage";
import {
  financialSourceSnapshotKey,
  reconcilePinnedFinancialSourceSnapshots,
  type FinancialSourceSnapshotDescriptor,
} from "../lib/backend/domains/reconciliation/financialSourceIntegrityGate";
import { S3WireClient } from "../lib/backend/infrastructure/s3/S3WireClient";

const HEADER = "reference,currency,amount_minor,record_id,recorded_at\n";
const expectedCsv = HEADER + "SETTLEMENT-001,NGN,10000,core-record-01,2026-11-01T08:00:00Z\n";
const observedCsv = HEADER + "SETTLEMENT-001,NGN,9990,provider-record-01,2026-11-01T08:00:01Z\n";
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const unique = randomUUID().slice(0, 8);
const org = "synthetic-finance-" + unique;

const context = (organizationId = org, permissions = ["financial:read", "financial:write"]): TenantContext => ({
  organizationId, userId: "test-auditor", userEmail: "auditor@example.invalid",
  userRole: "Administrator", permissions,
  requestId: "synthetic-byte-proof-" + unique,
  timestamp: new Date().toISOString(),
});
const descriptor = (sourceId: string, csv: Buffer | string): FinancialSourceSnapshotDescriptor => ({
  sourceId, expectedSha256: sha(csv), expectedBytes: Buffer.byteLength(csv),
});

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log("PASS:", name);
  } catch (error) {
    console.error("FAIL:", name, error);
    throw error;
  }
}

async function scenario(store: IObjectStorageService, label: string) {
  const prefix = label + "-" + unique;
  const e = descriptor(prefix + "-expected", expectedCsv);
  const o = descriptor(prefix + "-observed", observedCsv);
  await store.putObject(financialSourceSnapshotKey(org, e), expectedCsv, "text/csv");
  await store.putObject(financialSourceSnapshotKey(org, o), observedCsv, "text/csv");
  return { e, o };
}

async function main(): Promise<void> {
  const env = process.env;
  const config = {
    bucket: env.S3_BUCKET!, region: env.S3_REGION!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    encryptionKey: env.DOCUMENT_STORAGE_ENCRYPTION_KEY!,
    endpoint: env.S3_ENDPOINT!,
  };
  for (const [key, value] of Object.entries(config)) {
    if (!value) throw new Error("Required local S3 test configuration missing: " + key);
  }
  const s3 = new S3CompatibleObjectStorageService(config);
  const memory = new InMemoryObjectStorageAdapter();

  await check("tenant-scoped and SHA-addressed object path is deterministic", async () => {
    const d = descriptor("test-source", expectedCsv);
    const key = financialSourceSnapshotKey(org, d);
    assert.match(key, /^tenants\/[a-f0-9]{32}\/financial-sources\/[a-f0-9]{64}\/test-source\.csv$/);
    assert.notEqual(key, financialSourceSnapshotKey(org + "-different", d));
    assert(!key.includes(org));
    assert(!key.includes("SETTLEMENT-001"));
  });

  await check("rejects unsafe IDs, bad digests, oversized and invalid byte sizes before storage", async () => {
    const base = descriptor("valid", expectedCsv);
    for (const sourceId of ["../bad", "bad/path", "", " space", "🚫"]) {
      assert.throws(() => financialSourceSnapshotKey(org, { ...base, sourceId }), ValidationError);
    }
    assert.throws(() => financialSourceSnapshotKey(org, { ...base, expectedSha256: "abc" }), ValidationError);
    assert.throws(() => financialSourceSnapshotKey(org, { ...base, expectedBytes: 0 }), ValidationError);
    assert.throws(() => financialSourceSnapshotKey(org, { ...base, expectedBytes: 131073 }), ValidationError);
  });

  const { e, o } = await scenario(memory, "memory");
  await check("stored bytes are re-hashed, compared and parsed without monetary certification", async () => {
    const result = await reconcilePinnedFinancialSourceSnapshots(context(), {
      kind: "settlement", expected: e, observed: o,
    }, memory);
    assert.equal(result.contentIntegrityChecked, true);
    assert.equal(result.storageImmutabilityVerified, false);
    assert.equal(result.sourceAuthenticityVerified, false);
    assert.equal(result.coverageVerified, false);
    assert.equal(result.financialLossAssessed, false);
    assert.equal(result.preview.reconciliation.financialLossAssessed, false);
    assert.equal(result.preview.reconciliation.cases[0].differenceMinor, "-10");
    assert.equal(result.preview.reconciliation.cases[0].verificationState, "unverified");
    assert.equal(result.snapshots.expected.sha256, sha(expectedCsv));
    assert.equal(result.preview.sourceStored, false);
    assert.equal(typeof result.checkedAt, "string");
  });

  await check("financial read without financial write is denied before bytes are read", async () => {
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(org, ["financial:read"]), { kind: "settlement", expected: e, observed: o }, memory
    ), ForbiddenError);
  });

  await check("wrong organization cannot read another tenant's stored snapshots", async () => {
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(org + "-different"),
      { kind: "settlement", expected: e, observed: o }, memory
    ), NotFoundError);
  });

  await check("source IDs and hashes must be distinct on both sides", async () => {
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: e, observed: e }, memory
    ), ValidationError);
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: e, observed: { ...e, sourceId: "distinct-but-equal" } }, memory
    ), ValidationError);
  });

  await check("content must match declared byte count even when digest matches", async () => {
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: { ...e, expectedBytes: e.expectedBytes + 1 }, observed: o }, memory
    ), ValidationError);
  });

  await check("overwritten source bytes are detected, demonstrating missing immutability", async () => {
    const key = financialSourceSnapshotKey(org, e);
    await memory.putObject(key, expectedCsv.replace("10000", "11000"), "text/csv");
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: e, observed: o }, memory
    ), ValidationError);
    await memory.putObject(key, expectedCsv, "text/csv");
  });

  await check("wrong MIME is rejected even if the bytes and digest match", async () => {
    const key = financialSourceSnapshotKey(org, e);
    await memory.putObject(key, expectedCsv, "application/json");
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: e, observed: o }, memory
    ), ValidationError);
    await memory.putObject(key, expectedCsv, "text/csv");
  });

  await check("invalid UTF-8 fails closed even with a matching pinned digest", async () => {
    const bad = Buffer.from([0xff, 0xfe, 0x00]);
    const d = descriptor("invalid-utf8", bad);
    await memory.putObject(financialSourceSnapshotKey(org, d), bad, "text/csv");
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: d, observed: o }, memory
    ), ValidationError);
  });

  await check("missing object fails closed without creating a synthetic source", async () => {
    const d = descriptor("never-uploaded", expectedCsv);
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(
      context(), { kind: "settlement", expected: d, observed: o }, memory
    ), NotFoundError);
  });

  await check("independent LocalStack encrypted S3 read verifies both actual plaintext digests", async () => {
    const stored = await scenario(s3, "encrypted-s3");
    const a = await reconcilePinnedFinancialSourceSnapshots(context(), {
      kind: "settlement", expected: stored.e, observed: stored.o,
    }, s3);
    assert.equal(a.contentIntegrityChecked, true);
    assert.equal(a.snapshots.observed.sha256, sha(observedCsv));
    assert.equal(a.preview.reconciliation.cases[0].comparisonStatus, "amount_discrepancy");
    assert.equal(a.sourceAuthenticityVerified, false);
    assert.equal(a.storageImmutabilityVerified, false);
  });

  await check("LocalStack overwrites of encrypted objects are rejected against pinned digests", async () => {
    const stored = await scenario(s3, "tamper-s3");
    await s3.putObject(financialSourceSnapshotKey(org, stored.e),
      expectedCsv.replace("10000", "10100"), "text/csv");
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(context(), {
      kind: "settlement", expected: stored.e, observed: stored.o,
    }, s3), ValidationError);
  });

  await check("LocalStack deletion and cross-tenant isolation fail closed", async () => {
    const stored = await scenario(s3, "missing-s3");
    await s3.deleteObject(financialSourceSnapshotKey(org, stored.e));
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(context(), {
      kind: "settlement", expected: stored.e, observed: stored.o,
    }, s3), NotFoundError);
    await assert.rejects(() => reconcilePinnedFinancialSourceSnapshots(context(org + "-other"), {
      kind: "settlement", expected: stored.e, observed: stored.o,
    }, s3), NotFoundError);
  });

  await check("S3 storage uses encrypted envelope, not CSV bytes", async () => {
    const stored = await scenario(s3, "ciphertext-s3");
    const raw = await new S3WireClient({
      bucket: config.bucket, region: config.region,
      accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
    }).getObject(financialSourceSnapshotKey(org, stored.e));
    assert(raw);
    assert(!raw.data.toString("utf8").includes("SETTLEMENT-001"));
    assert.equal(JSON.parse(raw.data.toString("utf8")).algorithm, "AES-256-GCM");
  });

  console.log("CORTEX FINANCIAL SOURCE BYTE INTEGRITY: 15/15 synthetic S3 and memory checks passed");
}

main().catch(error => {
  console.error("FINANCIAL SOURCE INTEGRITY GATE FAILED:", error);
  process.exitCode = 1;
});
