/**
 * CORTEX — read-only byte-integrity gate for financial source snapshots.
 *
 * This is an INTERNAL foundation, not bank-source authentication. The caller
 * must eventually obtain expected digests from an independently validated
 * institution-approved source registry, NOT an HTTP client.
 *
 * Verifies that the bytes read at this instant match the pinned digest, not
 * S3 object immutability, source identity, completeness, or monetary evidence.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "../../core/errors";
import { ValidationError, NotFoundError } from "../../core/errors";
import { requirePermission } from "../../core/security";
import {
  type IObjectStorageService,
  S3CompatibleObjectStorageService,
} from "../documents/documentStorage";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { isProductionInfrastructureEnvironment } from "../../infrastructure/runtime";
import {
  prepareFinancialCsvPreview,
  type CsvPreviewResult,
} from "./csvPreviewService";
import type { ReconciliationKind } from "./settlementExceptionEngine";

const DIGEST = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MAX_FINANCIAL_CSV_BYTES = 128 * 1024;
const MIME = "text/csv";

export interface FinancialSourceSnapshotDescriptor {
  /** Opaque source ID, not a transaction, account or customer identifier. */
  sourceId: string;
  /** Digest independently pinned by a FUTURE trusted ingestion authority. */
  expectedSha256: string;
  expectedBytes: number;
}

export interface FinancialSourceReadRequest {
  kind: ReconciliationKind;
  expected: FinancialSourceSnapshotDescriptor;
  observed: FinancialSourceSnapshotDescriptor;
  toleranceMinorByCurrency?: Readonly<Record<string, string>>;
}

export interface FinancialSourceSnapshotCheck {
  sourceId: string;
  sha256: string;
  bytes: number;
  /** True only for the exact stored bytes returned by this read. */
  bytesMatchedPinnedDigest: true;
  /** Source object may still be overwritten between independent reads. */
  storageImmutabilityVerified: false;
  /** Pinned digest is NOT independent bank-origin authentication. */
  sourceAuthenticityVerified: false;
}

export interface FinancialStoredSourceReadResult {
  previewOnly: true;
  contentIntegrityChecked: true;
  storageImmutabilityVerified: false;
  sourceAuthenticityVerified: false;
  coverageVerified: false;
  financialLossAssessed: false;
  checkedAt: string;
  snapshots: {
    expected: FinancialSourceSnapshotCheck;
    observed: FinancialSourceSnapshotCheck;
  };
  preview: CsvPreviewResult;
}

function orgScope(organizationId: string): string {
  if (!organizationId || typeof organizationId !== "string") {
    throw new ValidationError("Missing authenticated organization for source storage");
  }
  return createHash("sha256").update(organizationId).digest("hex").slice(0, 32);
}

function assertDescriptor(value: FinancialSourceSnapshotDescriptor): void {
  if (!value || typeof value !== "object" ||
      typeof value.sourceId !== "string" ||
      typeof value.expectedSha256 !== "string" ||
      typeof value.expectedBytes !== "number" ||
      !SOURCE_ID.test(value.sourceId) ||
      !DIGEST.test(value.expectedSha256) ||
      !Number.isSafeInteger(value.expectedBytes) ||
      value.expectedBytes <= 0 || value.expectedBytes > MAX_FINANCIAL_CSV_BYTES) {
    throw new ValidationError("Invalid pinned financial source snapshot descriptor");
  }
}

/**
 * Tenant-scoped, content-addressed logical location. A SHA in a key is NOT
 * S3 Object Lock; this key can be overwritten by storage with write permission.
 */
export function financialSourceSnapshotKey(
  organizationId: string,
  descriptor: FinancialSourceSnapshotDescriptor
): string {
  assertDescriptor(descriptor);
  return `tenants/${orgScope(organizationId)}/financial-sources/${descriptor.expectedSha256}/${descriptor.sourceId}.csv`;
}

function binaryPayload(value: Buffer | string): Buffer {
  return Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "utf8");
}

