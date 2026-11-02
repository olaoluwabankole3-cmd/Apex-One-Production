/**
 * Synthetic, offline tests: signature verification and version-scoped
 * compliance retention. No live bank signing keys, no external data.
 */
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import type { FinancialSourceRegistryRecord, FinancialSourceSnapshotRecord } from "../lib/backend/database/schema";
import {
  pinFinancialSigner, manifestSigningBytes, verifyFinancialManifestSignature,
  checkFinancialSnapshotObjectLock,
  type SignedFinancialSourceManifest,
  type FinancialVersionedCustodyStorage,
} from "../lib/backend/domains/reconciliation/financialSourceProvenanceGate";

const now = new Date("2026-11-02T14:00:00Z");
const csv = Buffer.from(
  "reference,currency,amount_minor,record_id,recorded_at\nSETTLEMENT-1,NGN,10000,src-ref-1,2026-11-02T08:00:00Z\n",
  "utf8"
);
const digest = createHash("sha256").update(csv).digest("hex");
const org = "synthetic-bank-a";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const der = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const key = pinFinancialSigner({ keyId: "issuer-key-001", ed25519PublicKeySpkiDerBase64: der });
const registry: FinancialSourceRegistryRecord = {
  id: "registry00000001", organizationId: org, sourceLabel: "synthetic-expected",
  kind: "settlement", role: "expected", status: "approved",
  createdByUserId: "operator", createdAt: now.toISOString(),
  reviewedByUserId: "checker", reviewedAt: now.toISOString(),
  reviewReason: "Synthetic test approval",
  revision: 2, updatedAt: now.toISOString(),
  externalSourceAuthorityVerified: false, signingKey: key,
};
const snapshot: FinancialSourceSnapshotRecord = {
  id: "snapshot00000001", organizationId: org,
  sourceRegistryId: registry.id, kind: "settlement", role: "expected",
  sourceId: "snapshot-registered01", expectedSha256: digest,
  expectedBytes: csv.length, rowCount: 1, recordedByUserId: "operator",
  createdAt: now.toISOString(), encryption: "AES-256-GCM",
  byteIntegrityCheckedAtIntake: true, storageVersionId: "version-verified.1",
  storageImmutabilityVerified: false, sourceAuthenticityVerified: false,
  coverageVerified: false, financialLossAssessed: false,
};
const manifest: SignedFinancialSourceManifest = {
  schemaVersion: 1, organizationId: org, registryId: registry.id,
  sourceReference: "opaque-settlement-run-01",
  kind: "settlement", role: "expected",
  sha256: digest, bytes: csv.length,
  issuedAt: "2026-11-02T12:00:00Z", expiresAt: "2026-11-04T12:00:00Z",
};
function signature(value: SignedFinancialSourceManifest): string {
  return sign(null, manifestSigningBytes(value), privateKey).toString("base64");
}
const rejects = async (task: () => Promise<unknown>, expected: RegExp) =>
  assert.rejects(task, expected);

