/**
 * Internal financial source verification.
 *
 * Ed25519 proves a manifest was signed by the PRIVATE KEY matching a pinned
 * public key. It does NOT prove the bank owns the key. That external binding
 * is a separate institution-approved onboarding and legal control.
 *
 * Object Lock in S3 is version-scoped; a locked version can coexist with a
 * newer version at the same key. Always read the pinned version, never latest.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { ConflictError, ValidationError } from "../../core/errors";
import type { FinancialSourceRegistryRecord, FinancialSourceSnapshotRecord } from "../../database/schema";
import { financialSourceSnapshotKey } from "./financialSourceIntegrityGate";
import type { S3VersionRetentionMetadata } from "../../infrastructure/s3/S3WireClient";

export interface SignedFinancialSourceManifest {
  schemaVersion: 1;
  organizationId: string;
  registryId: string;
  sourceReference: string;
  kind: "settlement" | "fee";
  role: "expected" | "observed";
  sha256: string;
  bytes: number;
  issuedAt: string;
  expiresAt: string;
}

export interface FinancialSignerInput {
  keyId: string;
  ed25519PublicKeySpkiDerBase64: string;
}
export type FinancialPinnedSigningKey = NonNullable<FinancialSourceRegistryRecord["signingKey"]>;

const HEX = /^[0-9a-f]{64}$/;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const DAY_MS = 86_400_000;
const MAX_MANIFEST_LIFETIME = 7 * DAY_MS;
const SIGNING_DOMAIN = "CORTEX-FINANCIAL-SOURCE-MANIFEST-V1\n";

function parseKey(der: string): { publicKey: KeyObject; raw: Buffer } {
  if (typeof der !== "string" || der.length > 160 ||
      !BASE64.test(der) || der.length < 32) {
    throw new ValidationError("Invalid pinned Ed25519 SPKI public key");
  }
  const raw = Buffer.from(der, "base64");
  if (raw.toString("base64") !== der || raw.length > 120) {
    throw new ValidationError("Pinned public key is not canonical DER");
  }
  try {
    const publicKey = createPublicKey({ key: raw, format: "der", type: "spki" });
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new ValidationError("Only Ed25519 source signing keys are allowed");
    }
    if (!publicKey.export({ format: "der", type: "spki" }).equals(raw)) {
      throw new ValidationError("Public key DER must be canonical");
    }
    return { publicKey, raw };
  } catch {
    throw new ValidationError("Invalid pinned Ed25519 SPKI public key");
  }
}

/** Explicit two-person approval still does NOT establish external bank ownership. */
export function pinFinancialSigner(input: FinancialSignerInput): FinancialPinnedSigningKey {
  if (!input || typeof input.keyId !== "string" || !OPAQUE.test(input.keyId)) {
    throw new ValidationError("Invalid source signing key ID");
  }
  const { raw } = parseKey(input.ed25519PublicKeySpkiDerBase64);
  return {
    keyId: input.keyId,
    ed25519PublicKeySpkiDerBase64: input.ed25519PublicKeySpkiDerBase64,
    keyFingerprintSha256: createHash("sha256").update(raw).digest("hex"),
    bankKeyOwnershipIndependentlyVerified: false,
  };
}

/** Canonical representation shared with a future signed bank/processor adapter. */
export function manifestSigningBytes(manifest: SignedFinancialSourceManifest): Buffer {
  if (!manifest || manifest.schemaVersion !== 1 ||
      typeof manifest.organizationId !== "string" ||
      typeof manifest.registryId !== "string" ||
      typeof manifest.sourceReference !== "string" ||
      !OPAQUE.test(manifest.organizationId) ||
      !/^[A-Za-z0-9_-]{8,90}$/.test(manifest.registryId) ||
      !OPAQUE.test(manifest.sourceReference) ||
      !["settlement", "fee"].includes(manifest.kind) ||
      !["expected", "observed"].includes(manifest.role) ||
      !HEX.test(manifest.sha256) ||
      !Number.isSafeInteger(manifest.bytes) ||
      manifest.bytes < 1 || manifest.bytes > 128 * 1024 ||
      typeof manifest.issuedAt !== "string" ||
      typeof manifest.expiresAt !== "string") {
    throw new ValidationError("Source manifest fields are invalid");
  }
  // Canonical UTC seconds only, so alternate textual timestamps cannot sign
  // the same event under a different representation.
  const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
  if (!ISO.test(manifest.issuedAt) || !ISO.test(manifest.expiresAt) ||
      !Number.isFinite(Date.parse(manifest.issuedAt)) ||
      !Number.isFinite(Date.parse(manifest.expiresAt))) {
    throw new ValidationError("Source manifest timestamps must be canonical UTC");
  }
  const fields = [
    "1", manifest.organizationId, manifest.registryId,
    manifest.sourceReference, manifest.kind, manifest.role,
    manifest.sha256, String(manifest.bytes),
    manifest.issuedAt, manifest.expiresAt,
  ];
  return Buffer.from(SIGNING_DOMAIN + fields.join("\n") + "\n", "utf8");
}

export interface ManifestCryptographicCheck {
  signatureValid: true;
  signerKeyId: string;
  signerKeyFingerprintSha256: string;
  manifestFingerprintSha256: string;
  bankKeyOwnershipIndependentlyVerified: false;
  sourceAuthenticityVerified: false;
}

