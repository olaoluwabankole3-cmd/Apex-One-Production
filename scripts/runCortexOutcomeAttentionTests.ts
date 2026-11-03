/** CORTEX outcome-first attention and reusable completion rules safety gate. */
import assert from "node:assert/strict";
import { describeCaseAttention } from "../lib/cortexCaseAttention";
import { assessSyntheticCompletion, COMPLETION_RULES } from "../lib/cortexCompletionRules";
import type { BankingCaseRecord } from "../lib/backend/database/schema";

const base: BankingCaseRecord = {
  id: "synthetic-case-001", organizationId: "synthetic-bank", title: "Review a failed payment",
  description: "Synthetic payment requires confirmation", department: "Finance",
  priority: "high", status: "open", evidenceState: "unverified",
  createdByUserId: "ops-user", ownerUserId: "finance-user", revision: 1,
  createdAt: "2026-11-03T00:00:00Z", updatedAt: "2026-11-03T00:00:00Z",
};
const finance = { userId: "finance-user", mayApprove: false };
const checker = { userId: "checker-user", mayApprove: true };

const noEvidence = describeCaseAttention(base, finance);
assert.equal(noEvidence.category, "needs_evidence");
assert.equal(noEvidence.outcomeVerified, false);
assert.equal(noEvidence.actionOwner, "You (case owner)");

const sourced = {
  ...base, sourceType: "Document" as const, sourceId: "synthetic-evidence-id",
};
assert.equal(describeCaseAttention(sourced, finance).category, "needs_investigation_plan");

const pending: BankingCaseRecord = {
  ...sourced,
  decision: {
    id: "synthetic-plan-001", state: "pending", disposition: "request_source_review",
    rationale: "Propose internal review", proposedByUserId: "finance-user",
    proposedAt: base.createdAt, evidenceLinkIds: [],
  },
};
const waiting = describeCaseAttention(pending, finance);
assert.equal(waiting.category, "awaiting_independent_checker");
assert.equal(waiting.link, "/work/cases");
assert.equal(waiting.actionOwner, "Independent checker");
const independent = describeCaseAttention(pending, checker);
assert.equal(independent.category, "awaiting_independent_checker");
assert.equal(independent.link, "/reviews");
assert.equal(independent.actionOwner, "You (eligible checker)");
const selfChecker = describeCaseAttention(
  { ...pending, createdByUserId: "checker-user" },
  checker
);
assert.equal(selfChecker.link, "/work/cases", "Creator cannot review their own plan");

const approved = describeCaseAttention({
  ...pending, decision: { ...pending.decision!, state: "approved" },
}, finance);
assert.equal(approved.category, "outcome_unconfirmed");
assert.equal(approved.outcomeVerified, false);
assert.match(approved.customerSafeUpdate, /not confirmed/i);
assert(!approved.customerSafeUpdate.includes("funds received"));

const rejected = describeCaseAttention({
  ...pending, decision: { ...pending.decision!, state: "rejected" },
}, finance);
assert.equal(rejected.category, "plan_rejected");
assert.equal(rejected.outcomeVerified, false);

for (const workflow of Object.keys(COMPLETION_RULES) as (keyof typeof COMPLETION_RULES)[]) {
  const rule = COMPLETION_RULES[workflow];
  const notYet = assessSyntheticCompletion(workflow, base.id, true);
  assert.equal(notYet.state, "awaiting_confirmation");
  assert.equal(notYet.nextOwner, rule.pendingOwner);
  assert.equal(notYet.bankOutcomeVerified, false);

  const fixture = {
    kind: "synthetic_ci_fixture" as const,
    workflow, caseId: base.id, event: rule.requiredEvent,
    syntheticSourceId: "synthetic-confirmation-feed",
    confirmed: true,
  };
  const simulated = assessSyntheticCompletion(workflow, base.id, true, fixture);
  assert.equal(simulated.state, "synthetic_confirmation_observed");
  assert.equal(simulated.bankOutcomeVerified, false, "Never certify a real bank result");
  assert.equal(simulated.syntheticOnly, true);
  assert.match(simulated.customerSafeMessage, /simulated|synthetic/i);
  assert.equal(simulated.nextOwner, null);

  assert.equal(assessSyntheticCompletion(workflow, base.id, false, fixture).state,
    "awaiting_confirmation", "A receipt cannot bypass an unapproved plan");
  assert.equal(assessSyntheticCompletion(workflow, base.id, true, {
    ...fixture, caseId: "some-other-case",
  }).state, "awaiting_confirmation", "Unrelated case receipt cannot close work");
  assert.equal(assessSyntheticCompletion(workflow, base.id, true, {
    ...fixture, event: "unrelated_event",
  }).state, "awaiting_confirmation", "Wrong proof event cannot satisfy completion rule");
  assert.equal(assessSyntheticCompletion(workflow, base.id, true, {
    ...fixture, syntheticSourceId: "untrusted-live-source",
  }).state, "awaiting_confirmation", "Untrusted source is never accepted as synthetic authority");
  assert.equal(assessSyntheticCompletion(workflow, base.id, true, {
    ...fixture, confirmed: false,
  }).state, "awaiting_confirmation", "An unconfirmed receipt must keep work open");
}

console.log("PASS: actual case attention is permission-aware and never implies real bank outcome verification");
console.log("PASS: four reusable department completion rules distinguish synthetic confirmation from still-missing external proof");
