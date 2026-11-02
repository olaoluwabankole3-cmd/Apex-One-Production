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
];
users.forEach((user) => db.users.set(user.id, user));
const memberships: OrganizationMembershipRecord[] = [
  { id: "m1", userId: "ops-a", organizationId: "org-a", role: "Operations", joinedAt: now },
  { id: "m2", userId: "ops-b", organizationId: "org-a", role: "Operations", joinedAt: now },
  { id: "m3", userId: "admin-a", organizationId: "org-a", role: "Administrator", joinedAt: now },
  { id: "m4", userId: "ops-other", organizationId: "org-b", role: "Operations", joinedAt: now },
  { id: "m5", userId: "disabled-a", organizationId: "org-a", role: "Operations", joinedAt: now },
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
  console.log("PASS: banking case tenant isolation, assigned inbox, admin read, stale-role and disabled-user fail-closed, unverified-only state, missing/cross-tenant evidence refusal, transactional audit");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
