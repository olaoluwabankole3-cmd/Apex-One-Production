process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { DatabaseStore } from "../lib/backend/database/store";
import { BankingCaseService } from "../lib/backend/domains/banking-cases/bankingCaseService";
import { BankingCaseReviewService } from "../lib/backend/domains/banking-cases/bankingCaseReviewService";
import { BankingCasePilotBridge } from "../lib/backend/domains/banking-cases/bankingCasePilotBridge";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { OrganizationMembershipRecord, UserRecord } from "../lib/backend/database/schema";

const db = DatabaseStore.createFreshStore();
db.clearAll();
const now = new Date().toISOString();
type Row = [string, string, string, "active" | "disabled"];
const users: Row[] = [
  ["ops-maker", "org-a", "Operations", "active"],
  ["finance-maker", "org-a", "Finance", "active"],
  ["admin-checker", "org-a", "Administrator", "active"],
  ["admin-other", "org-a", "Administrator", "active"],
  ["admin-maker", "org-a", "Administrator", "active"],
  ["ops-disabled", "org-a", "Operations", "disabled"],
  ["ops-foreign", "org-b", "Operations", "active"],
  ["admin-foreign", "org-b", "Administrator", "active"],
];
for (const [id, org, role, status] of users) {
  const user: UserRecord = { id, email: id + "@example.test", name: id, title: role, status, createdAt: now };
  const membership: OrganizationMembershipRecord = {
    id: "m-" + id, organizationId: org, userId: id, role, joinedAt: now,
  };
  db.users.set(id, user);
  db.memberships.set(membership.id, membership);
}
const ctx = (id: string, org = "org-a"): TenantContext => {
  const membership = db.getUserMembership(id, org);
  const role = membership?.role ?? "Operations";
  return { organizationId: org, userId: id, userEmail: id + "@example.test",
    userRole: role, permissions: [...getPermissionsForRole(role)],
    requestId: "maker-checker-test", timestamp: now };
};
const cases = new BankingCaseService(db), review = new BankingCaseReviewService(db);
const issue = {
  title: "Review unmatched settlement candidate",
  description: "Banking operations needs independently sourced investigation and review",
  department: "Operations" as const,
};
const failures = async (fn: () => Promise<unknown>, pattern: RegExp) => assert.rejects(fn, pattern);

