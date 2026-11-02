process.env.TEST_ENV = "true";

import assert from "node:assert/strict";
import { DatabaseStore } from "../lib/backend/database/store";
import { BankingCaseService } from "../lib/backend/domains/banking-cases/bankingCaseService";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { OrganizationMembershipRecord, UserRecord } from "../lib/backend/database/schema";

const db = DatabaseStore.createFreshStore();
db.clearAll();
const now = new Date().toISOString();
const users: UserRecord[] = [
  { id: "ops-a", email: "ops-a@example.test", name: "Operations A", title: "Analyst", status: "active", createdAt: now },
  { id: "ops-b", email: "ops-b@example.test", name: "Operations B", title: "Analyst", status: "active", createdAt: now },
  { id: "admin-a", email: "admin-a@example.test", name: "Admin A", title: "Admin", status: "active", createdAt: now },
  { id: "ops-other", email: "ops-other@example.test", name: "Operations Other", title: "Analyst", status: "active", createdAt: now },
  { id: "disabled-a", email: "disabled-a@example.test", name: "Disabled", title: "Analyst", status: "disabled", createdAt: now },
  { id: "fin-a", email: "fin-a@example.test", name: "Finance A", title: "Officer", status: "active", createdAt: now },
  { id: "fin-b", email: "fin-b@example.test", name: "Finance B", title: "Officer", status: "active", createdAt: now },
  { id: "fin-disabled", email: "fin-disabled@example.test", name: "Finance Disabled", title: "Officer", status: "disabled", createdAt: now },
  { id: "fin-other", email: "fin-other@example.test", name: "Other Finance", title: "Officer", status: "active", createdAt: now },
];
users.forEach((user) => db.users.set(user.id, user));
const memberships: OrganizationMembershipRecord[] = [
  { id: "m1", userId: "ops-a", organizationId: "org-a", role: "Operations", joinedAt: now },
  { id: "m2", userId: "ops-b", organizationId: "org-a", role: "Operations", joinedAt: now },
  { id: "m3", userId: "admin-a", organizationId: "org-a", role: "Administrator", joinedAt: now },
  { id: "m4", userId: "ops-other", organizationId: "org-b", role: "Operations", joinedAt: now },
  { id: "m5", userId: "disabled-a", organizationId: "org-a", role: "Operations", joinedAt: now },
  { id: "m6", userId: "fin-a", organizationId: "org-a", role: "Finance", department: "Finance", joinedAt: now },
  { id: "m7", userId: "fin-b", organizationId: "org-a", role: "Finance", department: "Finance", joinedAt: now },
  { id: "m8", userId: "fin-disabled", organizationId: "org-a", role: "Finance", department: "Finance", joinedAt: now },
  { id: "m9", userId: "fin-other", organizationId: "org-b", role: "Finance", department: "Finance", joinedAt: now },
];
memberships.forEach((membership) => db.memberships.set(membership.id, membership));
function ctx(userId: string, organizationId: string, role: string): TenantContext {
  return {
    organizationId, userId, userEmail: users.find((u) => u.id === userId)?.email || "unknown@example.test",
    userRole: role, permissions: [...getPermissionsForRole(role)],
    requestId: "case-regression", timestamp: now,
  };
}
const service = new BankingCaseService(db);
const sourceFree = {
  title: "Settlement requires review", description: "Investigate pending settlement exception without alleging a proven loss",
  department: "Operations" as const, priority: "normal" as const,
};

async function rejects(work: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(work, pattern);
}

