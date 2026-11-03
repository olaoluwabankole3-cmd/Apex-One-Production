process.env.TEST_ENV = "true";

import assert from "node:assert/strict";
import { DatabaseStore } from "../lib/backend/database/store";
import { BankingCaseService } from "../lib/backend/domains/banking-cases/bankingCaseService";
import { BankingCaseTransferService } from "../lib/backend/domains/banking-cases/bankingCaseTransferService";
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
const transfers = new BankingCaseTransferService(db);
const sourceFree = {
  title: "Settlement requires review", description: "Investigate pending settlement exception without alleging a proven loss",
  department: "Operations" as const, priority: "normal" as const,
};

async function rejects(work: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(work, pattern);
}

async function main() {
  assert(getPermissionsForRole("Finance").includes("case:read"));
  assert(getPermissionsForRole("Finance").includes("case:assign"));
  assert(!getPermissionsForRole("Finance").includes("workflow:write"));
  assert(!getPermissionsForRole("Finance").includes("audit:read"));
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

  const ops = ctx("ops-a", "org-a", "Operations");
  const fin = ctx("fin-a", "org-a", "Finance");
  const admin = ctx("admin-a", "org-a", "Administrator");
  const handoffInput = {
    recipientUserId: "fin-a", expectedRevision: 1,
    reason: "Finance must verify settlement source amounts.",
  };
  await rejects(() => transfers.offer(ctx("ops-other", "org-b", "Operations"), one.id, handoffInput), /not found/i);
  await rejects(() => transfers.offer(ctx("ops-b", "org-a", "Operations"), one.id, handoffInput), /not found/i);
  await rejects(() => transfers.offer(ops, one.id,
    { ...handoffInput, recipientUserId: "fin-other" }), /not found/i);
  await rejects(() => transfers.offer(ops, one.id,
    { ...handoffInput, recipientUserId: "fin-disabled" }), /not found/i);
  await rejects(() => transfers.offer(ops, one.id,
    { ...handoffInput, expectedRevision: 0 }), /positive integer/i);
  await rejects(() => transfers.offer(ops, one.id,
    { ...handoffInput, reason: "short" }), /at least/i);
  await rejects(() => service.handoff(ops, one.id, handoffInput),
    /emergency administrators/i, "Normal staff must not use instant legacy reassignment");

  const offered = await transfers.offer(ops, one.id, handoffInput);
  assert.equal(offered.ownerUserId, "ops-a");
  assert.equal(offered.department, "Operations");
  assert.equal(offered.revision, 2);
  assert(offered.pendingTransfer?.id);
  assert.equal((await service.list(ops)).items.length, 1, "Sender keeps responsibility while offered");
  assert.equal((await service.list(fin)).items.length, 0, "Recipient has NO case read authority yet");
  await rejects(() => service.findById(fin, one.id), /not found/i);
  const invitations = await transfers.listMine(fin);
  assert.equal(invitations.items.length, 1);
  assert.equal(invitations.items[0].caseId, one.id);
  assert(!JSON.stringify(invitations).includes(one.description), "Private case description is never in the invitation");
  assert(!JSON.stringify(invitations).includes(handoffInput.reason), "Freeform reason is not an invitation preview");
  assert.equal((await transfers.listMine(ctx("ops-b", "org-a", "Operations"))).items.length, 0);
  assert.equal((await transfers.listMine(ctx("fin-other", "org-b", "Finance"))).items.length, 0);
  await rejects(() => transfers.offer(ops, one.id, { ...handoffInput, expectedRevision: 2 }),
    /awaiting the receiver/i);
  await rejects(() => service.handoff(admin, one.id,
    { recipientUserId: "fin-b", expectedRevision: 2,
      reason: "Emergency override must not jump over the pending recipient" }), /pending/i);

  const acceptInput = { transferId: offered.pendingTransfer!.id, expectedRevision: 2 };
  await rejects(() => transfers.accept(ctx("fin-b", "org-a", "Finance"), one.id, acceptInput),
    /not found/i, "A different Finance member cannot accept a named invitation");
  await rejects(() => transfers.accept(ctx("fin-other", "org-b", "Finance"), one.id, acceptInput),
    /not found/i, "Another tenant cannot accept");
  await rejects(() => transfers.accept(fin, one.id,
    { ...acceptInput, expectedRevision: 1 }), /changed/i);
  const race = await Promise.allSettled([
    transfers.accept(fin, one.id, acceptInput),
    transfers.accept(fin, one.id, acceptInput),
  ]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(race.filter(x => x.status === "rejected").length, 1);
  const assigned = await service.findById(fin, one.id);
  assert.equal(assigned.ownerUserId, "fin-a");
  assert.equal(assigned.department, "Finance");
  assert.equal(assigned.revision, 3);
  assert.equal(assigned.pendingTransfer, null);
  assert.equal(assigned.evidenceState, "unverified");
  assert.equal(assigned.status, "open");
  await rejects(() => service.findById(ops, one.id), /not found/i);
  assert.equal((await transfers.listMine(fin)).items.length, 0);
  await rejects(() => transfers.cancel(ops, one.id, acceptInput), /not found/i);

  // Revoked membership before acceptance denies and retains sender custody.
  const second = await service.create(ops, { ...sourceFree, title: "Second settlement investigation" });
  const secondOffer = await transfers.offer(ops, second.id, {
    ...handoffInput, expectedRevision: 1,
  });
  const currentMember = db.memberships.get("m6")!;
  db.memberships.set("m6", { ...currentMember, role: "Customer Service" });
  await rejects(() => transfers.accept(fin, second.id, {
    transferId: secondOffer.pendingTransfer!.id, expectedRevision: 2,
  }), /membership/i);
  db.memberships.set("m6", currentMember);
  assert.equal((await service.findById(ops, second.id)).ownerUserId, "ops-a");

  // Declines are receipts only: receiver never gains private case read.
  const declined = await transfers.decline(fin, second.id, {
    transferId: secondOffer.pendingTransfer!.id, expectedRevision: 2,
    note: "Finance is unable to take accountability without an approved investigation owner",
  });
  assert.deepEqual(declined, { caseId: second.id,
    transferId: secondOffer.pendingTransfer!.id, status: "declined", ownerUnchanged: true });
  const afterDecline = await service.findById(ops, second.id);
  assert.equal(afterDecline.pendingTransfer, null);
  assert.equal(afterDecline.ownerUserId, "ops-a");
  await rejects(() => transfers.accept(fin, second.id, {
    transferId: secondOffer.pendingTransfer!.id, expectedRevision: 3,
  }), /not found/i);

  // Sender may withdraw before acceptance; no recipient can revive an offer.
  const third = await transfers.offer(ops, second.id, {
    ...handoffInput, expectedRevision: 3,
  });
  const cancelled = await transfers.cancel(ops, second.id, {
    transferId: third.pendingTransfer!.id, expectedRevision: 4,
  });
  assert.equal(cancelled.ownerUserId, "ops-a");
  assert.equal(cancelled.pendingTransfer, null);
  await rejects(() => transfers.accept(fin, second.id, {
    transferId: third.pendingTransfer!.id, expectedRevision: 5,
  }), /not found/i);

  // The separately audited legacy path remains ADMINISTRATOR EMERGENCY ONLY.
  const emergency = await service.handoff(admin, second.id, {
    recipientUserId: "fin-b", expectedRevision: 5,
    reason: "Institutional administrator emergency reassignment after cancelled invitation",
  });
  assert.equal(emergency.ownerUserId, "fin-b");
  assert.equal(emergency.revision, 6);
  const updatedAudit = await db.auditLogsRepo.findMany(admin);
  for (const action of [
    "banking_case:transfer_requested", "banking_case:transfer_accepted",
    "banking_case:transfer_declined", "banking_case:transfer_cancelled",
    "banking_case:emergency_handoff",
  ]) {
    assert(updatedAudit.items.some(entry => entry.action === action && entry.organizationId === "org-a"),
      "Missing durable transfer audit event: " + action);
  }
  assert(updatedAudit.items.filter(entry => entry.action === "banking_case:transfer_accepted").length === 1,
    "Concurrent duplicate acceptance must produce exactly one audit receipt");
  console.log("PASS: accepted case transfers, custody retained until acceptance, invitation privacy, stale/role/tenant denial, one-winner CAS, decline/cancel and admin emergency audit");
  console.log("PASS: banking case tenant isolation, assigned inbox, admin read, stale-role/disabled-user fail-closed and source integrity");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
