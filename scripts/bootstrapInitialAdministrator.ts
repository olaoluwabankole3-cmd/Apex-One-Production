import { createHash } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import { hashPassword } from "../lib/backend/core/crypto";
import { getPermissionsForRole } from "../lib/backend/core/security";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function stableId(prefix: string, value: string): string {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `${prefix}_${digest}`;
}

function validateSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    throw new Error(
      "APEX_BOOTSTRAP_ORG_SLUG must be 3-64 lowercase letters, numbers, or hyphens"
    );
  }
  return slug;
}

function validateUsername(value: string | undefined): string | undefined {
  const username = value?.trim().toLowerCase();
  if (!username) return undefined;
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      "APEX_BOOTSTRAP_ADMIN_USERNAME must be 3-64 characters using letters, numbers, dot, underscore, or hyphen"
    );
  }
  return username;
}

async function main(): Promise<void> {
  if (process.env.APEX_BOOTSTRAP_CONFIRM !== "CREATE_INITIAL_ADMIN") {
    throw new Error(
      "Refusing bootstrap. Set APEX_BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN for this one-time operation."
    );
  }

  const databaseUrl = required("DATABASE_URL");
  const orgName = required("APEX_BOOTSTRAP_ORG_NAME");
  const orgDisplayName =
    process.env.APEX_BOOTSTRAP_ORG_DISPLAY_NAME?.trim() || orgName;
  const orgSlug = validateSlug(required("APEX_BOOTSTRAP_ORG_SLUG"));
  const industry = required("APEX_BOOTSTRAP_ORG_INDUSTRY");
  const currency = required("APEX_BOOTSTRAP_ORG_CURRENCY");
  const currencySymbol = required("APEX_BOOTSTRAP_ORG_CURRENCY_SYMBOL");
  const timezone = required("APEX_BOOTSTRAP_ORG_TIMEZONE");

  const adminEmail = required("APEX_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("APEX_BOOTSTRAP_ADMIN_EMAIL is not a valid email address");
  }
  const adminUsername = validateUsername(
    process.env.APEX_BOOTSTRAP_ADMIN_USERNAME
  );
  const adminName = required("APEX_BOOTSTRAP_ADMIN_NAME");
  const adminTitle =
    process.env.APEX_BOOTSTRAP_ADMIN_TITLE?.trim() || "Administrator";
  const adminPassword = required("APEX_BOOTSTRAP_ADMIN_PASSWORD");

  // Validate the role against the backend authority before writing anything.
  getPermissionsForRole("Administrator");

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();

  const organizationId = stableId("org", orgSlug);
  const userId = stableId("usr", adminEmail);
  const membershipId = stableId("mem", `${organizationId}:${userId}`);
  const now = new Date().toISOString();

  const existingOrganization = await store.findOrganizationById(organizationId);
  if (existingOrganization && existingOrganization.slug !== orgSlug) {
    throw new Error("Deterministic bootstrap organization ID collides with another organization");
  }

  if (!existingOrganization) {
    const organization: OrganizationRecord = {
      id: organizationId,
      name: orgName,
      displayName: orgDisplayName,
      slug: orgSlug,
      industry,
      plan: "enterprise",
      currency,
      currencySymbol,
      timezone,
      createdAt: now,
      updatedAt: now,
    };
    await store.createOrganizationRecord(organization);
  }

  const existingUser = await store.findUserByEmail(adminEmail);
  if (existingUser && existingUser.id !== userId) {
    throw new Error(
      "An account with the bootstrap administrator email already exists under another ID"
    );
  }

  if (!existingUser) {
    const credentials = hashPassword(adminPassword);
    const user: UserRecord = {
      id: userId,
      email: adminEmail,
      username: adminUsername,
      name: adminName,
      title: adminTitle,
      status: "active",
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      passwordChangeRequired: true,
      createdAt: now,
    };
    await store.createUserRecord(user);
  }

  const existingMembership = await store.findUserMembership(
    userId,
    organizationId
  );
  if (existingMembership && existingMembership.role !== "Administrator") {
    throw new Error(
      "Initial administrator already has a different role in the target organization"
    );
  }

  if (!existingMembership) {
    const membership: OrganizationMembershipRecord = {
      id: membershipId,
      organizationId,
      userId,
      role: "Administrator",
      department: "Administration",
      joinedAt: now,
    };
    await store.createMembershipRecord(membership);
  }

  console.log(
    JSON.stringify(
      {
        status: "ready",
        organizationId,
        administratorUserId: userId,
        administratorEmail: adminEmail,
        role: "Administrator",
        passwordChangeRequired: true,
        createdOrganization: !existingOrganization,
        createdUser: !existingUser,
        createdMembership: !existingMembership,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "Initial administrator bootstrap failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