async function main() {
  const noEvidence = await cases.create(ctx("ops-maker"), issue);
  await failures(() => review.propose(ctx("ops-maker"), noEvidence.id, {
    disposition: "continue_investigation", rationale: "Request formal checking of the source records", expectedRevision: 1,
  }), /Link source evidence/i);

  db.documents.set("doc-org-a", {
    id: "doc-org-a", organizationId: "org-a", name: "Approved but unverified document",
  } as any);
  db.documents.set("doc-org-b", {
    id: "doc-org-b", organizationId: "org-b", name: "Restricted foreign tenant record",
  } as any);
  await failures(() => review.linkEvidence(ctx("ops-maker"), noEvidence.id, {
    sourceType: "Document", sourceId: "doc-org-b",
    note: "This should never become a permitted evidence link", expectedRevision: 1,
  }), /not found/i);
  assert.equal((await cases.findById(ctx("ops-maker"), noEvidence.id)).revision, 1);

  const withEvidence = await review.linkEvidence(ctx("ops-maker"), noEvidence.id, {
    sourceType: "Document", sourceId: "doc-org-a",
    note: "Document is available but its financial claims require review", expectedRevision: 1,
  });
  assert.equal(withEvidence.revision, 2);
  assert.equal(withEvidence.evidenceLinks?.length, 1);
  assert.equal(withEvidence.timeline?.map(x => x.type).join(","), "created,evidence_linked");
  assert.equal(withEvidence.evidenceState, "unverified");
  await failures(() => review.linkEvidence(ctx("ops-maker"), noEvidence.id, {
    sourceType: "Document", sourceId: "doc-org-a",
    note: "A repeated link must not be accepted", expectedRevision: 2,
  }), /already linked/i);

  const proposed = await review.propose(ctx("ops-maker"), noEvidence.id, {
    disposition: "request_source_review",
    rationale: "Request that Finance authenticate the source and inspect all exceptions", expectedRevision: 2,
  });
  assert.equal(proposed.decision?.state, "pending");
  assert.equal(proposed.decision?.evidenceLinkIds.length, 1);
  assert.equal(proposed.revision, 3);
  await failures(() => review.linkEvidence(ctx("ops-maker"), noEvidence.id, {
    sourceType: "Document", sourceId: "doc-org-a", note: "No changes allowed pending review", expectedRevision: 3,
  }), /awaits approval/i);
  await failures(() => cases.handoff(ctx("ops-maker"), noEvidence.id, {
    recipientUserId: "finance-maker", expectedRevision: 3, reason: "Finance reviewing source document",
  }), /awaiting checker review/i);
  await failures(() => review.review(ctx("ops-maker"), noEvidence.id, {
    decisionId: proposed.decision!.id, verdict: "approved",
    note: "Maker must not approve own proposed plan", expectedRevision: 3,
  }), /case:approve|permission/i);
  await failures(() => review.review(ctx("admin-checker"), noEvidence.id, {
    decisionId: proposed.decision!.id, verdict: "approved",
    note: "Reviewer used an old case version", expectedRevision: 2,
  }), /reload/i);
  await failures(() => review.review(ctx("admin-foreign", "org-b"), noEvidence.id, {
    decisionId: proposed.decision!.id, verdict: "approved",
    note: "Cross-tenant checker must be denied", expectedRevision: 3,
  }), /not found/i);

  // Independent checker approves the INTERNAL plan; no financial claim is certified.
  const approved = await review.review(ctx("admin-checker"), noEvidence.id, {
    decisionId: proposed.decision!.id, verdict: "approved",
    note: "Approved further source review, not any loss or settlement", expectedRevision: 3,
  });
  assert.equal(approved.decision?.reviewedByUserId, "admin-checker");
  assert.equal(approved.decision?.state, "approved");
  assert.equal(approved.status, "open");
  assert.equal(approved.evidenceState, "unverified");
  assert.equal(approved.revision, 4);
  assert.deepEqual(approved.timeline?.map(e => e.type), [
    "created", "evidence_linked", "decision_proposed", "decision_reviewed",
  ]);
  await failures(() => review.review(ctx("admin-other"), noEvidence.id, {
    decisionId: proposed.decision!.id, verdict: "rejected",
    note: "Duplicate checker decision must be rejected", expectedRevision: 4,
  }), /no matching pending plan/i);

  const selfMade = await cases.create(ctx("admin-maker"), {
    ...issue, title: "Creator self approval separation regression",
  });
  const evidence = await review.linkEvidence(ctx("admin-maker"), selfMade.id, {
    sourceType: "Document", sourceId: "doc-org-a",
    note: "Separate checker must assess this document", expectedRevision: 1,
  });
  const selfProposed = await review.propose(ctx("admin-maker"), selfMade.id, {
    disposition: "request_source_review", rationale: "Send the case to an independent checker for validation",
    expectedRevision: evidence.revision!,
  });
  await failures(() => review.review(ctx("admin-maker"), selfMade.id, {
    decisionId: selfProposed.decision!.id, verdict: "approved",
    note: "Attempted self approval by privileged creator", expectedRevision: selfProposed.revision!,
  }), /Maker-checker separation/i);

  // Same revision competing reviewers: exactly one can write an audit-backed result.
  const attempts = await Promise.allSettled([
    review.review(ctx("admin-checker"), selfMade.id, {
      decisionId: selfProposed.decision!.id, verdict: "approved",
      note: "Independent reviewer approves only the investigation", expectedRevision: selfProposed.revision!,
    }),
    review.review(ctx("admin-other"), selfMade.id, {
      decisionId: selfProposed.decision!.id, verdict: "rejected",
      note: "Second checker must lose stale revision race", expectedRevision: selfProposed.revision!,
    }),
  ]);
  assert.equal(attempts.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(x => x.status === "rejected").length, 1);

  const candidateId = "recon-" + "a".repeat(32);
  const batchId = "fpbatch-" + "b".repeat(40);
  let triage = "escalated";
  const preview = new BankingCasePilotBridge(cases, {
    async getBatch(_ctx, _id) {
      return {
        batch: {
          batchId, kind: "settlement" as const, caseCount: 1,
          replayed: false as const, verificationState: "unverified" as const,
          sourceStored: false as const, coverageVerified: false as const,
          financialLossAssessed: false as const,
        },
        cases: [{
          caseId: candidateId, batchId, comparisonStatus: "amount_discrepancy" as const,
          triageStatus: triage as "escalated" | "in_review",
          version: 3, reviewerId: "admin-checker", reasonCode: "potential_discrepancy" as const,
        }],
      };
    },
  });
  triage = "in_review";
  await failures(() => preview.createEscalatedCandidate(ctx("admin-maker"), { batchId, candidateId }), /Only explicitly escalated/i);
  triage = "escalated";
  const pilotCase = await preview.createEscalatedCandidate(ctx("admin-maker"), { batchId, candidateId });
  assert.equal(pilotCase.previewOrigin?.sourceStored, false);
  assert.equal(pilotCase.previewOrigin?.financialLossAssessed, false);
  assert.equal(pilotCase.evidenceState, "unverified");
  await failures(() => preview.createEscalatedCandidate(ctx("admin-maker"), { batchId, candidateId }), /uniqueness|constraint|already exists/i);
  await failures(() => review.propose(ctx("admin-maker"), pilotCase.id, {
    disposition: "escalate_for_control_review", rationale: "No source bytes are actually retained here",
    expectedRevision: 1,
  }), /Metadata-only preview/i);
  const proposedPilot = await review.propose(ctx("admin-maker"), pilotCase.id, {
    disposition: "request_source_review", rationale: "Request trusted source verification for this preview candidate",
    expectedRevision: 1,
  });
  const reviewedPilot = await review.review(ctx("admin-checker"), pilotCase.id, {
    decisionId: proposedPilot.decision!.id, verdict: "approved",
    note: "Authorized source review, not a financial recovery", expectedRevision: 2,
  });
  assert.equal(reviewedPilot.evidenceState, "unverified");
  assert.equal(reviewedPilot.status, "open");

  const logs = await db.auditLogsRepo.findMany(ctx("admin-checker"));
  assert.equal(logs.items.filter(l => l.action === "banking_case:decision_reviewed").length, 3);
  assert(logs.items.some(l => l.action === "banking_case:evidence_linked"));
  assert(logs.items.some(l => l.action === "banking_case:decision_proposed"));
  console.log("PASS: maker-checker independent reviewer, evidence tenant scope, chronology, stale-version/parallel reviews, metadata-only pilot and audit boundaries");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
