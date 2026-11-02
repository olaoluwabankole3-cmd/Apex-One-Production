/** CORTEX synthetic preview-to-case UI handoff safety contract. No API credentials. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { caseDraftHref, readCaseDraft } from "../lib/financialCaseDraft";

const allowedKinds = ["settlement", "fee"];
const statuses = [
  "amount_discrepancy", "currency_mismatch", "missing_expected", "missing_observed",
  "insufficient_source_coverage", "ambiguous",
];
for (const kind of allowedKinds) for (const status of statuses) {
  const path = caseDraftHref(kind,status);
  assert(path?.startsWith("/work/cases?draft="),path||"null");
  const query = path.slice(path.indexOf("?"));
  const draft = readCaseDraft(query);
  assert(draft,JSON.stringify([kind,status]));
  assert.equal(draft.department,"Operations");
  assert.equal(draft.priority,"high");
  assert.equal(draft.sourceLinked,false);
  assert.equal(draft.financialLossAssessed,false);
  assert(draft.title.length>=8 && draft.title.length<=160);
  assert(draft.description.length>=10 && draft.description.length<=1200);
  assert.match(draft.description,/not retained|not authenticated/i);
  assert.match(draft.description,/no monetary loss was assessed/i);
  for(const privateValue of ["SYN-SETTLE-001","12500","synthetic-provider-001","customer-12345"]){
    assert(!path.includes(privateValue) && !JSON.stringify(draft).includes(privateValue));
  }
}
for(const bad of [
  ["settlement","balanced"],["unknown","amount_discrepancy"],
  ["fee","payment_confirmed"],["settlement","captured"],
  ["settlement","amount_discrepancy&sourceRef=SECRET"],
  ["settlement","amount_discrepancy/../../else"],["settlement",""],
]){
  assert.equal(caseDraftHref(bad[0],bad[1]),null,JSON.stringify(bad));
}
for(const query of [
  "", "?draft=", "?draft=settlement.balanced",
  "?draft=settlement.amount_discrepancy&reference=PRIVATE_TX_REFERENCE",
  "?draft=settlement.amount_discrepancy&draft=fee.amount_discrepancy",
  "?draft=settlement.amount_discrepancy&amount_minor=12345",
  "?draft=settlement.amount_discrepancy%00",
  "?draft=settlement..amount_discrepancy",
  "?draft=../settlement.amount_discrepancy",
  "?draft=settlement.amount_discrepancy&orgId=another-tenant",
  "?draft=settlement."+"a".repeat(300),
]){
  assert.equal(readCaseDraft(query),null,query);
}
const recon = readFileSync(join(process.cwd(),"app/reconciliation/page.tsx"),"utf8");
const cases = readFileSync(join(process.cwd(),"app/work/cases/page.tsx"),"utf8");
assert.match(recon,/caseDraftHref\(kind, item\.comparisonStatus\)/);
assert.match(recon,/hasPermission\("case:create"\)/);
assert.match(recon,/Prepare case/);
assert.match(recon,/not a persisted|not a verified/i);
assert(!recon.includes('postData<BankingCaseRecord>("/api/v1/banking-cases"'),
  "Reconciliation must never silently persist a case");
assert.match(cases,/readCaseDraft\(window\.location\.search\)/);
assert.match(cases,/if \(!mayCreate\) return/);
assert.match(cases,/showCreate &&/);
assert.match(cases,/onSubmit=\{\(event\) => void createCase\(event\)\}/);
assert.match(cases,/api\/v1\/banking-cases/);
assert.match(cases,/No transaction references/);
assert.match(cases,/avo(i|id) duplicate/i);
assert.match(cases,/evidence.*linked|link.*evidence/i);
const server = readFileSync(join(process.cwd(),"app/api/v1/banking-cases/route.ts"),"utf8");
assert.match(server,/resolveTenantContext\(req\.headers\)/);
assert.match(server,/bankingCaseService\.create\(ctx,/);
assert(!server.includes("financialLossAssessed: true"));
console.log("PASS: synthetic preview-to-investigation handoff transfers no private records, requires explicit authorized case creation, rejects untrusted URL inputs.");
