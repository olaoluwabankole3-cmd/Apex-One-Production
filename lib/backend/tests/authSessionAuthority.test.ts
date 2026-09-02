/**
 * APEX ONE — Auth Session Authority & Contract Regression Suite
 */

import * as fs from "fs";
import * as path from "path";
import { AuthService } from "../domains/auth/authService";
import {
  InMemorySessionStore,
  LocalAuthenticationProvider,
} from "../domains/auth/authProvider";
import { InMemoryRateLimiter } from "../domains/auth/rateLimiter";
import { DatabaseStore } from "../database/store";
import { DemoDataProvider } from "../database/demoDataProvider";
import {
  AUTH_COOKIE_NAME,
  getPermissionsForRole,
  resolveTenantContext,
} from "../core/security";
import { ForbiddenError, TenantContext, UnauthorizedError } from "../core/errors";
import { buildAuthSessionMetadata } from "../domains/auth/authSessionContract";

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

export async function runAuthSessionAuthorityTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Auth Session Authority & Contract";

  const db = DatabaseStore.createFreshStore();
  new DemoDataProvider().seedInitialTenants(db);

  const now = new Date().toISOString();
  db.organizations.set("org-session-secondary", {
    id: "org-session-secondary",
    name: "Session Secondary Org",
    displayName: "Session Secondary Org",
    slug: "session-secondary",
    industry: "Technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
  });
  db.memberships.set("mem-session-secondary-elena", {
    id: "mem-session-secondary-elena",
    organizationId: "org-session-secondary",
    userId: "usr-elena-cho",
    role: "Compliance",
    department: "Compliance",
    joinedAt: now,
  });

  const sessionStore = new InMemorySessionStore();
  const authProvider = new LocalAuthenticationProvider(sessionStore, db);
  const rateLimiter = new InMemoryRateLimiter();
  const authService = new AuthService(db, authProvider, sessionStore, rateLimiter);

  const testCase = async (
    testName: string,
    fn: () => Promise<void> | void
  ) => {
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

  const loginElena = (requestId: string) =>
    authService.login(
      {
        email: "e.cho@apexsync.ai",
        password: "ApexEnterprise2026!",
      },
      requestId
    );

  await testCase(
    "1. Login emits canonical safe metadata and strips per-org role claims",
    async () => {
      const result = await loginElena("stage2_session_contract_login");
      const metadata = buildAuthSessionMetadata(
        result.session,
        result.availableOrganizations
      );

      if (!metadata.user?.id || !metadata.organization?.id) {
        throw new Error("Canonical metadata is missing active identity");
      }
      if (!Array.isArray(metadata.user.permissions)) {
        throw new Error("Canonical metadata is missing server-derived permissions");
      }
      if (!metadata.expiresAt) {
        throw new Error("Login metadata is missing session expiry");
      }
      if (metadata.availableOrganizations.length < 2) {
        throw new Error("Login did not preserve verified organization memberships");
      }
      for (const organization of metadata.availableOrganizations) {
        const keys = Object.keys(organization).sort().join(",");
        if (keys !== "id,name") {
          throw new Error(`Available organization leaked non-canonical fields: ${keys}`);
        }
      }
      if ((metadata as any).token || (metadata as any).sessionToken) {
        throw new Error("Canonical metadata leaked a raw session token");
      }
    }
  );

  await testCase(
    "2. /auth/me hydration preserves authoritative role, permissions, expiry, and org choices",
    async () => {
      const result = await loginElena("stage2_session_contract_me");
      const token = result.session.token;
      const ctx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        sessionStore
      );

      const metadata = await authService.getCurrentSession(ctx, token);

      if (metadata.user.id !== ctx.userId) throw new Error("User identity diverged from session");
      if (metadata.organization.id !== ctx.organizationId) throw new Error("Organization diverged from session");
      if (metadata.user.role !== ctx.userRole) throw new Error("Role diverged from session");
      if (JSON.stringify(metadata.user.permissions) !== JSON.stringify(ctx.permissions)) {
        throw new Error("Permissions diverged from backend session");
      }
      if (metadata.expiresAt !== result.session.expiresAt) {
        throw new Error("Expiry diverged from backend session");
      }
      if (!metadata.availableOrganizations.some((organization) => organization.id === "org-session-secondary")) {
        throw new Error("Hydrated session lost an available organization");
      }
    }
  );

  await testCase(
    "3. Organization switching rotates current token and preserves available organizations",
    async () => {
      const login = await loginElena("stage2_session_contract_switch");
      const oldToken = login.session.token;
      const oldCtx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${oldToken}` },
        sessionStore
      );

      const switched = await authService.switchOrganization(
        "org-session-secondary",
        oldCtx,
        oldToken
      );

      if (switched.session.organizationId !== "org-session-secondary") {
        throw new Error("Switch did not establish target tenant");
      }
      if (switched.session.role !== "Compliance") {
        throw new Error("Switch did not derive role from target membership");
      }
      if (
        JSON.stringify(switched.session.permissions) !==
        JSON.stringify([...getPermissionsForRole("Compliance")])
      ) {
        throw new Error("Switch did not derive target-org permissions");
      }
      if (await sessionStore.getSession(oldToken)) {
        throw new Error("Previous token remained active after switch");
      }
      if (
        !switched.availableOrganizations.some((organization) => organization.id === "apex-demo") ||
        !switched.availableOrganizations.some((organization) => organization.id === "org-session-secondary")
      ) {
        throw new Error("Switch lost verified organization choices");
      }

      const newCtx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${switched.session.token}` },
        sessionStore
      );
      const refreshed = await authService.getCurrentSession(newCtx, switched.session.token);
      if (refreshed.organization.id !== "org-session-secondary") {
        throw new Error("Post-switch hydration lost active organization");
      }
      if (refreshed.user.role !== "Compliance") {
        throw new Error("Post-switch hydration lost target-org role");
      }
    }
  );

  await testCase(
    "4. Rejected organization switch preserves current authenticated session",
    async () => {
      const login = await loginElena("stage2_session_contract_failed_switch");
      const token = login.session.token;
      const ctx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        sessionStore
      );

      let forbidden = false;
      try {
        await authService.switchOrganization("org-not-a-membership", ctx, token);
      } catch (err) {
        forbidden = err instanceof ForbiddenError;
      }

      if (!forbidden) throw new Error("Unauthorized switch was not rejected");
      if (!(await sessionStore.getSession(token))) {
        throw new Error("Rejected switch revoked valid current session");
      }
    }
  );

  await testCase(
    "5. Expired sessions cannot hydrate /auth/me metadata",
    async () => {
      const expired = await sessionStore.createSession({
        user: { id: "usr-elena-cho", email: "e.cho@apexsync.ai", name: "Elena Cho" },
        org: { id: "apex-demo", name: "Apex Demo Group" },
        role: "Relationship Manager",
        permissions: [...getPermissionsForRole("Relationship Manager")],
        ttlSeconds: -1,
      });

      const ctx: TenantContext = {
        organizationId: "apex-demo",
        userId: "usr-elena-cho",
        userEmail: "e.cho@apexsync.ai",
        userRole: "Relationship Manager",
        permissions: [...getPermissionsForRole("Relationship Manager")],
        requestId: "stage2_expired_session",
        timestamp: now,
      };

      let rejected = false;
      try {
        await authService.getCurrentSession(ctx, expired.token);
      } catch (err) {
        rejected = err instanceof UnauthorizedError;
      }

      if (!rejected) throw new Error("Expired session hydrated frontend metadata");
    }
  );

  await testCase(
    "6. Logout revokes backend session and remains idempotent",
    async () => {
      const login = await loginElena("stage2_session_contract_logout");
      const token = login.session.token;
      const ctx = await resolveTenantContext(
        { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        sessionStore
      );

      await authService.logout(token, ctx);
      if (await sessionStore.getSession(token)) {
        throw new Error("Logout left backend session active");
      }
      if ((await authService.logout(token)) !== true) {
        throw new Error("Repeated logout was not idempotent");
      }
    }
  );

  await testCase(
    "7. Frontend refresh and API client contain no silent authentication path",
    () => {
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "components/auth/AuthContext.tsx"),
        "utf-8"
      );
      const apiClient = fs.readFileSync(
        path.join(process.cwd(), "lib/apiClient.ts"),
        "utf-8"
      );

      const refreshMatch = authContext.match(
        /const refreshSession = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/
      );
      if (!refreshMatch) throw new Error("Could not locate refreshSession implementation");
      if (/authClient\.login\s*\(/.test(refreshMatch[1])) {
        throw new Error("refreshSession silently invokes login");
      }
      if (
        apiClient.includes("/api/v1/auth/login") ||
        apiClient.includes("bootstrapSession") ||
        apiClient.includes("bootstrapPromise")
      ) {
        throw new Error("apiClient contains a hidden auth bootstrap/retry path");
      }
    }
  );

  await testCase(
    "8. Role state cannot escalate privileges and password changes remain tenant-scoped",
    () => {
      const roleContext = fs.readFileSync(
        path.join(process.cwd(), "components/layout/RoleContext.tsx"),
        "utf-8"
      );
      const roleSwitcher = fs.readFileSync(
        path.join(process.cwd(), "components/layout/RoleSwitcher.tsx"),
        "utf-8"
      );
      const authServiceSource = fs.readFileSync(
        path.join(process.cwd(), "lib/backend/domains/auth/authService.ts"),
        "utf-8"
      );
      const authRepositorySource = fs.readFileSync(
        path.join(process.cwd(), "lib/backend/domains/auth/authIdentityRepository.ts"),
        "utf-8"
      );

      if (/\bsetRole\b/.test(roleContext) || /\bsetRole\b/.test(roleSwitcher)) {
        throw new Error("Frontend exposes client-side role mutation");
      }
      if (
        authServiceSource.includes("this.database.users.get(dto.userId)") ||
        authServiceSource.includes("this.database.users.set(user.id")
      ) {
        throw new Error("Password-change service bypasses tenant-scoped repository");
      }
      if (!authRepositorySource.includes("getUserMembership(userId, ctx.organizationId)")) {
        throw new Error("Password repository no longer proves target membership");
      }
    }
  );

  await testCase(
    "9. Login, /auth/me, switch, logout, and AuthContext share reconciled lifecycle",
    () => {
      const loginRoute = fs.readFileSync(path.join(process.cwd(), "app/api/v1/auth/login/route.ts"), "utf-8");
      const meRoute = fs.readFileSync(path.join(process.cwd(), "app/api/v1/auth/me/route.ts"), "utf-8");
      const switchRoute = fs.readFileSync(path.join(process.cwd(), "app/api/v1/auth/switch-organization/route.ts"), "utf-8");
      const logoutRoute = fs.readFileSync(path.join(process.cwd(), "app/api/v1/auth/logout/route.ts"), "utf-8");
      const authContext = fs.readFileSync(path.join(process.cwd(), "components/auth/AuthContext.tsx"), "utf-8");

      if (!loginRoute.includes("buildAuthSessionMetadata")) throw new Error("Login route lacks canonical metadata");
      if (!meRoute.includes("getCurrentSession") || !meRoute.includes("getRequestSessionToken")) {
        throw new Error("/auth/me does not revalidate server session token");
      }
      if (!switchRoute.includes("buildAuthSessionMetadata") || !switchRoute.includes("getRequestSessionToken")) {
        throw new Error("Switch route does not return/rotate canonical state");
      }
      if (!logoutRoute.includes("withClearedSessionCookie") || !logoutRoute.includes("authenticated: false")) {
        throw new Error("Logout route does not guarantee browser session clearing");
      }
      if (!authContext.includes("applySessionState") || !authContext.includes("clearSessionState") || !authContext.includes("apiClient.onUnauthorized")) {
        throw new Error("AuthContext does not centralize auth-state propagation");
      }
    }
  );

  await testCase(
    "10. Frontend source tree contains no embedded authentication credential literals",
    () => {
      const roots = ["app", "components", "lib"];
      const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
      const filesToAudit: string[] = [];

      const walk = (absolutePath: string, relativePath: string) => {
        if (!fs.existsSync(absolutePath)) return;
        for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
          const nextAbsolute = path.join(absolutePath, entry.name);
          const nextRelative = path.join(relativePath, entry.name);
          if (entry.isDirectory()) {
            if (
              nextRelative === path.join("lib", "backend") ||
              nextRelative.startsWith(path.join("lib", "backend") + path.sep)
            ) continue;
            walk(nextAbsolute, nextRelative);
            continue;
          }
          if (sourceExtensions.has(path.extname(entry.name))) filesToAudit.push(nextRelative);
        }
      };

      for (const root of roots) walk(path.join(process.cwd(), root), root);

      const passwordPropertyLiteral = /\bpassword\s*:\s*["'][^"'\r\n]+["']/i;
      const passwordAssignmentLiteral = /\bpassword\s*=\s*["'][^"'\r\n]+["']/i;
      const rawSessionSecret = /\bapex_sec_[A-Za-z0-9_-]+/;

      for (const relativePath of filesToAudit) {
        const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
        if (
          passwordPropertyLiteral.test(source) ||
          passwordAssignmentLiteral.test(source) ||
          rawSessionSecret.test(source)
        ) {
          throw new Error(`Embedded frontend authentication credential detected in ${relativePath}`);
        }
      }
    }
  );

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passedCount,
    failedCount,
    passed: failedCount === 0,
    results,
  };
}
