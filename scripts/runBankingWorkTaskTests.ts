/** CORTEX independent case-task backend security and lifecycle regression. */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { DatabaseStore } from "../lib/backend/database/store";
import { BankingCaseService } from "../lib/backend/domains/banking-cases/bankingCaseService";
import { BankingWorkTaskService } from "../lib/backend/domains/banking-tasks/bankingWorkTaskService";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { UserRecord, OrganizationMembershipRecord } from "../lib/backend/database/schema";

const store = DatabaseStore.createFreshStore();
store.clearAll();
const now = "2026-11-03T09:00:00.000Z";
const identities = [
  ["ops-a", "bank-a", "Operations", "active"],
  ["finance-a", "bank-a", "Finance", "active"],
  ["finance-colleague", "bank-a", "Finance", "active"],
  ["finance-disabled", "bank-a", "Finance", "disabled"],
  ["admin-a", "bank-a", "Administrator", "active"],
  ["ops-b", "bank-b", "Operations", "active"],
  ["finance-b", "bank-b", "Finance", "active"],
] as const;
for (const [id, org, role, status] of identities) {
  const user: UserRecord = {
    id, email: id + "@example.test", name: id, title: role, status, createdAt: now,
  };
  const member: OrganizationMembershipRecord = {
    id: "m-" + id, organizationId: org, userId: id,
    role, ...(role === "Finance" || role === "Operations" ? { department: role } : {}),
    joinedAt: now,
  };
  store.users.set(id, user);
  store.memberships.set(member.id, member);
}
type Name = typeof identities[number][0];
function ctx(id: Name): TenantContext {
  const row = identities.find(x => x[0] === id)!;
  return {
    organizationId: row[1], userId: row[0],
    userEmail: row[0] + "@example.test", userRole: row[2],
    permissions: [...getPermissionsForRole(row[2])],
    requestId: "cortex-task-test-" + row[0], timestamp: now,
  };
}

const caseService = new BankingCaseService(store);
const work = new BankingWorkTaskService(store);
const requestInput = {
  recipientUserId: "finance-a",
  title: "Check synthetic settlement classification",
  question: "Does the permitted settlement review require a separate source confirmation?",
  expectedResponse: "Return the investigation finding and what source is still missing",
};

