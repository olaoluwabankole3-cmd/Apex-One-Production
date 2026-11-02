/**
 * CORTEX synthetic-only golden path: financial preview -> classification-only
 * case draft -> operations ownership -> finance handoff -> independent plan
 * checker -> case/audit report. Never connects to a live bank or staging data.
 */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { DatabaseStore } from "../lib/backend/database/store";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { UserRecord, OrganizationMembershipRecord } from "../lib/backend/database/schema";
import { prepareFinancialCsvPreview, validateFinancialCsvForInternalIntake } from "../lib/backend/domains/reconciliation/csvPreviewService";
import { caseDraftHref, readCaseDraft } from "../lib/financialCaseDraft";
import { BankingCaseService } from "../lib/backend/domains/banking-cases/bankingCaseService";
import { BankingCaseReviewService } from "../lib/backend/domains/banking-cases/bankingCaseReviewService";

const db = DatabaseStore.createFreshStore();
db.clearAll();
const org = "cortex-synthetic-bank";
const now = "2026-11-02T09:00:00Z";
const roles = [
  ["finance-operator", "Finance"], ["ops-investigator", "Operations"],
  ["independent-checker", "Administrator"], ["foreign-admin", "Administrator"],
] as const;
for (const [id,role] of roles) {
  const user: UserRecord = { id, email: id + "@example.invalid", name: id, title: role,
    status: "active", createdAt: now };
  const membership: OrganizationMembershipRecord = { id: "m-" + id,
    organizationId: id === "foreign-admin" ? "other-synthetic-bank" : org,
    userId: id, role, joinedAt: now };
  db.users.set(id,user);
  db.memberships.set(membership.id,membership);
}
const ctx = (id: (typeof roles)[number][0]): TenantContext => {
  const userRole = roles.find(row => row[0] === id)![1];
  return { organizationId: id === "foreign-admin" ? "other-synthetic-bank" : org,
    userId: id, userEmail: id + "@example.invalid", userRole,
    permissions: [...getPermissionsForRole(userRole)],
    requestId: "synthetic-cortex-golden-path", timestamp: now };
};
const HEADER = "reference,currency,amount_minor,record_id,recorded_at\n";
const expected = { feedId: "synthetic-ledger",
  csv: HEADER + "SYN-SETTLE-001,NGN,12500,synthetic-ledger-001,2026-11-02T09:00:00Z\n" };
const observed = { feedId: "synthetic-provider",
  csv: HEADER + "SYN-SETTLE-001,NGN,12400,synthetic-provider-001,2026-11-02T09:01:00Z\n" };
const cases = new BankingCaseService(db);
const reviews = new BankingCaseReviewService(db);