export function verifyFinancialManifestSignature(
  manifest: SignedFinancialSourceManifest,
  signatureBase64: string,
  registry: FinancialSourceRegistryRecord,
  snapshot: FinancialSourceSnapshotRecord,
  now: Date = new Date()
): ManifestCryptographicCheck {
  if (registry.status !== "approved" || !registry.signingKey ||
      registry.organizationId !== snapshot.organizationId ||
      registry.id !== snapshot.sourceRegistryId ||
      manifest.organizationId !== snapshot.organizationId ||
      manifest.registryId !== registry.id ||
      manifest.sha256 !== snapshot.expectedSha256 ||
      manifest.bytes !== snapshot.expectedBytes ||
      manifest.kind !== snapshot.kind ||
      manifest.role !== snapshot.role ||
      registry.kind !== snapshot.kind || registry.role !== snapshot.role) {
    throw new ConflictError("Manifest does not match the approved tenant-bound source snapshot");
  }
  const payload = manifestSigningBytes(manifest);
  const issued = Date.parse(manifest.issuedAt);
  const expiry = Date.parse(manifest.expiresAt);
  if (issued > now.getTime() + 5 * 60_000 || expiry <= now.getTime() ||
      expiry <= issued || expiry - issued > MAX_MANIFEST_LIFETIME) {
    throw new ValidationError("Signed source manifest is expired or outside its allowed validity window");
  }
  if (typeof signatureBase64 !== "string" || signatureBase64.length !== 88 ||
      !BASE64.test(signatureBase64)) {
    throw new ValidationError("Invalid Ed25519 source signature");
  }
  const signature = Buffer.from(signatureBase64, "base64");
  if (signature.length !== 64 || signature.toString("base64") !== signatureBase64) {
    throw new ValidationError("Invalid canonical Ed25519 signature");
  }
  const key = pinFinancialSigner(registry.signingKey);
  if (registry.signingKey.keyFingerprintSha256 !== key.keyFingerprintSha256 ||
      registry.signingKey.bankKeyOwnershipIndependentlyVerified !== false) {
    throw new ValidationError("Pinned signing key metadata is inconsistent");
  }
  if (!verifySignature(null, payload, parseKey(key.ed25519PublicKeySpkiDerBase64).publicKey, signature)) {
    throw new ValidationError("Financial source manifest signature is invalid");
  }
  return {
    signatureValid: true,
    signerKeyId: key.keyId,
    signerKeyFingerprintSha256: key.keyFingerprintSha256,
    manifestFingerprintSha256: createHash("sha256").update(payload).digest("hex"),
    bankKeyOwnershipIndependentlyVerified: false,
    sourceAuthenticityVerified: false,
  };
}

export interface FinancialVersionedCustodyStorage {
  getObjectVersion(key: string, versionId: string): Promise<{ data: Buffer | string; mimeType: string } | null>;
  inspectObjectVersionRetention(key: string, versionId: string): Promise<S3VersionRetentionMetadata | null>;
}

export interface VersionRetentionCheck {
  exactVersionBytesMatched: true;
  s3VersionId: string;
  complianceModeObserved: true;
  retainUntil: string;
  checkedAt: string;
  /** Header evidence only; bank policy, bucket authority and WORM operations need separate review. */
  bankRetentionPolicyVerified: false;
  sourceAuthenticityVerified: false;
  financialLossAssessed: false;
}

export async function checkFinancialSnapshotObjectLock(
  organizationId: string,
  snapshot: FinancialSourceSnapshotRecord,
  storage: FinancialVersionedCustodyStorage,
  now: Date = new Date()
): Promise<VersionRetentionCheck> {
  if (snapshot.organizationId !== organizationId || !snapshot.storageVersionId ||
      snapshot.storageVersionId === "null" ||
      !/^[A-Za-z0-9+./=_-]{1,256}$/.test(snapshot.storageVersionId)) {
    throw new ConflictError("Financial snapshot has no pinned S3 object version for retention inspection");
  }
  const key = financialSourceSnapshotKey(organizationId, {
    sourceId: snapshot.sourceId,
    expectedSha256: snapshot.expectedSha256,
    expectedBytes: snapshot.expectedBytes,
  });
  const versionId = snapshot.storageVersionId;
  const details = await storage.inspectObjectVersionRetention(key, versionId);
  if (!details || details.versionId !== versionId || details.mode !== "COMPLIANCE" ||
      typeof details.retainUntil !== "string") {
    throw new ConflictError("Pinned financial source has no qualifying S3 COMPLIANCE retention evidence");
  }
  const until = Date.parse(details.retainUntil);
  if (!Number.isFinite(until) || until <= now.getTime() + DAY_MS) {
    throw new ConflictError("Pinned financial source retention is missing, expired or too short for inspection");
  }
  const bytes = await storage.getObjectVersion(key, versionId);
  if (!bytes || bytes.mimeType !== "text/csv") {
    throw new ConflictError("Pinned S3 source version cannot be read as a financial CSV");
  }
  const content = Buffer.isBuffer(bytes.data) ? bytes.data : Buffer.from(bytes.data, "utf8");
  if (content.length !== snapshot.expectedBytes ||
      createHash("sha256").update(content).digest("hex") !== snapshot.expectedSha256) {
    throw new ConflictError("Pinned S3 source version failed plaintext SHA-256 custody check");
  }
  const after = await storage.inspectObjectVersionRetention(key, versionId);
  if (!after || after.versionId !== versionId || after.mode !== "COMPLIANCE" ||
      after.retainUntil !== details.retainUntil) {
    throw new ConflictError("Pinned S3 retention metadata changed during custody check");
  }
  return {
    exactVersionBytesMatched: true,
    s3VersionId: versionId,
    complianceModeObserved: true,
    retainUntil: details.retainUntil,
    checkedAt: now.toISOString(),
    bankRetentionPolicyVerified: false,
    sourceAuthenticityVerified: false,
    financialLossAssessed: false,
  };
}
