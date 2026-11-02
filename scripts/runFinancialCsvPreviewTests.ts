/**
 * CORTEX — bounded CSV financial preview regression suite.
 * Runs on synthetic values without bank connectors, AWS or DB credentials.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { TenantContext } from "../lib/backend/core/errors";
import { ForbiddenError, ValidationError } from "../lib/backend/core/errors";
import { prepareFinancialCsvPreview, validateFinancialCsvForInternalIntake, type CsvPreviewRequest } from "../lib/backend/domains/reconciliation/csvPreviewService";
import { getPermissionsForRole } from "../lib/backend/core/security";

const HEAD = "reference,currency,amount_minor,record_id,recorded_at\n";
const RECORD = "TEST-001,NGN,10001,entry-01,2026-10-31T10:00:00Z\n";
const EXPECTED = HEAD + RECORD;
const OBSERVED = HEAD + "TEST-001,NGN,10000,entry-11,2026-10-31T10:00:01Z\n";
const sha = (value: string) => createHash("sha256").update(Buffer.from(value)).digest("hex");

function context(organizationId = "synthetic-bank-1",
  permissions = ["financial:read", "financial:write"]): TenantContext {
  return {
    organizationId, userId: "synthetic-operator", userEmail: "operator@example.invalid",
    userRole: "Administrator", permissions, requestId: "synthetic-csv-review",
    timestamp: "2026-10-31T11:00:00Z",
  };
}
function request(expected = EXPECTED, observed = OBSERVED): CsvPreviewRequest {
  return {
    kind: "settlement",
    expected: { feedId: "ledger-01", csv: expected },
    observed: { feedId: "provider-01", csv: observed },
  };
}
function rejects(input: unknown, ctx = context(), ctor: new (...args: any[]) => Error = ValidationError) {
  assert.throws(() => prepareFinancialCsvPreview(ctx, input), ctor);
}
const checks: Array<[string, () => void]> = [
  ["maps two user-supplied sources and computes a minor-unit difference", () => {
    const result = prepareFinancialCsvPreview(context(), request());
    assert.equal(result.previewOnly, true);
    assert.equal(result.sourceStored, false);
    assert.equal(result.coverageVerified, false);
    assert.equal(result.reconciliation.financialLossAssessed, false);
    assert.equal(result.reconciliation.comparedRecords, 2);
    assert.equal(result.reconciliation.cases[0].differenceMinor, "-1");
    assert.equal(result.reconciliation.cases[0].verificationState, "unverified");
  }],
  ["server SHA-256 is calculated from the exact supplied CSV", () => {
    const result = prepareFinancialCsvPreview(context(), request());
    assert.equal(result.feedSummaries[0].sha256, sha(EXPECTED));
    assert.equal(result.feedSummaries[1].sha256, sha(OBSERVED));
    assert.equal(result.sourceIntegrity, "request_digest_only");
    assert.equal(result.reconciliation.cases[0].sourceReferences[0].sourceSha256.length, 64);
  }],
  ["missing observed rows remain insufficient coverage, never proven missing", () => {
    const result = prepareFinancialCsvPreview(context(), request(EXPECTED,
      HEAD + "OTHER-001,NGN,900,entry-33,2026-10-31T10:00:00Z\n"));
    assert.deepEqual(result.reconciliation.declaredCoverage,
      { expectedFeedComplete: false, observedFeedComplete: false });
    assert(result.reconciliation.cases.every(c => c.comparisonStatus === "insufficient_source_coverage"));
  }],
  ["untrusted caller cannot assert verified feed completeness", () => {
    rejects({ ...request(), declaredCoverage: { expectedFeedComplete: true, observedFeedComplete: true } });
  }],
  ["untrusted caller cannot supply organization ID or certification", () => {
    rejects({ ...request(), organizationId: "another-tenant" });
    rejects({ ...request(), verificationState: "verified" });
  }],
  ["untrusted caller cannot provide source digest in feed", () => {
    rejects({ ...request(), expected: { ...request().expected, sha256: "0".repeat(64) } });
  }],
  ["read-only access alone cannot submit a CSV financial preview", () => {
    rejects(request(), context("synthetic-bank-1", ["financial:read"]), ForbiddenError);
  }],
  ["financial-write privilege without read cannot run a comparison", () => {
    rejects(request(), context("synthetic-bank-1", ["financial:write"]), ForbiddenError);
  }],
  ["Finance may compare synthetic inputs without financial-write authority", () => {
    const finance = getPermissionsForRole("Finance");
    assert(finance.includes("financial:read") && finance.includes("financial:preview"));
    assert(!finance.includes("financial:write"), "Finance must never inherit broad financial writing");
    const result = prepareFinancialCsvPreview(context("synthetic-bank-1", [...finance]), request());
    assert.equal(result.reconciliation.cases[0].comparisonStatus, "amount_discrepancy");
    assert.equal(result.sourceStored, false);
    assert.equal(result.reconciliation.financialLossAssessed, false);
  }],
  ["preview rights cannot bypass financial source-intake write checks", () => {
    const finance = getPermissionsForRole("Finance");
    assert.throws(() => validateFinancialCsvForInternalIntake(
      context("synthetic-bank-1", [...finance]), "settlement", "expected", request().expected
    ), ForbiddenError);
    assert(!getPermissionsForRole("Compliance").includes("financial:preview"));
    rejects(request(), context("synthetic-bank-1", [...getPermissionsForRole("Compliance")]), ForbiddenError);
  }],
  ["scoped preview permission without financial read cannot compare", () => {
    rejects(request(), context("synthetic-bank-1", ["financial:preview"]), ForbiddenError);
  }],
  ["unrecognized kind and unsupported body fields are rejected", () => {
    rejects({ ...request(), kind: "fraud" });
    rejects({ ...request(), execute: true });
  }],
  ["empty/invalid feeds are rejected", () => {
    rejects(request("", OBSERVED));
    rejects(request("unrelated-csv", OBSERVED));
    rejects(request(HEAD, OBSERVED));
  }],
  ["correct required column order is enforced", () => {
    rejects(request("amount_minor,reference,currency,record_id,recorded_at\n" + RECORD, OBSERVED));
  }],
  ["extra and missing columns are rejected", () => {
    rejects(request(EXPECTED.replace("entry-01", "entry-01,EXTRA"), OBSERVED));
    rejects(request(EXPECTED.replace(",entry-01,", ","), OBSERVED));
  }],
  ["quoted identifiers with commas are preserved", () => {
    const e = HEAD + '"SETTLE,ONE",NGN,100,entry-01,2026-10-31T10:00:00Z\n';
    const o = HEAD + '"SETTLE,ONE",NGN,99,entry-02,2026-10-31T10:00:00Z\n';
    const result = prepareFinancialCsvPreview(context(), request(e, o));
    assert.equal(result.reconciliation.cases[0].reference, "SETTLE,ONE");
    assert.equal(result.reconciliation.cases[0].comparisonStatus, "amount_discrepancy");
  }],
  ["quoted escaped quotes parse literally", () => {
    const e = HEAD + '"REF""A",NGN,100,entry-01,2026-10-31T10:00:00Z\n';
    const o = HEAD + '"REF""A",NGN,100,entry-02,2026-10-31T10:00:00Z\n';
    const result = prepareFinancialCsvPreview(context(), request(e, o));
    assert.equal(result.reconciliation.cases[0].reference, 'REF"A');
  }],
  ["BOM and CRLF are accepted without modifying the original SHA", () => {
    const e = "\ufeff" + EXPECTED.replace(/\n/g, "\r\n");
    const result = prepareFinancialCsvPreview(context(), request(e, OBSERVED));
    assert.equal(result.feedSummaries[0].sha256, sha(e));
  }],
  ["unterminated quotes and quotes after unquoted text fail closed", () => {
    rejects(request(HEAD + '"REF,NGN,100,1,2026-10-31T10:00:00Z\n', OBSERVED));
    rejects(request(EXPECTED.replace("TEST-001", 'TE"ST-001'), OBSERVED));
  }],
  ["invalid trailing text after closing quote is rejected", () => {
    rejects(request(EXPECTED.replace("TEST-001", '"TEST-001"X'), OBSERVED));
  }],
  ["malformed control characters are rejected", () => {
    rejects(request(EXPECTED.replace("TEST-001", "TEST\u0000-001"), OBSERVED));
    rejects(request(EXPECTED.replace("TEST-001", "TEST\u000a-001"), OBSERVED));
  }],
  ["source record identifier replay within the same feed fails closed", () => {
    rejects(request(EXPECTED + RECORD, OBSERVED));
  }],
  ["same feedId on both roles is forbidden", () => {
    const r = request();
    r.observed.feedId = r.expected.feedId;
    rejects(r);
  }],
  ["identical request source bytes cannot masquerade as distinct feeds", () => {
    rejects(request(EXPECTED, EXPECTED));
  }],
  ["size limits apply to the UTF-8 bytes, not only code units", () => {
    rejects(request(EXPECTED + "é".repeat(70000), OBSERVED));
  }],
  ["more than one thousand rows per feed are rejected", () => {
    const big = HEAD + Array.from({ length: 1001 }, (_, i) =>
      `REF-${i},NGN,100,row-${i},2026-10-31T10:00:00Z`).join("\n");
    rejects(request(big, OBSERVED));
  }],
  ["malformed monetary units, mixed currencies and invalid dates are not normalized", () => {
    rejects(request(EXPECTED.replace("10001", "100.01"), OBSERVED));
    rejects(request(EXPECTED.replace("NGN", "ngn"), OBSERVED));
    rejects(request(EXPECTED.replace("2026-10-31", "2026-02-30"), OBSERVED));
  }],
  ["valid numerical same-currency tolerance can suppress only a matching difference", () => {
    const result = prepareFinancialCsvPreview(context(), { ...request(), toleranceMinorByCurrency: { NGN: "1" } });
    assert.equal(result.reconciliation.cases[0].comparisonStatus, "balanced");
    assert.equal(result.reconciliation.cases[0].differenceMinor, "-1");
    assert.equal(result.reconciliation.financialLossAssessed, false);
  }],
  ["forged currency-specific tolerance is rejected", () => {
    rejects({ ...request(), toleranceMinorByCurrency: { ngn: "100" } });
    rejects({ ...request(), toleranceMinorByCurrency: { NGN: "-1" } });
  }],
  ["currency mismatch never gets converted or summed", () => {
    const otherCurrency = OBSERVED.replace(",NGN,", ",USD,");
    const result = prepareFinancialCsvPreview(context(), request(EXPECTED, otherCurrency));
    const c = result.reconciliation.cases[0];
    assert.equal(c.comparisonStatus, "currency_mismatch");
    assert.equal(c.differenceMinor, null);
  }],
  ["case ID is deterministic across repeated preview calls", () => {
    const a = prepareFinancialCsvPreview(context(), request());
    const b = prepareFinancialCsvPreview(context(), request());
    assert.equal(a.reconciliation.cases[0].caseId, b.reconciliation.cases[0].caseId);
    assert.equal(a.previewOnly, true);
  }],
  ["case IDs stay tenant-isolated across authorized organizations", () => {
    const a = prepareFinancialCsvPreview(context("synthetic-bank-1"), request());
    const b = prepareFinancialCsvPreview(context("synthetic-bank-2"), request());
    assert.notEqual(a.reconciliation.cases[0].caseId, b.reconciliation.cases[0].caseId);
  }],
  ["financial-preview route requires authoritative session, bounded body and durable audit before success", () => {
    const code = readFileSync("app/api/v1/reconciliation/preview/route.ts", "utf8");
    assert(code.includes("resolveTenantContext(req.headers)"));
    assert(code.includes('process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging"'));
    assert(code.includes('process.env.CORTEX_FINANCIAL_PREVIEW_ENABLED !== "true"'));
    assert(code.includes("MAX_BODY_BYTES"));
    assert(code.includes("reader.cancel()"));
    assert(code.includes("createApplicationInfrastructure().database.recordAuditLog"));
    assert(code.indexOf("await createApplicationInfrastructure().database.recordAuditLog") <
      code.indexOf("return NextResponse.json(toApiSuccessResponse"));
    assert(code.includes('"Cache-Control": "no-store, private"'));
    assert(!code.includes("executeWorkflow"));
    assert(!code.includes("captureValue"));
  }],
];

let failed = 0;
for (const [name, test] of checks) {
  try {
    test();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`CORTEX CSV PREVIEW SAFETY: ${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
