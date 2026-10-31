/**
 * CORTEX — isolated, synthetic financial reconciliation foundation tests.
 * No AWS, database, authentication tokens, or live bank account required.
 */
import assert from "node:assert/strict";
import type { TenantContext } from "../lib/backend/core/errors";
import { ForbiddenError, ValidationError } from "../lib/backend/core/errors";
import {
  reconcileFinancialSourceLines,
  type FinancialSourceLine,
  type FinancialReconciliationRequest,
  type ReconciliationCase,
} from "../lib/backend/domains/reconciliation/settlementExceptionEngine";

const ORG = "org-synthetic-bank-a";
const SHA = "a".repeat(64);
const TIME = "2026-10-31T10:00:00Z";

function context(organizationId = ORG, permissions = ["financial:read"]): TenantContext {
  return {
    organizationId, userId: "synthetic-auditor", userEmail: "auditor@example.invalid",
    userRole: "Compliance", permissions, requestId: "synthetic-recon-check", timestamp: TIME,
  };
}

function line(role: "expected" | "observed", overrides: Partial<FinancialSourceLine> = {}): FinancialSourceLine {
  return {
    organizationId: ORG,
    kind: "settlement",
    role,
    reference: "SETTLE-TEST-0001",
    currency: "NGN",
    amountMinor: role === "expected" ? "10001" : "10001",
    sourceDocumentId: role === "expected" ? "ledger-export-01" : "provider-export-01",
    sourceRecordId: "row-001",
    sourceSha256: SHA,
    recordedAt: TIME,
    ...overrides,
  };
}

function request(lines: readonly FinancialSourceLine[],
  coverage: FinancialReconciliationRequest["declaredCoverage"] = {
    expectedFeedComplete: true, observedFeedComplete: true,
  },
  toleranceMinorByCurrency?: Readonly<Record<string, string>>): FinancialReconciliationRequest {
  return { lines, declaredCoverage: coverage, toleranceMinorByCurrency };
}

function single(lines: readonly FinancialSourceLine[],
  options?: { expectedFeedComplete: boolean; observedFeedComplete: boolean },
  tolerances?: Readonly<Record<string, string>>): ReconciliationCase {
  const result = reconcileFinancialSourceLines(context(), request(lines, options, tolerances));
  assert.equal(result.cases.length, 1, "exactly one case expected");
  assert.equal(result.financialLossAssessed, false);
  assert.equal(result.cases[0].verificationState, "unverified");
  return result.cases[0];
}

function rejects(data: FinancialReconciliationRequest, error: new (...args: any[]) => Error = ValidationError,
  ctx: TenantContext = context()): void {
  assert.throws(() => reconcileFinancialSourceLines(ctx, data), error);
}

