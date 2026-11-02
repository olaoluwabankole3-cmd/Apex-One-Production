process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type { TenantContext } from "../lib/backend/core/errors";
import { ForbiddenError } from "../lib/backend/core/errors";
import { getPermissionsForRole } from "../lib/backend/core/security";
import { listInstitutionTeam } from "../lib/backend/domains/organization/institutionTeamService";

const store = DatabaseStore.createFreshStore();
store.clearAll();
const now = "2026-11-02T00:00:00Z";

store.users.set("admin-a", {
  id: "admin-a",
  email: "admin@tenant-a.example.test",
  name: "Admin A",
  title: "Administrator",
  status: "active",
  passwordHash: "never-return",
  passwordSalt: "never-return",
  createdAt: now,
});
store.users.set("analyst-a", {
  id: "analyst-a",
  email: "analyst@tenant-a.example.test",
  name: "Analyst A",
  title: "Analyst",
  status: "pending",
  passwordHash: "secret",
  createdAt: now,
});
store.users.set("admin-b", {
  id: "admin-b",
  email: "admin@tenant-b.example.test",
  name: "Admin B",
  title: "Administrator",
  status: "active",
  createdAt: now,
});
store.memberships.set("a1", {id:"a1",organizationId:"tenant-a",userId:"admin-a",role:"Administrator",joinedAt:now});
store.memberships.set("a2", {id:"a2",organizationId:"tenant-a",userId:"analyst-a",role:"Operations",joinedAt:now});
store.memberships.set("b1", {id:"b1",organizationId:"tenant-b",userId:"admin-b",role:"Administrator",joinedAt:now});

function context(role: "Administrator" | "Operations" = "Administrator"): TenantContext {
  return {
    organizationId: "tenant-a",
    userId: "admin-a",
    userEmail: "admin@tenant-a.example.test",
    userRole: role,
    permissions: [...getPermissionsForRole(role)],
    requestId: "test-team",
    timestamp: now,
  };
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function assertForbidden(work: () => Promise<unknown>, label: string): Promise<void> {
  let error: unknown;
  try { await work(); } catch (caught) { error = caught; }
  assert(error instanceof ForbiddenError, label);
}

async function main() {
  const output = await listInstitutionTeam(context(), store);
  assert(output.members.length === 2, "Tenant A directory did not contain two members");
  assert(output.members.some((member) => member.status === "pending"), "Real user status was not preserved");
  assert(!JSON.stringify(output).includes("tenant-b"), "Cross-tenant member leaked");
  assert(!JSON.stringify(output).includes("never-return"), "Password hash or salt leaked");
  assert(!output.hasMore, "Small roster wrongly claims more results");

  await assertForbidden(
    () => listInstitutionTeam(context("Operations"), store),
    "Non-admin session could read roster"
  );

  store.memberships.set("a1", {id:"a1",organizationId:"tenant-a",userId:"admin-a",role:"Operations",joinedAt:now});
  await assertForbidden(
    () => listInstitutionTeam(context(), store),
    "Stale administrator session survived membership demotion"
  );

  // Any foreign member stays filtered even when a repository accidentally
  // hands back a cross-tenant row; do not trust arbitrary client identifiers.
  store.memberships.set("a1", {id:"a1",organizationId:"tenant-a",userId:"admin-a",role:"Administrator",joinedAt:now});
  const noisyStore = Object.assign(Object.create(null), {
    findUserMembership: store.findUserMembership.bind(store),
    findUserById: store.findUserById.bind(store),
    findMembershipsForOrganization: async (_id: string) => [
      ...await store.findMembershipsForOrganization("tenant-a"),
      ...await store.findMembershipsForOrganization("tenant-b"),
    ],
  });
  const filtered = await listInstitutionTeam(context(), noisyStore);
  assert(filtered.members.length === 2, "Service accepted cross-tenant membership records");

  console.log("CORTEX — institution team tenant-scope, admin authorization and private-field checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
