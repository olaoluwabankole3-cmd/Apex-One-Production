/**
 * CORTEX — Financial-Institution Reconciliation Foundation (read-only).
 *
 * Deterministic comparisons of *already mapped* source lines. This module
 * does not ingest bank feeds, establish completeness, alter ledgers, publish
 * opportunities or certify financial evidence.
 */
import { createHash } from "node:crypto";
import type { TenantContext } from "../../core/errors";
import { ValidationError } from "../../core/errors";
import { requirePermission } from "../../core/security";

export type ReconciliationKind = "settlement" | "fee";
export type SourceRole = "expected" | "observed";

export interface FinancialSourceLine {
  organizationId: string;
  kind: ReconciliationKind;
  role: SourceRole;
  reference: string;
  currency: string;
  /** Integer minor units encoded as a canonical decimal string, never float. */
  amountMinor: string;
  /** IDs and hash are supplied source metadata; not independently verified. */
  sourceDocumentId: string;
  sourceRecordId: string;
  sourceSha256: string;
  recordedAt: string;
}

export interface FinancialReconciliationRequest {
  lines: readonly FinancialSourceLine[];
  /**
   * Completeness assertions must come from a future trusted import adapter.
   * The comparison engine cannot establish completeness independently.
   */
  declaredCoverage: {
    expectedFeedComplete: boolean;
    observedFeedComplete: boolean;
  };
  /** Optional nonnegative tolerances in each currency's own minor units. */
  toleranceMinorByCurrency?: Readonly<Record<string, string>>;
}

export type ComparisonStatus =
  | "balanced"
  | "amount_discrepancy"
  | "currency_mismatch"
  | "missing_expected"
  | "missing_observed"
  | "insufficient_source_coverage"
  | "ambiguous";

export interface FinancialSourceReference {
  role: SourceRole;
  sourceDocumentId: string;
  sourceRecordId: string;
  sourceSha256: string;
  recordedAt: string;
}

export interface ReconciliationCase {
  caseId: string;
  organizationId: string;
  kind: ReconciliationKind;
  reference: string;
  comparisonStatus: ComparisonStatus;
  currency: string | null;
  expectedAmountMinor: string | null;
  observedAmountMinor: string | null;
  /** Observed minus expected. Neither this nor its absolute value is a loss estimate. */
  differenceMinor: string | null;
  /** Always unverified until the authoritative evidence service makes a decision. */
  verificationState: "unverified";
  sourceReferences: FinancialSourceReference[];
  comparisonRule: "strict-reference-v1";
}

export interface ReconciliationResult {
  organizationId: string;
  comparedRecords: number;
  declaredCoverage: FinancialReconciliationRequest["declaredCoverage"];
  cases: ReconciliationCase[];
  /** The engine makes no claim about financial loss, savings or recovery. */
  financialLossAssessed: false;
}

const MONEY = /^(?:0|[1-9][0-9]{0,17}|-[1-9][0-9]{0,17})$/;
const NONNEGATIVE_MONEY = /^(?:0|[1-9][0-9]{0,17})$/;
const CURRENCY = /^[A-Z]{3}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;
const MAX_RECORDS = 2000;
const MAX_ID_LENGTH = 256;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || value.length > MAX_ID_LENGTH ||
      value.trim() !== value || /[\x00-\x1F\x7F]/.test(value)) {
    throw new ValidationError(`Invalid ${field}`);
  }
  return value;
}

function validateLine(value: unknown, index: number, organizationId: string): FinancialSourceLine {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`Invalid source line at index ${index}`);
  }
  const line = value as FinancialSourceLine;
  if (line.organizationId !== organizationId) {
    // Do not expose the source record or another organization's identity.
    throw new ValidationError("Source line is not part of the authenticated organization");
  }
  if (line.kind !== "settlement" && line.kind !== "fee") {
    throw new ValidationError("Unsupported reconciliation kind");
  }
  if (line.role !== "expected" && line.role !== "observed") {
    throw new ValidationError("Unsupported reconciliation source role");
  }
  requiredString(line.reference, "transaction reference");
  requiredString(line.sourceDocumentId, "source document identifier");
  requiredString(line.sourceRecordId, "source record identifier");
  if (typeof line.currency !== "string" || !CURRENCY.test(line.currency)) {
    throw new ValidationError("Currency must use a canonical three-letter uppercase code");
  }
  if (typeof line.amountMinor !== "string" || !MONEY.test(line.amountMinor)) {
    throw new ValidationError("Financial amount must be a canonical integer minor-unit string");
  }
  if (typeof line.sourceSha256 !== "string" || !SHA256.test(line.sourceSha256)) {
    throw new ValidationError("Source metadata must include a valid SHA-256 digest");
  }
  if (typeof line.recordedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(line.recordedAt) ||
      !Number.isFinite(Date.parse(line.recordedAt)) ||
      new Date(line.recordedAt).toISOString().slice(0, 19) !== line.recordedAt.slice(0, 19)) {
    throw new ValidationError("Source recordedAt must be a valid UTC timestamp");
  }
  return line;
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sourceReference(line: FinancialSourceLine): FinancialSourceReference {
  return {
    role: line.role,
    sourceDocumentId: line.sourceDocumentId,
    sourceRecordId: line.sourceRecordId,
    sourceSha256: line.sourceSha256.toLowerCase(),
    recordedAt: line.recordedAt,
  };
}