async function main(): Promise<void> {
  const signatureBase64 = signature(manifest);
  const passed = verifyFinancialManifestSignature(manifest, signatureBase64, registry, snapshot, now);
  assert.equal(passed.signatureValid, true);
  assert.equal(passed.sourceAuthenticityVerified, false);
  assert.equal(passed.bankKeyOwnershipIndependentlyVerified, false);
  assert.equal(passed.signerKeyFingerprintSha256, key.keyFingerprintSha256);

  const check = (m: SignedFinancialSourceManifest, sig = signatureBase64,
    source = registry, entry = snapshot, time = now) =>
    verifyFinancialManifestSignature(m, sig, source, entry, time);
  assert.throws(() => check({ ...manifest, organizationId: "synthetic-bank-b" }), /does not match|invalid/i);
  assert.throws(() => check({ ...manifest, sha256: "f".repeat(64) }), /does not match/i);
  assert.throws(() => check({ ...manifest, bytes: csv.length + 1 }), /does not match/i);
  assert.throws(() => check({ ...manifest, role: "observed" }), /does not match/i);
  assert.throws(() => check({ ...manifest, sourceReference: "another-ref" }), /signature is invalid/i);
  assert.throws(() => check(manifest, signatureBase64.slice(0, -4) + "AAAA"), /signature is invalid|canonical/i);
  assert.throws(() => check(manifest, signatureBase64,
    { ...registry, status: "rejected" }), /does not match/i);
  assert.throws(() => check(manifest, signatureBase64,
    { ...registry, signingKey: undefined }), /does not match/i);
  assert.throws(() => check(manifest, signatureBase64,
    { ...registry, signingKey: { ...key, keyFingerprintSha256: "0".repeat(64) } }), /inconsistent/i);
  assert.throws(() => check(manifest, signatureBase64, registry, snapshot,
    new Date("2026-11-05T00:00:00Z")), /expired/i);
  assert.throws(() => check({ ...manifest, expiresAt: "2026-12-02T00:00:00Z" },
    signatureBase64), /validity window/i);
  const { publicKey: rsa } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() => pinFinancialSigner({
    keyId: "rsa-not-accepted",
    ed25519PublicKeySpkiDerBase64: rsa.export({ type: "spki", format: "der" }).toString("base64"),
  }), /Invalid|Ed25519/i);

  let mode = "COMPLIANCE";
  let retainUntil = "2026-11-12T14:00:00Z";
  let versionId = snapshot.storageVersionId!;
  let stored = Buffer.from(csv);
  let headerReads = 0;
  const fakeStorage: FinancialVersionedCustodyStorage = {
    async inspectObjectVersionRetention(_key, requestedVersion) {
      headerReads += 1;
      return {
        versionId: versionId === requestedVersion ? versionId : versionId,
        mode, retainUntil,
      };
    },
    async getObjectVersion(_key, requestedVersion) {
      if (requestedVersion !== snapshot.storageVersionId) return null;
      return { data: Buffer.from(stored), mimeType: "text/csv" };
    },
  };
  const passedRetention = await checkFinancialSnapshotObjectLock(org, snapshot, fakeStorage, now);
  assert.equal(passedRetention.exactVersionBytesMatched, true);
  assert.equal(passedRetention.complianceModeObserved, true);
  assert.equal(passedRetention.bankRetentionPolicyVerified, false);
  assert.equal(passedRetention.sourceAuthenticityVerified, false);
  assert.equal(headerReads, 2);

  mode = "GOVERNANCE";
  await rejects(() => checkFinancialSnapshotObjectLock(org, snapshot, fakeStorage, now), /COMPLIANCE/i);
  mode = "COMPLIANCE";
  retainUntil = "2026-11-02T16:00:00Z";
  await rejects(() => checkFinancialSnapshotObjectLock(org, snapshot, fakeStorage, now), /too short/i);
  retainUntil = "2026-11-12T14:00:00Z";
  versionId = "new-version-that-is-not-locked";
  await rejects(() => checkFinancialSnapshotObjectLock(org, snapshot, fakeStorage, now), /no qualifying/i);
  versionId = snapshot.storageVersionId!;
  stored = Buffer.from(csv.toString("utf8").replace("10000", "11000"), "utf8");
  await rejects(() => checkFinancialSnapshotObjectLock(org, snapshot, fakeStorage, now), /SHA-256 custody check/i);
  stored = csv;
  await rejects(() => checkFinancialSnapshotObjectLock("synthetic-bank-b", snapshot, fakeStorage, now), /no pinned/i);
  await rejects(() => checkFinancialSnapshotObjectLock(org,
    { ...snapshot, storageVersionId: undefined }, fakeStorage, now), /no pinned/i);
  await rejects(() => checkFinancialSnapshotObjectLock(org,
    { ...snapshot, storageVersionId: "null" }, fakeStorage, now), /no pinned/i);
  const changedDuringRead: FinancialVersionedCustodyStorage = {
    ...fakeStorage,
    async inspectObjectVersionRetention(_key, requestedVersion) {
      headerReads += 1;
      return { versionId: requestedVersion, mode: "COMPLIANCE",
        retainUntil: headerReads % 2 === 0 ? "2026-11-14T14:00:00Z" : "2026-11-12T14:00:00Z" };
    },
  };
  headerReads = 0;
  await rejects(() => checkFinancialSnapshotObjectLock(org, snapshot, changedDuringRead, now), /changed during custody check/i);

  console.log("PASS: Ed25519 canonical manifest signature, source/tenant/time binding, missing authority, version-specific S3 COMPLIANCE headers, tamper and stale version fail-closed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