async function main(): Promise<void> {
  const parent = await caseService.create(ctx("ops-a"), {
    title: "Investigate synthetic interbank transfer",
    description: "Investigate an example transfer with no actual customer or bank statement",
    department: "Operations",
    priority: "normal",
  });
  const responseDueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const request = await work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: parent.revision!, ...requestInput,
    dueAt: responseDueAt,
  });
  assert.equal(request.dueAt, responseDueAt, "Task target is stored exactly as supplied");
  assert.equal(request.status, "requested");
  assert.equal(request.targetDepartment, "Finance");
  assert.equal(request.financialOutcomeVerified, false);
  assert.equal(request.requestedByUserId, "ops-a");
  assert.equal(request.recipientUserId, "finance-a");
  assert.equal((await caseService.findById(ctx("ops-a"), parent.id)).ownerUserId, "ops-a",
    "Subtask must not silently transfer parent case ownership");
  await assert.rejects(() => caseService.findById(ctx("finance-a"), parent.id), /not found/i,
    "Task recipient may not see the confidential parent case");
  await assert.rejects(() => work.listForCase(ctx("finance-a"), parent.id), /not found/i);
  assert.equal((await work.listMine(ctx("finance-a"), "received")).items.length, 1);
  assert.equal((await work.listMine(ctx("ops-a"), "requested")).items.length, 1);
  assert.equal((await work.listMine(ctx("finance-colleague"), "received")).items.length, 0);
  assert.equal((await work.listMine(ctx("finance-b"), "received")).items.length, 0);
  assert.equal((await work.listForCase(ctx("ops-a"), parent.id)).items.length, 1);

  // Declared task targets are bounded by the server and not inferred. Invalid
  // timestamps must not leak requests or grant any additional case access.
  for (const invalidDeadline of [
    "tomorrow",
    "2026-11-03T09:00:00.000Z",
    new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
  ]) {
    await assert.rejects(() => work.request(ctx("ops-a"), {
      caseId: parent.id, expectedCaseRevision: 1, ...requestInput,
      dueAt: invalidDeadline,
    }), /dueAt/i, "Malformed, past or excessive deadlines must be rejected");
  }
  assert.equal((await work.listForCase(ctx("ops-a"), parent.id)).items.length, 1);

  await assert.rejects(() => work.accept(ctx("finance-colleague"), request.id, 1), /not found/i);
  await assert.rejects(() => work.accept(ctx("finance-b"), request.id, 1), /not found/i);
  await assert.rejects(() => work.accept(ctx("ops-a"), request.id, 1), /not found/i);
  await assert.rejects(() => work.respond(ctx("finance-a"), request.id, {
    expectedRevision: 1, note: "Skipping acceptance must be forbidden",
  }), /changed|transition/i);

  // Competing acceptance must produce one winner and one conflict.
  const attempts = await Promise.allSettled([
    work.accept(ctx("finance-a"), request.id, 1),
    work.accept(ctx("finance-a"), request.id, 1),
  ]);
  assert.equal(attempts.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(x => x.status === "rejected").length, 1);
  const accepted = attempts.find((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof work.accept>>> =>
    x.status === "fulfilled")!.value;
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.revision, 2);

  await assert.rejects(() => work.respond(ctx("finance-a"), request.id, {
    expectedRevision: 1, note: "Stale response should never change committed work",
  }), /changed/i);
  const answered = await work.respond(ctx("finance-a"), request.id, {
    expectedRevision: accepted.revision,
    note: "The synthetic classification remains unconfirmed without source custody",
  });
  assert.equal(answered.status, "responded");
  assert.equal(answered.revision, 3);
  assert.equal(answered.financialOutcomeVerified, false);
  assert.equal((await caseService.findById(ctx("ops-a"), parent.id)).status, "open");
  assert.equal((await caseService.findById(ctx("ops-a"), parent.id)).evidenceState, "unverified");
  await assert.rejects(() => work.respond(ctx("finance-a"), request.id, {
    expectedRevision: 3, note: "Do not respond twice to the same departmental task",
  }), /changed/i);

  const declineTask = await work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1,
    ...requestInput, title: "Request separate Finance recheck",
  });
  const declined = await work.decline(ctx("finance-a"), declineTask.id, {
    expectedRevision: 1, note: "Send to a different qualified analyst in this institution",
  });
  assert.equal(declined.status, "declined");
  await assert.rejects(() => work.accept(ctx("finance-a"), declineTask.id, 2), /changed/i);

  // Explicit department queue: a Finance teammate can claim a bounded
  // request WITHOUT acquiring its confidential parent BankingCase.
  // Team-wide visibility never applies to existing private named requests.
  const shared = await work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1,
    deliveryMode: "department", targetDepartment: "Finance",
    title: "Review synthetic payment classification",
    question: "Determine which verification steps are required before reporting a source-backed outcome",
    expectedResponse: "Provide the procedural next check only, without customer details",
  });
  assert.equal(shared.status, "requested");
  assert.equal(shared.deliveryMode, "department");
  assert.equal(shared.dueAt, undefined, "Unscheduled tasks must not receive invented deadlines");
  assert.equal(shared.recipientUserId, "", "No individual owns an unclaimed team request");
  assert.equal(shared.targetDepartment, "Finance");
  assert.equal((await work.listMine(ctx("finance-a"), "team")).items.some(x => x.id === shared.id), true);
  assert.equal((await work.listMine(ctx("finance-colleague"), "team")).items.some(x => x.id === shared.id), true);
  assert.equal((await work.listMine(ctx("ops-a"), "team")).items.some(x => x.id === shared.id), false);
  assert.equal((await work.listMine(ctx("finance-b"), "team")).items.some(x => x.id === shared.id), false,
    "Another bank's Finance queue remains isolated");
  await assert.rejects(() => work.listMine(ctx("admin-a"), "team"), /Finance team|Operations or Finance/i,
    "General administrator authority must not inherit departmental task contents");
  await assert.rejects(() => work.listMine(ctx("finance-disabled"), "team"),
    /Current institutional membership/i);
  assert.equal((await work.listMine(ctx("finance-a"), "received")).items.some(x => x.id === shared.id), false);
  assert.equal((await work.listMine(ctx("finance-a"), "team")).items.some(x => x.id === request.id), false,
    "Named employee requests must not appear in the team queue");
  await assert.rejects(() => caseService.findById(ctx("finance-colleague"), parent.id), /not found/i);
  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1,
    deliveryMode: "department", recipientUserId: "finance-a",
    targetDepartment: "Finance", title: "Invalid dual delivery mode",
    question: "This request must never reach both private and department queues",
    expectedResponse: "Reject the ambiguous distribution before publishing any request",
  }), /must not name a recipient/i);
  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1,
    deliveryMode: "department", targetDepartment: "Operations",
    title: "Invalid originating department",
    question: "The origin owner cannot broadcast this cross-team request to itself",
    expectedResponse: "Reject a request that does not cross a department boundary",
  }), /different eligible task department/i);

  const claims = await Promise.allSettled([
    work.accept(ctx("finance-a"), shared.id, 1),
    work.accept(ctx("finance-colleague"), shared.id, 1),
  ]);
  assert.equal(claims.filter(x => x.status === "fulfilled").length, 1,
    "Concurrent team claims must produce exactly one assignee");
  assert.equal(claims.filter(x => x.status === "rejected").length, 1);
  const winner = claims[0].status === "fulfilled" ? "finance-a" : "finance-colleague";
  const loser = winner === "finance-a" ? "finance-colleague" : "finance-a";
  const claimed = (claims.find((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof work.accept>>> =>
    x.status === "fulfilled"))!.value;
  assert.equal(claimed.recipientUserId, winner);
  assert.equal(claimed.revision, 2);
  assert.equal(claimed.status, "accepted");
  assert.equal((await work.listMine(ctx("finance-a"), "team")).items.length, 0,
    "Claimed work is removed from the unassigned queue");
  assert.equal((await work.listMine(ctx(winner), "received")).items.some(x => x.id === shared.id), true);
  assert.equal((await work.listMine(ctx(loser), "received")).items.some(x => x.id === shared.id), false);
  await assert.rejects(() => work.respond(ctx(loser), shared.id, {
    expectedRevision: 2, note: "A different Finance employee cannot answer a claimed task",
  }), /not found/i);
  const teamReply = await work.respond(ctx(winner), shared.id, {
    expectedRevision: 2,
    note: "Simulated request answered by exactly one eligible Finance team member",
  });
  assert.equal(teamReply.status, "responded");
  assert.equal(teamReply.financialOutcomeVerified, false);
  assert.equal((await caseService.findById(ctx("ops-a"), parent.id)).ownerUserId, "ops-a",
    "Even a shared task claim and response never transfer the parent case");
  assert.equal((await work.listMine(ctx("ops-a"), "requested")).items.some(x =>
    x.id === shared.id && x.status === "responded"), true);

  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1, ...requestInput,
    recipientUserId: "finance-b",
  }), /not found/i, "Cross-tenant recipient must not be disclosed");
  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 1, ...requestInput,
    recipientUserId: "finance-disabled",
  }), /not found/i, "Disabled staff cannot receive work");
  await assert.rejects(() => work.request(ctx("finance-a"), {
    caseId: parent.id, expectedCaseRevision: 1, ...requestInput,
    recipientUserId: "ops-a",
  }), /not found/i, "Task recipient cannot create another request on a case they cannot read");
  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: parent.id, expectedCaseRevision: 2, ...requestInput,
  }), /Case changed/i);

  // A case with checker review pending must not receive new side-channel work.
  const casePending = await caseService.create(ctx("ops-a"), {
    title: "Review with pending decision",
    description: "No private case context may enter a second team's task inbox",
    department: "Operations",
  });
  const stored = store.bankingCases.get(casePending.id)!;
  stored.decision = {
    id: "synthetic-pending-plan", state: "pending", disposition: "request_source_review",
    rationale: "Wait for independent checker", proposedByUserId: "ops-a",
    proposedAt: now, evidenceLinkIds: [],
  };
  await assert.rejects(() => work.request(ctx("ops-a"), {
    caseId: casePending.id, expectedCaseRevision: 1, ...requestInput,
  }), /not available/i);

  // Revoked access must fail closed on the next request.
  const member = store.memberships.get("m-finance-a")!;
  member.role = "Customer Service";
  await assert.rejects(() => work.listMine(ctx("finance-a"), "received"),
    /Current institutional membership/i);
  await assert.rejects(() => work.accept(ctx("finance-a"), declineTask.id, 2),
    /Current institutional membership/i);
  member.role = "Finance";

  const audits = await store.auditLogsRepo.findMany(ctx("admin-a"));
  for (const action of ["banking_task:requested", "banking_task:accepted",
    "banking_task:responded", "banking_task:declined"]) {
    assert(audits.items.some(a => a.action === action), "Missing task audit event " + action);
  }
  for (const record of audits.items.filter(a => a.action.startsWith("banking_task:"))) {
    assert(!JSON.stringify(record).includes("synthetic classification remains"), "Audit may not log response body");
  }
  console.log("PASS: private named tasks, optional validated deadlines, department team queues, concurrency, confidentiality, case ownership and audit receipts");
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