function normalizedTolerances(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Invalid reconciliation tolerance configuration");
  }
  const normalized: Record<string, string> = Object.create(null);
  for (const [currency, tolerance] of Object.entries(value)) {
    if (!CURRENCY.test(currency) || typeof tolerance !== "string" ||
        !NONNEGATIVE_MONEY.test(tolerance)) {
      throw new ValidationError("Tolerance must be a nonnegative integer in minor currency units");
    }
    normalized[currency] = tolerance;
  }
  return normalized;
}

/**
 * Requires authenticated `financial:read` even though it only compares lines
 * passed by the caller. A future persisted adapter must independently authorize
 * source access and validate batch provenance before invoking this engine.
 */
export function reconcileFinancialSourceLines(
  ctx: TenantContext,
  request: FinancialReconciliationRequest
): ReconciliationResult {
  requirePermission(ctx, "financial:read");
  if (!ctx.organizationId || typeof ctx.organizationId !== "string") {
    throw new ValidationError("Missing authorized organization");
  }
  if (!request || typeof request !== "object" ||
      !Array.isArray(request.lines) || request.lines.length > MAX_RECORDS) {
    throw new ValidationError("Reconciliation requires at most 2000 mapped source records");
  }
  const coverage = request.declaredCoverage;
  if (!coverage || typeof coverage.expectedFeedComplete !== "boolean" ||
      typeof coverage.observedFeedComplete !== "boolean") {
    throw new ValidationError("Both source coverage declarations are required");
  }
  const tolerances = normalizedTolerances(request.toleranceMinorByCurrency);
  const groups = new Map<string, { kind: ReconciliationKind; reference: string; lines: FinancialSourceLine[] }>();
  const seenIds = new Set<string>();
  for (const [index, raw] of request.lines.entries()) {
    const line = validateLine(raw, index, ctx.organizationId);
    const identifier = JSON.stringify([line.sourceDocumentId, line.sourceRecordId]);
    if (seenIds.has(identifier)) {
      throw new ValidationError("Duplicate source record identifier in reconciliation batch");
    }
    seenIds.add(identifier);
    const groupKey = JSON.stringify([line.kind, line.reference]);
    let group = groups.get(groupKey);
    if (!group) {
      group = { kind: line.kind, reference: line.reference, lines: [] };
      groups.set(groupKey, group);
    }
    group.lines.push(line);
  }

  const cases: ReconciliationCase[] = [];
  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    compareKeys(a.kind, b.kind) || compareKeys(a.reference, b.reference)
  );
  for (const group of sortedGroups) {
    const expected = group.lines.filter((line) => line.role === "expected");
    const observed = group.lines.filter((line) => line.role === "observed");
    const firstExpected = expected.length === 1 ? expected[0] : undefined;
    const firstObserved = observed.length === 1 ? observed[0] : undefined;

    let comparisonStatus: ComparisonStatus;
    let currency: string | null = null;
    let expectedAmountMinor: string | null = null;
    let observedAmountMinor: string | null = null;
    let differenceMinor: string | null = null;
    if (expected.length > 1 || observed.length > 1) {
      comparisonStatus = "ambiguous";
    } else if (!firstExpected) {
      comparisonStatus = coverage.expectedFeedComplete
        ? "missing_expected" : "insufficient_source_coverage";
    } else if (!firstObserved) {
      comparisonStatus = coverage.observedFeedComplete
        ? "missing_observed" : "insufficient_source_coverage";
    } else {
      expectedAmountMinor = firstExpected.amountMinor;
      observedAmountMinor = firstObserved.amountMinor;
      if (firstExpected.currency !== firstObserved.currency) {
        comparisonStatus = "currency_mismatch";
      } else {
        currency = firstExpected.currency;
        const delta = BigInt(observedAmountMinor) - BigInt(expectedAmountMinor);
        differenceMinor = delta.toString();
        const tolerance = BigInt(tolerances[currency] ?? "0");
        comparisonStatus = (delta < 0n ? -delta : delta) <= tolerance
          ? "balanced" : "amount_discrepancy";
      }
    }
    const sortedSources = group.lines
      .map(sourceReference)
      .sort((a, b) =>
        compareKeys(a.role, b.role) ||
        compareKeys(a.sourceDocumentId, b.sourceDocumentId) ||
        compareKeys(a.sourceRecordId, b.sourceRecordId)
      );
    cases.push({
      caseId: "recon-" + createHash("sha256")
        .update(JSON.stringify([ctx.organizationId, group.kind, group.reference]))
        .digest("hex")
        .slice(0, 32),
      organizationId: ctx.organizationId,
      kind: group.kind,
      reference: group.reference,
      comparisonStatus,
      currency,
      expectedAmountMinor,
      observedAmountMinor,
      differenceMinor,
      verificationState: "unverified",
      sourceReferences: sortedSources,
      comparisonRule: "strict-reference-v1",
    });
  }
  return {
    organizationId: ctx.organizationId,
    comparedRecords: request.lines.length,
    declaredCoverage: {
      expectedFeedComplete: coverage.expectedFeedComplete,
      observedFeedComplete: coverage.observedFeedComplete,
    },
    cases,
    financialLossAssessed: false,
  };
}
