process.env.TEST_ENV = "true";

import fs from "node:fs";
import path from "node:path";
import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import {
  InMemorySessionStore,
  LocalAuthenticationProvider,
} from "../lib/backend/domains/auth/authProvider";
import { InMemoryRateLimiter } from "../lib/backend/domains/auth/rateLimiter";
import { AuthService } from "../lib/backend/domains/auth/authService";
import { hashPassword } from "../lib/backend/core/crypto";
import {
  AUTH_COOKIE_NAME,
  resolveTenantContext,
} from "../lib/backend/core/security";
import { ConflictError, UnauthorizedError } from "../lib/backend/core/errors";

type Check = {
  name: string;
  run: () => Promise<void> | void;
};

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function buildFixture() {
  const database = DatabaseStore.createFreshStore();
  database.clearAll();
  const now = "2026-09-04T00:00:00Z";

  const organizations: OrganizationRecord[] = [
    {
      id: "org-phase2-primary",
      name: "Phase 2 Primary",
      displayName: "Phase 2 Primary",
      slug: "phase2-primary",
      industry: "Technology",
      plan: "enterprise",
      currency: "USD",
      currencySymbol: "$",
      timezone: "UTC",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "org-phase2-secondary",
      name: "Phase 2 Secondary",
      displayName: "Phase 2 Secondary",
      slug: "phase2-secondary",
      industry: "Technology",
      plan: "enterprise",
      currency: "USD",
      currencySymbol: "$",
      timezone: "UTC",
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const organization of organizations) {
    database.organizations.set(organization.id, organization);
  }

  const activeCredentials = hashPassword("Phase2CurrentPassword!");
  const disabledCredentials = hashPassword("Phase2DisabledPassword!");

  const activeUser: UserRecord = {
    id: "usr-phase2-active",
    email: "phase2.active@example.test",
    username: "phase2.active",
    name: "Phase 2 Active User",
    title: "Executive",
    status: "active",
    passwordHash: activeCredentials.hash,
    passwordSalt: activeCredentials.salt,
    passwordChangeRequired: true,
    createdAt: now,
  };

  const disabledUser: UserRecord = {
    id: "usr-phase2-disabled",
    email: "phase2.disabled@example.test",
    username: "phase2.disabled",
    name: "Phase 2 Disabled User",
    title: "Executive",
    status: "disabled",
    passwordHash: disabledCredentials.hash,
    passwordSalt: disabledCredentials.salt,
    createdAt: now,
  };

  database.users.set(activeUser.id, activeUser);
  database.users.set(disabledUser.id, disabledUser);

  const memberships: OrganizationMembershipRecord[] = [
    {
      id: "mem-phase2-primary",
      organizationId: organizations[0].id,
      userId: activeUser.id,
      role: "CEO",
      joinedAt: now,
    },
    {
      id: "mem-phase2-secondary",
      organizationId: organizations[1].id,
      userId: activeUser.id,
      role: "Compliance",
      joinedAt: now,
    },
    {
      id: "mem-phase2-disabled",
      organizationId: organizations[0].id,
      userId: disabledUser.id,
      role: "CEO",
      joinedAt: now,
    },
  ];

  for (const membership of memberships) {
    database.memberships.set(membership.id, membership);
  }

  const sessionStore = new InMemorySessionStore();
  const service = new AuthService(
    database,
    new LocalAuthenticationProvider(sessionStore, database),
    sessionStore,
    new InMemoryRateLimiter()
  );

  return { database, sessionStore, service, activeUser };
}

const checks: Check[] = [
  {
    name: "username login resolves the authoritative identity and preserves multi-org choices",
    run: async () => {
      const { service } = buildFixture();
      const result = await service.login(
        {
          identifier: "PHASE2.ACTIVE",
          password: "Phase2CurrentPassword!",
        },
        "req-phase2-username"
      );
      requireCondition(result.session.userId === "usr-phase2-active", "Username resolved the wrong user");
      requireCondition(result.availableOrganizations.length === 2, "Multi-org memberships were not preserved");
      requireCondition(result.requiresPasswordChange === true, "First-login password gate was not returned");
    },
  },
  {
    name: "legacy email login remains compatible",
    run: async () => {
      const { service } = buildFixture();
      const result = await service.login(
        {
          email: "phase2.active@example.test",
          password: "Phase2CurrentPassword!",
        },
        "req-phase2-email"
      );
      requireCondition(result.session.userEmail === "phase2.active@example.test", "Email login compatibility broke");
    },
  },
  {
    name: "disabled account remains indistinguishable from invalid credentials",
    run: async () => {
      const { service } = buildFixture();
      let error: unknown;
      try {
        await service.login(
          {
            identifier: "phase2.disabled",
            password: "Phase2DisabledPassword!",
          },
          "req-phase2-disabled"
        );
      } catch (caught) {
        error = caught;
      }
      requireCondition(error instanceof UnauthorizedError, "Disabled account did not fail with UnauthorizedError");
      requireCondition(
        error.message === "Invalid email or password",
        "Disabled account leaked a distinct account-status response"
      );
    },
  },
  {
    name: "username uniqueness is enforced in the in-memory identity store",
    run: async () => {
      const { database } = buildFixture();
      const duplicateCredentials = hashPassword("Phase2DuplicatePassword!");
      let error: unknown;
      try {
        await database.createUserRecord({
          id: "usr-phase2-duplicate",
          email: "different@example.test",
          username: "PHASE2.ACTIVE",
          name: "Duplicate Username",
          title: "Operations",
          status: "active",
          passwordHash: duplicateCredentials.hash,
          passwordSalt: duplicateCredentials.salt,
          createdAt: "2026-09-04T00:00:00Z",
        });
      } catch (caught) {
        error = caught;
      }
      requireCondition(error instanceof ConflictError, "Duplicate username was accepted");
    },
  },
  {
    name: "required password change clears the server flag and revokes the old session",
    run: async () => {
      const { service, sessionStore, database, activeUser } = buildFixture();
      const login = await service.login(
        {
          identifier: activeUser.username!,
          password: "Phase2CurrentPassword!",
        },
        "req-phase2-password-login"
      );
      const ctx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${login.session.token}` },
        sessionStore
      );

      await service.changePassword(
        {
          userId: activeUser.id,
          currentPassword: "Phase2CurrentPassword!",
          newPassword: "Phase2UpdatedPassword!",
        },
        ctx
      );

      const updated = await database.findUserById(activeUser.id);
      requireCondition(updated?.passwordChangeRequired === false, "Password-change requirement was not cleared");
      requireCondition(
        (await sessionStore.getSession(login.session.token)) === undefined,
        "Old session survived password change"
      );

      const relogin = await service.login(
        {
          identifier: activeUser.username!,
          password: "Phase2UpdatedPassword!",
        },
        "req-phase2-password-relogin"
      );
      requireCondition(relogin.requiresPasswordChange === false, "Password gate returned after successful change");
    },
  },
  {
    name: "login UI exposes real identifier/password fields without browser token storage",
    run: () => {
      const login = source("components/auth/LoginScreen.tsx");
      const client = source("lib/authClient.ts");
      const context = source("components/auth/AuthContext.tsx");

      requireCondition(login.includes('id="login-identifier"'), "Login identifier field is missing");
      requireCondition(login.includes('id="login-password"'), "Login password field is missing");
      requireCondition(login.includes('id="login-submit"'), "Login submit control is missing");
      requireCondition(login.includes('href="/forgot-password"'), "Password-recovery route is not linked");
      for (const text of [login, client, context]) {
        requireCondition(!text.includes("localStorage.setItem"), "Auth UX writes authentication state to localStorage");
        requireCondition(!text.includes("sessionStorage.setItem"), "Auth UX writes authentication state to sessionStorage");
        requireCondition(!text.includes("document.cookie"), "Auth UX reads the HttpOnly session cookie");
      }
    },
  },
  {
    name: "AppShell enforces login, password-change, organization-selection, and access-denied routes",
    run: () => {
      const shell = source("components/layout/AppShell.tsx");
      requireCondition(shell.includes("/login?next="), "Unauthenticated route redirect is missing");
      requireCondition(shell.includes("/account/security?required=1"), "Required password-change redirect is missing");
      requireCondition(shell.includes("organizationSelectionRequired"), "Organization confirmation gate is missing");
      requireCondition(shell.includes('router.replace("/access-denied")'), "Unauthorized redirect is missing");
      requireCondition(shell.includes('!hasPermission("org:read")'), "Internal capability boundary is missing");
    },
  },
  {
    name: "password recovery surface is truthful and does not fake a reset request",
    run: () => {
      const recovery = source("app/forgot-password/page.tsx");
      requireCondition(
        recovery.includes("Self-service password reset is not enabled yet"),
        "Recovery limitation is not disclosed"
      );
      requireCondition(
        recovery.includes("No password-reset request has been submitted"),
        "Recovery surface does not explicitly deny fake submission"
      );
      requireCondition(!recovery.includes("fetch("), "Recovery page contains an unbacked reset request");
    },
  },
  {
    name: "authenticated user menu exposes server-backed organization switching, password change, and logout",
    run: () => {
      const menu = source("components/auth/UserMenu.tsx");
      const topbar = source("components/layout/Topbar.tsx");
      requireCondition(menu.includes("switchOrganization"), "User menu does not use server organization switching");
      requireCondition(menu.includes("await logout()"), "User menu does not use server logout");
      requireCondition(menu.includes('href="/account/security"'), "User menu does not expose password change");
      requireCondition(topbar.includes("<UserMenu />"), "Topbar does not render authenticated account controls");
      requireCondition(!menu.includes("setRole"), "User menu contains role mutation authority");
    },
  },
  {
    name: "login route accepts one identifier while preserving legacy email clients",
    run: () => {
      const route = source("app/api/v1/auth/login/route.ts");
      const provider = source("lib/backend/domains/auth/authProvider.ts");
      requireCondition(route.includes("body.identifier"), "Login route does not accept identifier");
      requireCondition(route.includes("body.email"), "Legacy email request compatibility was removed");
      requireCondition(provider.includes("findUserByLoginIdentifier"), "Authentication provider bypasses identifier authority");
    },
  },
  {
    name: "PostgreSQL auth identity migration enforces case-insensitive username uniqueness",
    run: () => {
      const migration = source("lib/backend/database/migrations/004_phase2_auth_identity.sql");
      requireCondition(
        migration.includes("apex_users_username_normalized_unique_idx"),
        "Username uniqueness migration is missing"
      );
      requireCondition(
        migration.includes("LOWER(BTRIM(record->>'username'))"),
        "Username uniqueness is not case-normalized"
      );
    },
  },
];

async function main(): Promise<void> {
  console.log("=".repeat(80));
  console.log("APEX ONE — PHASE 2 AUTHENTICATION EXPERIENCE");
  console.log("=".repeat(80));

  let passed = 0;
  for (const [index, check] of checks.entries()) {
    try {
      await check.run();
      passed += 1;
      console.log(`✅ [PASS] ${index + 1}. ${check.name}`);
    } catch (error) {
      console.error(
        `❌ [FAIL] ${index + 1}. ${check.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const failed = checks.length - passed;
  console.log("-".repeat(80));
  console.log(`TOTAL: ${checks.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=".repeat(80));
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Phase 2 authentication experience gate crashed:", error);
  process.exit(1);
});