async function main() {
  const finance = ctx("finance-operator");
  assert(finance.permissions.includes("financial:preview"));
  assert(!finance.permissions.includes("financial:write"),
    "Preview must not grant general financial write access");

  const preview = prepareFinancialCsvPreview(finance,{kind:"settlement",expected,observed});
  assert.equal(preview.previewOnly,true);
  assert.equal(preview.sourceStored,false);
  assert.equal(preview.coverageVerified,false);
  assert.equal(preview.reconciliation.financialLossAssessed,false);
  const exception = preview.reconciliation.cases[0];
  assert.equal(exception.comparisonStatus,"amount_discrepancy");
  assert.equal(exception.verificationState,"unverified");
  assert.throws(() => validateFinancialCsvForInternalIntake(finance,"settlement","expected",expected),
    /permission/i,"Scoped preview must not permit durable financial intake");

  const href = caseDraftHref("settlement",exception.comparisonStatus);
  assert(href);
  assert(!href.includes("12500") && !href.includes("SYN-SETTLE-001"));
  const draft = readCaseDraft(href.slice(href.indexOf("?")));
  assert(draft);
  assert.equal(draft.department,"Operations");
  assert.equal(draft.sourceLinked,false);
  assert.equal(draft.financialLossAssessed,false);
  assert(!draft.description.includes("SYN-SETTLE-001"));
  assert.equal(readCaseDraft("?draft=settlement.amount_discrepancy&amount_minor=12500"),null);

  // An authorized Operations investigator *explicitly* creates a new case.
  // The Finance preview did not persist, transfer or authenticate any source.
  const created = await cases.create(ctx("ops-investigator"),{
    title:draft.title,description:draft.description,
    department:draft.department,priority:draft.priority,
  });
  assert.equal(created.ownerUserId,"ops-investigator");
  assert.equal(created.evidenceState,"unverified");
  assert.equal(created.previewOrigin,undefined);
  assert.equal(created.sourceId,undefined);
  await assert.rejects(() => reviews.propose(ctx("ops-investigator"),created.id,{
    disposition:"continue_investigation",
    rationale:"Proceed only after an independently authorized source is attached",
    expectedRevision:1,
  }),/Link source evidence/i);

  // The current owner hands responsibility to Finance and loses case access.
  const handed = await cases.handoff(ctx("ops-investigator"),created.id,{
    recipientUserId:"finance-operator",expectedRevision:1,
    reason:"Finance must independently inspect the synthetic source exception",
  });
  assert.equal(handed.ownerUserId,"finance-operator");
  assert.equal(handed.department,"Finance");
  await assert.rejects(() => cases.findById(ctx("ops-investigator"),created.id),/not found/i);
  await assert.rejects(() => cases.handoff(ctx("ops-investigator"),created.id,{
    recipientUserId:"finance-operator",expectedRevision:1,
    reason:"Prior owner must not reassign after a completed handoff",
  }),/not found/i);
  await assert.rejects(() => cases.findById(ctx("foreign-admin"),created.id),/not found/i);

  db.documents.set("synthetic-authorized-record",{
    id:"synthetic-authorized-record",organizationId:org,name:"Synthetic internal source (unverified)"
  } as any);
  const linked = await reviews.linkEvidence(finance,created.id,{
    sourceType:"Document",sourceId:"synthetic-authorized-record",
    note:"This internal record requires source validation before any financial finding",
    expectedRevision:handed.revision!,
  });
  assert.equal(linked.evidenceLinks?.length,1);
  assert.equal(linked.evidenceState,"unverified");

  const proposed = await reviews.propose(finance,created.id,{
    disposition:"request_source_review",
    rationale:"Request independent source authentication and review; do not certify a loss",
    expectedRevision:linked.revision!,
  });
  assert.equal(proposed.decision?.state,"pending");
  await assert.rejects(()=>cases.handoff(finance,created.id,{
    recipientUserId:"ops-investigator",expectedRevision:proposed.revision!,
    reason:"A pending plan must remain locked until checker disposition",
  }),/awaiting checker review/i);

  const approved=await reviews.review(ctx("independent-checker"),created.id,{
    decisionId:proposed.decision!.id,verdict:"approved",
    note:"Approve internal source review only, with no monetary conclusion or transfer",
    expectedRevision:proposed.revision!,
  });
  assert.equal(approved.decision?.reviewedByUserId,"independent-checker");
  assert.equal(approved.decision?.state,"approved");
  assert.equal(approved.status,"open");
  assert.equal(approved.evidenceState,"unverified");
  assert.deepEqual(approved.timeline?.map(event=>event.type),[
    "created","handed_off","evidence_linked","decision_proposed","decision_reviewed"
  ]);
  await assert.rejects(()=>reviews.review(ctx("independent-checker"),created.id,{
    decisionId:proposed.decision!.id,verdict:"approved",
    note:"Duplicate approval must not create a second receipt",
    expectedRevision:approved.revision!,
  }),/no matching pending plan/i);

  const report = await cases.list(ctx("independent-checker"),{limit:50});
  assert(report.items.some(item=>item.id===created.id && item.decision?.state==="approved"));
  const audit = await db.auditLogsRepo.findMany(ctx("independent-checker"));
  for(const action of ["banking_case:create","banking_case:handoff",
    "banking_case:evidence_linked","banking_case:decision_proposed","banking_case:decision_reviewed"]) {
    assert(audit.items.some(event=>event.resourceId===created.id && event.action===action),
      "Missing durable synthetic accountability event: "+action);
  }
  console.log("PASS: scoped Finance synthetic comparison → classification-only Operations case → Finance handoff → linked source → independent checker → authorized audit report (unverified; no bank data)");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
