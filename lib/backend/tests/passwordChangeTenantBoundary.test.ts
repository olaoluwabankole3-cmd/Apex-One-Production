/**
 * APEX ONE — Password Change Tenant Boundary Test Suite
 *
 * Stage 2E invariant:
 * Password-change authorization and target identity lookup remain tenant-scoped
 * from route -> service -> repository. org:admin never grants cross-tenant user
 * lookup or credential mutation authority.
 */

import * as fs from "fs";
import * as path from "path";
import { AuthService } from "../domains/auth/authService";
import {
  TenantScopedAuthIdentityRepository,
} from "../domains/auth/authIdentityRepository";
import { InMemorySessionStore, LocalAuthenticationProvider } from "../domains/auth/authProvider";
import { InMemoryRateLimiter } from "../domains/auth/rateLimiter";
import { DatabaseStore } from "../database/store";
import { hashPassword, verifyPassword } from "../core/crypto";
import { ForbiddenError, NotFoundError, type TenantContext } from "../core/errors";
import { ROLE_PERMISSIONS } from "../core/security";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSuiteSummary {
  total: number;
  passedCount: number;
  failedCount: number;
  passed: boolean;
  results: TestResult[];
}

const ORG_A = "org-password-boundary-a";
const ORG_B = "org-password-boundary-b";
const ADMIN_A = "usr-password-admin-a";
const TARGET_A = "usr-password-target-a";
const TARGET_B = "usr-password-target-b";
const ADMIN_PASSWORD = "BoundaryAdmin2026!";
const TARGET_A_PASSWORD = "BoundaryTargetA2026!";
const TARGET_B_PASSWORD = "BoundaryTargetB2026!";
const UPDATED_PASSWORD = "BoundaryUpdated2026!";

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

function createFixture() {
  const database = DatabaseStore.createFreshStore();
  database.clearAll();

  const now = "2026-09-02T00:00:00Z";
  database.organizations.set(ORG_A, {
    id: ORG_A,
    name: "Password Boundary Org A",
    displayName: "Password Boundary Org A",
    slug: "password-boundary-a",
    industry: "Technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
  });
  database.organizations.set(ORG_B, {
    id: ORG_B,
    name: "Password Boundary Org B",
    displayName: "Password Boundary Org B",
    slug: "password-boundary-b",
    industry: "Technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
  });

  const adminCreds = hashPassword(ADMIN_PASSWORD);
  const targetACreds = hashPassword(TARGET_A_PASSWORD);
  const targetBCreds = hashPassword(TARGET_B_PASSWORD);

  database.users.set(ADMIN_A, {
    id: ADMIN_A,
    email: "admin-a@password-boundary.test",
    name: "Boundary Admin A",
    title: "Administrator",
    status: "active",
    passwordHash: adminCreds.hash,
    passwordSalt: adminCreds.salt,
    createdAt: now,
  });
  database.users.set(TARGET_A, {
    id: TARGET_A,
    email: "target-a@password-boundary.test",
    name: "Boundary Target A",
    title: "Operations",
    status: "active",
    passwordHash: targetACreds.hash,
    passwordSalt: targetACreds.salt,
    createdAt: now,
  });
  database.users.set(TARGET_B, {
    id: TARGET_B,
    email: "target-b@password-boundary.test",
    name: "Boundary Target B",
    title: "Operations",
    status: "active",
    passwordHash: targetBCreds.hash,
    passwordSalt: targetBCreds.salt,
    createdAt: now,
  });

  database.memberships.set("mem-password-admin-a", {
    id: "mem-password-admin-a",
    organizationId: ORG_A,
    userId: ADMIN_A,
    role: "Administrator",
    joinedAt: now,
  });
  database.memberships.set("mem-password-target-a", {
    id: "mem-password-target-a",
    organizationId: ORG_A,
    userId: TARGET_A,
    role: "Operations",
    joinedAt: now,
  });
  database.memberships.set("mem-password-target-b", {
    id: "mem-password-target-b",
    organizationId: ORG_B,
    userId: TARGET_B,
    role: "Operations",
    joinedAt: now,
  });

  const sessionStore = new InMemorySessionStore();
  const authProvider = new LocalAuthenticationProvider(sessionStore, database);
  const rateLimiter = new InMemoryRateLimiter();
  const authRepository = new TenantScopedAuthIdentityRepository(database);
  const authService = new AuthService(
    database,
    authProvider,
    sessionStore,
    rateLimiter,
    authRepository
  );

  const adminContext: TenantContext = {
    organizationId: ORG_A,
    userId: ADMIN_A,
    userEmail: "admin-a@password-boundary.test",
    userRole: "Administrator",
    permissions: [...ROLE_PERMISSIONS["Administrator"]],
    requestId: "req-password-admin-a",
    timestamp: now,
  };

  const nonAdminContext: TenantContext = {
    organizationId: ORG_A,
    userId: TARGET_A,
    userEmail: "target-a@password-boundary.test",
    userRole: "Operations",
    permissions: [...ROLE_PERMISSIONS["Operations"]],
    requestId: "req-password-target-a",
    timestamp: now,
  };

  return {
    database,
    sessionStore,
    authRepository,
    authService,
    adminContext,
    nonAdminContext,
  };
}

export async function runPasswordChangeTenantBoundaryTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Password Change Tenant Boundary";

  const testCase = async (testName: string, fn: () => Promise<void> | void) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: suiteName,
        testName,
        passed: true,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: any) {
      results.push({
        suite: suiteName,
        testName,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  };

  await testCase("1. Auth repository refuses cross-tenant user lookup even for an admin context", async () => {
    const { authRepository, adminContext } = createFixture();

    let rejected = false;
    try {
      await authRepository.findUserById(TARGET_B, adminContext);
    } catch (err: any) {
      rejected = err instanceof NotFoundError;
    }

    if (!rejected) {
      throw new Error("Tenant-scoped auth repository returned a user outside the authenticated organization");
    }
  });

  await testCase("2. Cross-tenant admin password changes fail before password verification and never mutate credentials", async () => {
    const { database, authService, adminContext } = createFixture();
    const before = database.users.get(TARGET_B)!;
    const originalHash = before.passwordHash;
    const originalSalt = before.passwordSalt;

    for (const attemptedCurrentPassword of [TARGET_B_PASSWORD, "DefinitelyWrong2026!"]) {
      let error: any;
      try {
        await authService.changePassword(
          {
            userId: TARGET_B,
            currentPassword: attemptedCurrentPassword,
            newPassword: UPDATED_PASSWORD,
          },
          adminContext
        );
      } catch (err: any) {
        error = err;
      }

      if (!(error instanceof NotFoundError)) {
        throw new Error("Cross-tenant target did not fail with the same not-found boundary before credential verification");
      }
    }

    const after = database.users.get(TARGET_B)!;
    if (after.passwordHash !== originalHash || after.passwordSalt !== originalSalt) {
      throw new Error("Cross-tenant password-change attempt mutated target credentials");
    }
  });

  await testCase("3. Same-tenant admin may change another member password and target sessions are revoked", async () => {
    const { database, sessionStore, authService, adminContext } = createFixture();

    const targetSession = await sessionStore.createSession({
      user: {
        id: TARGET_A,
        email: "target-a@password-boundary.test",
        name: "Boundary Target A",
      },
      org: { id: ORG_A, name: "Password Boundary Org A" },
      role: "Operations",
      permissions: [...ROLE_PERMISSIONS["Operations"]],
    });

    await authService.changePassword(
      {
        userId: TARGET_A,
        currentPassword: TARGET_A_PASSWORD,
        newPassword: UPDATED_PASSWORD,
      },
      adminContext
    );

    const updated = database.users.get(TARGET_A)!;
    if (!updated.passwordHash || !updated.passwordSalt) {
      throw new Error("Same-tenant password change removed credential material");
    }
    if (!verifyPassword(UPDATED_PASSWORD, updated.passwordHash, updated.passwordSalt)) {
      throw new Error("Same-tenant admin password change did not persist the new credential");
    }
    if (await sessionStore.getSession(targetSession.token)) {
      throw new Error("Target user's active session survived password change");
    }
  });

  await testCase("4. Non-admin user cannot change another same-tenant member password", async () => {
    const { database, authService, nonAdminContext } = createFixture();
    const before = database.users.get(ADMIN_A)!;
    const originalHash = before.passwordHash;
    const originalSalt = before.passwordSalt;

    let rejected = false;
    try {
      await authService.changePassword(
        {
          userId: ADMIN_A,
          currentPassword: ADMIN_PASSWORD,
          newPassword: UPDATED_PASSWORD,
        },
        nonAdminContext
      );
    } catch (err: any) {
      rejected = err instanceof ForbiddenError;
    }

    if (!rejected) {
      throw new Error("Non-admin user changed another member's password");
    }

    const after = database.users.get(ADMIN_A)!;
    if (after.passwordHash !== originalHash || after.passwordSalt !== originalSalt) {
      throw new Error("Forbidden same-tenant lateral password change mutated credentials");
    }
  });

  await testCase("5. Self-service password change remains allowed inside the authenticated tenant", async () => {
    const { database, authService, nonAdminContext } = createFixture();

    await authService.changePassword(
      {
        userId: TARGET_A,
        currentPassword: TARGET_A_PASSWORD,
        newPassword: UPDATED_PASSWORD,
      },
      nonAdminContext
    );

    const updated = database.users.get(TARGET_A)!;
    if (!updated.passwordHash || !updated.passwordSalt) {
      throw new Error("Self-service password change removed credential material");
    }
    if (!verifyPassword(UPDATED_PASSWORD, updated.passwordHash, updated.passwordSalt)) {
      throw new Error("Self-service password change did not persist the new credential");
    }
  });

  await testCase("6. Password-change route derives tenant only from authenticated context", () => {
    const source = readSource("app/api/v1/auth/change-password/route.ts");

    if (!source.includes("resolveTenantContext(req.headers)")) {
      throw new Error("Password-change route does not resolve authenticated tenant context");
    }
    if (!source.includes("body.organizationId !== undefined") || !source.includes("body.tenantId !== undefined")) {
      throw new Error("Password-change route does not reject client-supplied tenant selectors");
    }
    if (!/authService\.changePassword\([\s\S]*?,\s*ctx\s*\)/.test(source)) {
      throw new Error("Password-change route does not pass authenticated TenantContext into the service");
    }
  });

  await testCase("7. Service and repository preserve tenant scope through lookup and mutation", () => {
    const serviceSource = readSource("lib/backend/domains/auth/authService.ts");
    const repositorySource = readSource("lib/backend/domains/auth/authIdentityRepository.ts");
    const changePasswordBlock = serviceSource.match(
      /public async changePassword[\s\S]*?\n  public async getCurrentSession/
    )?.[0];

    if (!changePasswordBlock) {
      throw new Error("Unable to audit AuthService.changePassword source boundary");
    }
    if (/this\.database\.users\.(get|set)\s*\(/.test(changePasswordBlock)) {
      throw new Error("AuthService.changePassword bypasses the tenant-scoped auth repository");
    }
    if (!changePasswordBlock.includes("authIdentityRepository.findUserById")) {
      throw new Error("AuthService.changePassword does not use tenant-scoped repository lookup");
    }
    if (!changePasswordBlock.includes("authIdentityRepository.updatePasswordCredentials")) {
      throw new Error("AuthService.changePassword does not use tenant-scoped repository mutation");
    }

    const membershipCheck = repositorySource.indexOf(
      "getUserMembership(userId, ctx.organizationId)"
    );
    const globalUserRead = repositorySource.indexOf("database.users.get(userId)");
    if (membershipCheck < 0 || globalUserRead < 0 || membershipCheck > globalUserRead) {
      throw new Error("Auth identity repository reads the global user map before proving tenant membership");
    }
    if (!repositorySource.includes("const user = await this.requireTenantUser(userId, ctx)")) {
      throw new Error("Credential mutation does not re-check tenant membership at write time");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.filter((result) => !result.passed).length;

  return {
    total: results.length,
    passedCount,
    failedCount,
    passed: failedCount === 0,
    results,
  };
}