const checks: Array<[string, () => void]> = [
  ["same-source reference and exact minor-unit amount balances", () => {
    const c = single([line("expected"), line("observed")]);
    assert.equal(c.comparisonStatus, "balanced");
    assert.equal(c.currency, "NGN");
    assert.equal(c.differenceMinor, "0");
    assert.equal(c.sourceReferences.length, 2);
  }],
  ["settlement difference is a candidate exception, not an assessed loss", () => {
    const result = reconcileFinancialSourceLines(context(),
      request([line("expected"), line("observed", { amountMinor: "9001" })]));
    assert.equal(result.cases[0].comparisonStatus, "amount_discrepancy");
    assert.equal(result.cases[0].differenceMinor, "-1000");
    assert.equal(result.financialLossAssessed, false);
    assert.equal(result.cases[0].verificationState, "unverified");
  }],
  ["fee record discrepancy is supported without inventing contract fee calculations", () => {
    const c = single([
      line("expected", { kind: "fee", amountMinor: "125", reference: "FEE-0001" }),
      line("observed", { kind: "fee", amountMinor: "150", reference: "FEE-0001" }),
    ]);
    assert.equal(c.kind, "fee");
    assert.equal(c.comparisonStatus, "amount_discrepancy");
    assert.equal(c.differenceMinor, "25");
  }],
  ["missing observed row is separate from amount discrepancy", () => {
    const c = single([line("expected")]);
    assert.equal(c.comparisonStatus, "missing_observed");
    assert.equal(c.observedAmountMinor, null);
  }],
  ["missing expected row is separate from amount discrepancy", () => {
    const c = single([line("observed")]);
    assert.equal(c.comparisonStatus, "missing_expected");
  }],
  ["incomplete observed feed must not imply missing money", () => {
    const c = single([line("expected")],
      { expectedFeedComplete: true, observedFeedComplete: false });
    assert.equal(c.comparisonStatus, "insufficient_source_coverage");
  }],
  ["incomplete expected feed must not imply an exception", () => {
    const c = single([line("observed")],
      { expectedFeedComplete: false, observedFeedComplete: true });
    assert.equal(c.comparisonStatus, "insufficient_source_coverage");
  }],
  ["currency mismatches never calculate cross-currency delta", () => {
    const c = single([line("expected"), line("observed", { currency: "USD" })]);
    assert.equal(c.comparisonStatus, "currency_mismatch");
    assert.equal(c.currency, null);
    assert.equal(c.differenceMinor, null);
  }],
  ["separate currencies never produce a universal total", () => {
    const result = reconcileFinancialSourceLines(context(), request([
      line("expected"), line("observed"),
      line("expected", { reference: "SETTLE-USD", currency: "USD", sourceRecordId: "row-002" }),
      line("observed", { reference: "SETTLE-USD", currency: "USD", sourceRecordId: "row-002" }),
    ]));
    assert.deepEqual(result.cases.map(c => c.currency), ["NGN", "USD"]);
    assert.equal(result.financialLossAssessed, false);
    assert.equal("totalLoss" in result, false);
  }],
  ["duplicate economic references require human disambiguation", () => {
    const c = single([
      line("expected"),
      line("expected", { sourceDocumentId: "ledger-export-02", sourceRecordId: "row-009" }),
      line("observed"),
    ]);
    assert.equal(c.comparisonStatus, "ambiguous");
    assert.equal(c.differenceMinor, null);
    assert.equal(c.expectedAmountMinor, null);
  }],
  ["replayed source record identifier fails closed", () => {
    rejects(request([line("expected"), line("expected")]));
  }],
  ["source record from another organization is rejected", () => {
    rejects(request([line("expected", { organizationId: "org-synthetic-bank-b" })]));
  }],
  ["organization context cannot bypass financial:read capability", () => {
    rejects(request([line("expected")]), ForbiddenError, context(ORG, ["org:read"]));
  }],
  ["absent authorized organization fails closed", () => {
    rejects(request([line("expected")]), ValidationError, context(""));
  }],
  ["minor-unit precision has no floating-point rounding", () => {
    const c = single([
      line("expected", { amountMinor: "999999999999999999" }),
      line("observed", { amountMinor: "999999999999999998" }),
    ]);
    assert.equal(c.differenceMinor, "-1");
  }],
  ["signed minor units are compared exactly", () => {
    const c = single([
      line("expected", { amountMinor: "-500" }),
      line("observed", { amountMinor: "-495" }),
    ]);
    assert.equal(c.differenceMinor, "5");
    assert.equal(c.comparisonStatus, "amount_discrepancy");
  }],
  ["approved same-currency minor-unit tolerance is deterministic", () => {
    const c = single([
      line("expected", { amountMinor: "101" }),
      line("observed", { amountMinor: "102" }),
    ], undefined, { NGN: "1" });
    assert.equal(c.comparisonStatus, "balanced");
    assert.equal(c.differenceMinor, "1");
  }],
  ["tolerance is currency-specific", () => {
    const c = single([
      line("expected", { amountMinor: "101", currency: "USD" }),
      line("observed", { amountMinor: "102", currency: "USD" }),
    ], undefined, { NGN: "2" });
    assert.equal(c.comparisonStatus, "amount_discrepancy");
  }],
  ["invalid or negative tolerance is rejected", () => {
    rejects(request([line("expected")], undefined, { NGN: "-1" }));
    rejects(request([line("expected")], undefined, { ngn: "2" }));
    rejects(request([line("expected")], undefined, { NGN: "1.0" }));
  }],
  ["noncanonical financial decimals and unsafe precision are rejected", () => {
    for (const amountMinor of ["1.01", "01", "-0", "1e3", "1,000", "", "1000000000000000000"]) {
      rejects(request([line("expected", { amountMinor })]));
    }
  }],
  ["inconsistent or unsupported currency codes fail closed", () => {
    for (const currency of ["ngn", "NG", "NGNN", "NG1"]) {
      rejects(request([line("expected", { currency })]));
    }
  }],
  ["source digest must look like SHA-256 metadata", () => {
    rejects(request([line("expected", { sourceSha256: "unverified-file" })]));
  }],
  ["provenance requires document and source record ids", () => {
    rejects(request([line("expected", { sourceDocumentId: "" })]));
    rejects(request([line("expected", { sourceRecordId: "" })]));
  }],
  ["unusable timestamps are rejected", () => {
    rejects(request([line("expected", { recordedAt: "tomorrow" })]));
    rejects(request([line("expected", { recordedAt: "2026-02-30T00:00:00Z" })]));
    rejects(request([line("expected", { recordedAt: "2026-01-01T00:00:00+02:00" })]));
  }],
  ["absent coverage declaration cannot produce a missing-source exception", () => {
    rejects({ lines: [line("expected")] } as unknown as FinancialReconciliationRequest);
  }],
  ["invalid role and kind are rejected before comparison", () => {
    rejects(request([line("expected", { role: "unclassified" as any })]));
    rejects(request([line("expected", { kind: "fraud" as any })]));
  }],
  ["case identifiers and provenance order do not depend on input permutation", () => {
    const expected = line("expected");
    const observed = line("observed");
    const a = single([expected, observed]);
    const b = single([observed, expected]);
    assert.deepEqual(a, b);
    assert.match(a.caseId, /^recon-[a-f0-9]{32}$/);
  }],
  ["different organizations cannot reuse an exception case identifier", () => {
    const a = single([line("expected")]);
    const b = reconcileFinancialSourceLines(context("org-synthetic-bank-b"), request([
      line("expected", { organizationId: "org-synthetic-bank-b" }),
    ]));
    assert.notEqual(a.caseId, b.cases[0].caseId);
  }],
  ["same reference for fee and settlement remains separate cases", () => {
    const result = reconcileFinancialSourceLines(context(), request([
      line("expected"), line("observed"),
      line("expected", { kind: "fee", sourceRecordId: "fee-row" }),
      line("observed", { kind: "fee", sourceRecordId: "fee-row" }),
    ]));
    assert.equal(result.cases.length, 2);
    assert.deepEqual(result.cases.map(c => c.kind), ["fee", "settlement"]);
  }],
  ["empty feed never silently asserts zero verified loss", () => {
    const result = reconcileFinancialSourceLines(context(), request([]));
    assert.equal(result.cases.length, 0);
    assert.equal(result.financialLossAssessed, false);
  }],
  ["declared coverage flags must be booleans", () => {
    rejects(request([line("expected")], { expectedFeedComplete: "yes" as any, observedFeedComplete: true }));
  }],
  ["batch size is bounded", () => {
    rejects(request(Array.from({ length: 2001 }, (_, i) =>
      line("expected", { sourceRecordId: String(i) }))));
  }],
];

let failures = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL: ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`CORTEX — FINANCIAL RECONCILIATION FOUNDATION: ${checks.length - failures}/${checks.length} tests passed`);
if (failures) process.exit(1);