async function main() {
  const one = await service.create(ctx("ops-a", "org-a", "Operations"), sourceFree);
  assert.equal(one.organizationId, "org-a");
  assert.equal(one.ownerUserId, "ops-a");
  assert.equal(one.status, "open");
  assert.equal(one.evidenceState, "unverified");
  assert.equal(one.sourceId, undefined);
  assert.equal((await service.list(ctx("ops-a", "org-a", "Operations"))).items.length, 1);
  assert.equal((await service.list(ctx("ops-b", "org-a", "Operations"))).items.length, 0);
  assert.equal((await service.list(ctx("admin-a", "org-a", "Administrator"))).items.length, 1);
  assert.equal((await service.list(ctx("ops-other", "org-b", "Operations"))).items.length, 0);

  await rejects(() => service.findById(ctx("ops-b", "org-a", "Operations"), one.id), /not found/i);
  await rejects(() => service.findById(ctx("ops-other", "org-b", "Operations"), one.id), /not found/i);
  assert.equal((await service.findById(ctx("admin-a", "org-a", "Administrator"), one.id)).id, one.id);

  await rejects(() => service.create(ctx("disabled-a", "org-a", "Operations"), sourceFree), /membership/i);
  await rejects(() => service.create(ctx("ops-a", "org-b", "Operations"), sourceFree), /membership/i);
  await rejects(() => service.create(ctx("ops-a", "org-a", "Administrator"), sourceFree), /membership/i);

  const originalRole = db.memberships.get("m1")!.role;
  db.memberships.set("m1", { ...db.memberships.get("m1")!, role: "Customer Service" });
  await rejects(() => service.create(ctx("ops-a", "org-a", "Operations"), sourceFree), /membership/i);
  db.memberships.set("m1", { ...db.memberships.get("m1")!, role: originalRole });

  await rejects(() => service.create(ctx("ops-a", "org-a", "Operations"), { ...sourceFree, sourceType: "Document" }), /together/i);
  await rejects(() => service.create(ctx("ops-a", "org-a", "Operations"), {
    ...sourceFree, sourceType: "Document", sourceId: "not-real",
  }), /not found/i);
  await rejects(() => service.create(ctx("ops-a", "org-a", "Operations"), { ...sourceFree, title: "Tiny" }), /at least/i);

  // Cross-tenant references must never be accepted as evidence of org-a.
  db.documents.set("other-document", {
    id: "other-document", organizationId: "org-b", name: "Foreign data", fileType: "pdf",
  } as any);
  await rejects(() => service.create(ctx("ops-a", "org-a", "Operations"), {
    ...sourceFree, sourceType: "Document", sourceId: "other-document",
  }), /not found/i);
  // No failed intake may leave a case behind.
  assert.equal((await service.list(ctx("admin-a", "org-a", "Administrator"))).items.length, 1);
  const audit = await db.auditLogsRepo.findMany(ctx("admin-a", "org-a", "Administrator"));
  assert.equal(audit.items.filter((entry) => entry.action === "banking_case:create").length, 1);
  const assignees = await service.listAssignees(ctx("ops-a", "org-a", "Operations"));
  assert(assignees.members.some((member) => member.userId === "fin-a" && member.department === "Finance"));
  assert(!assignees.members.some((member) => ["fin-other", "fin-disabled", "admin-a"].includes(member.userId)));

  const handoffInput = { recipientUserId: "fin-a", expectedRevision: 1, reason: "Finance must verify settlement source amounts." };
  await rejects(
    () => service.handoff(ctx("ops-other", "org-b", "Operations"), one.id, handoffInput),
    /not found/i
  );
  await rejects(
    () => service.handoff(ctx("ops-b", "org-a", "Operations"), one.id, handoffInput),
    /not found/i
  );
  await rejects(
    () => service.handoff(ctx("ops-a", "org-a", "Operations"), one.id, { ...handoffInput, recipientUserId: "fin-other" }),
    /not found/i
  );
  await rejects(
    () => service.handoff(ctx("ops-a", "org-a", "Operations"), one.id, { ...handoffInput, recipientUserId: "fin-disabled" }),
    /not found/i
  );
  await rejects(
    () => service.handoff(ctx("ops-a", "org-a", "Operations"), one.id, { ...handoffInput, expectedRevision: 0 }),
    /positive integer/i
  );
  await rejects(
    () => service.handoff(ctx("ops-a", "org-a", "Operations"), one.id, { ...handoffInput, reason: "short" }),
    /at least/i
  );

  const assigned = await service.handoff(ctx("ops-a", "org-a", "Operations"), one.id, handoffInput);
  assert.equal(assigned.ownerUserId, "fin-a");
  assert.equal(assigned.department, "Finance");
  assert.equal(assigned.revision, 2);
  assert.equal(assigned.evidenceState, "unverified");
  assert.equal(assigned.status, "open");
  assert.equal((await service.list(ctx("ops-a", "org-a", "Operations"))).items.length, 0);
  assert.equal((await service.list(ctx("fin-a", "org-a", "Finance"))).items.length, 1);
  await rejects(() => service.findById(ctx("ops-a", "org-a", "Operations"), one.id), /not found/i);
  await rejects(
    () => service.handoff(ctx("ops-a", "org-a", "Operations"), one.id,
      { recipientUserId: "ops-b", expectedRevision: 2, reason: "Returning to Operations for review" }),
    /not found/i
  );

  await rejects(
    () => service.handoff(ctx("fin-a", "org-a", "Finance"), one.id,
      { recipientUserId: "ops-b", expectedRevision: 1, reason: "Returning to Operations for review" }),
    /reload/i
  );
  const currentMembership = db.memberships.get("m6")!;
  db.memberships.set("m6", { ...currentMembership, role: "Customer Service" });
  await rejects(
    () => service.handoff(ctx("fin-a", "org-a", "Finance"), one.id,
      { recipientUserId: "ops-b", expectedRevision: 2, reason: "Returning to Operations for review" }),
    /membership/i
  );
  db.memberships.set("m6", currentMembership);
  // Competing handoffs at the same version must produce exactly one winner.
  const results = await Promise.allSettled([
    service.handoff(ctx("fin-a", "org-a", "Finance"), one.id,
      { recipientUserId: "ops-b", expectedRevision: 2, reason: "Escalate source checking to Operations" }),
    service.handoff(ctx("admin-a", "org-a", "Administrator"), one.id,
      { recipientUserId: "fin-b", expectedRevision: 2, reason: "Administrator routing to second reviewer" }),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(results.filter((x) => x.status === "rejected").length, 1);
  const final = await service.findById(ctx("admin-a", "org-a", "Administrator"), one.id);
  assert.equal(final.revision, 3);
  assert.equal(final.evidenceState, "unverified");
  const updatedAudit = await db.auditLogsRepo.findMany(ctx("admin-a", "org-a", "Administrator"));
  const handoffs = updatedAudit.items.filter((entry) => entry.action === "banking_case:handoff");
  assert.equal(handoffs.length, 2);
  assert(handoffs.every((entry) => entry.organizationId === "org-a" && entry.status === "success"));
  console.log("PASS: banking-case handoff membership isolation, eligible staff directory, Finance routing, revision conflict, stale-role, concurrency and audit invariants");
  console.log("PASS: banking case tenant isolation, assigned inbox, admin read, stale-role and disabled-user fail-closed, unverified-only state, missing/cross-tenant evidence refusal, transactional audit");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