async function readAndCheck(
  ctx: TenantContext,
  store: IObjectStorageService,
  descriptor: FinancialSourceSnapshotDescriptor
): Promise<{ contents: string; check: FinancialSourceSnapshotCheck }> {
  const key = financialSourceSnapshotKey(ctx.organizationId, descriptor);
  const object = await store.getObject(key);
  if (!object) throw new NotFoundError("Financial source snapshot");
  if (object.mimeType !== MIME) {
    throw new ValidationError("Stored financial source has incorrect MIME type");
  }
  const data = binaryPayload(object.data);
  if (data.length !== descriptor.expectedBytes ||
      data.length === 0 || data.length > MAX_FINANCIAL_CSV_BYTES) {
    throw new ValidationError("Stored financial source byte count differs from pinned snapshot");
  }
  const digest = createHash("sha256").update(data).digest();
  const expected = Buffer.from(descriptor.expectedSha256, "hex");
  if (digest.length !== expected.length || !timingSafeEqual(digest, expected)) {
    throw new ValidationError("Stored financial source SHA-256 differs from pinned snapshot");
  }
  // Reject invalid UTF-8 rather than replacement-decoding financial references.
  let contents: string;
  try {
    contents = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new ValidationError("Stored financial CSV must be valid UTF-8");
  }
  return {
    contents,
    check: {
      sourceId: descriptor.sourceId,
      sha256: descriptor.expectedSha256,
      bytes: descriptor.expectedBytes,
      bytesMatchedPinnedDigest: true,
      storageImmutabilityVerified: false,
      sourceAuthenticityVerified: false,
    },
  };
}

/**
 * Read two already-present encrypted source snapshots. No writes or deletes,
 * no new public endpoint, no financial case registration or certification.
 *
 * Proof boundary: byte integrity is checked *at read time*. The manifest's
 * authenticity and S3 object-lock retention MUST be verified separately before
 * a caller may say the source came from a bank or switching processor.
 */
export async function reconcilePinnedFinancialSourceSnapshots(
  ctx: TenantContext,
  request: FinancialSourceReadRequest,
  injectedStorage?: IObjectStorageService
): Promise<FinancialStoredSourceReadResult> {
  requirePermission(ctx, "financial:read");
  requirePermission(ctx, "financial:write");
  if (!request || typeof request !== "object" ||
      (request.kind !== "settlement" && request.kind !== "fee")) {
    throw new ValidationError("Unsupported financial source read request");
  }
  assertDescriptor(request.expected);
  assertDescriptor(request.observed);
  if (request.expected.sourceId === request.observed.sourceId ||
      request.expected.expectedSha256 === request.observed.expectedSha256) {
    throw new ValidationError("Expected and observed source snapshots must be distinct");
  }
  const store = injectedStorage ?? createApplicationInfrastructure().objectStorage;
  if (isProductionInfrastructureEnvironment(process.env) &&
      !(store instanceof S3CompatibleObjectStorageService)) {
    throw new ValidationError("Financial source reads require encrypted S3 storage in production");
  }
  const expected = await readAndCheck(ctx, store, request.expected);
  const observed = await readAndCheck(ctx, store, request.observed);
  // Strict CSV parser and deterministic comparator can only assert a
  // request-scoped preview; no coverage or financial recovery assumptions.
  const preview = prepareFinancialCsvPreview(ctx, {
    kind: request.kind,
    expected: { feedId: request.expected.sourceId, csv: expected.contents },
    observed: { feedId: request.observed.sourceId, csv: observed.contents },
    ...(request.toleranceMinorByCurrency === undefined ? {} :
      { toleranceMinorByCurrency: request.toleranceMinorByCurrency }),
  });
  // prepareFinancialCsvPreview requires write as well as read permission to
  // accept CSV. This internal path intentionally retains that requirement;
  // financial:read alone cannot invoke the existing parsing operator workflow.
  if (preview.feedSummaries[0].sha256 !== request.expected.expectedSha256 ||
      preview.feedSummaries[1].sha256 !== request.observed.expectedSha256) {
    throw new ValidationError("Parsed source digest did not match pinned financial snapshot");
  }
  return {
    previewOnly: true,
    contentIntegrityChecked: true,
    storageImmutabilityVerified: false,
    sourceAuthenticityVerified: false,
    coverageVerified: false,
    financialLossAssessed: false,
    checkedAt: new Date().toISOString(),
    snapshots: {
      expected: expected.check,
      observed: observed.check,
    },
    preview,
  };
}
