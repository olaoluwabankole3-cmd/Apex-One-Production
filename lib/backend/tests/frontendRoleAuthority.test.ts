/**
 * APEX ONE — Frontend Role Authority Boundary Test Suite
 *
 * Stage 2C invariant:
 * RoleContext may provide a read-only presentation projection of the authenticated
 * session role, plus legacy ecosystem UI state. It must never become an
 * authentication, authorization, permission, or tenant-identity authority.
 */

import * as fs from "fs";
import * as path from "path";

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

const ROLE_CONTEXT_PATH = "components/layout/RoleContext.tsx";

const AUDITED_ROLE_CONTEXT_CONSUMERS = [
  "app/analytics/page.tsx",
  "app/operations/page.tsx",
  "app/page.tsx",
  "components/ai-workspace/AiWorkspace.tsx",
  "components/ai-workspace/SuggestedPrompts.tsx",
  "components/ai-workspace/WorkspaceHeader.tsx",
  "components/analytics/AnalyticsHeader.tsx",
  "components/customers/CustomersHeader.tsx",
  "components/dashboard/ApexConnectDashboard.tsx",
  "components/dashboard/DashboardHeader.tsx",
  "components/dashboard/ExecutiveSummary.tsx",
  "components/dashboard/KpiGrid.tsx",
  "components/dashboard/QuickActions.tsx",
  "components/dashboard/RecentActivity.tsx",
  "components/documents/DocumentsHeader.tsx",
  "components/layout/Sidebar.tsx",
  "components/layout/Topbar.tsx",
  "components/operations/OperationsHeader.tsx",
  "components/workflows/WorkflowsHeader.tsx",
].sort();

const STATE_ONLY_ROLE_CONTEXT_CONSUMERS = [
  "components/dashboard/ApexConnectDashboard.tsx",
  "components/dashboard/RecentActivity.tsx",
].sort();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

function walkSourceFiles(rootRelPath: string): string[] {
  const root = path.join(process.cwd(), rootRelPath);
  if (!fs.existsSync(root)) return [];

  const out: string[] = [];
  const visit = (absDir: string) => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const absPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        visit(absPath);
        continue;
      }
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      out.push(path.relative(process.cwd(), absPath).split(path.sep).join("/"));
    }
  };

  visit(root);
  return out.sort();
}

function discoverRoleContextConsumers(): string[] {
  const files = [...walkSourceFiles("app"), ...walkSourceFiles("components")];
  return files
    .filter((relPath) => relPath !== ROLE_CONTEXT_PATH)
    .filter((relPath) => {
      const content = readSource(relPath);
      const importsRoleContext = /from\s+["'][^"']*RoleContext["']/.test(content);
      return importsRoleContext && /\buseRole\b/.test(content);
    })
    .sort();
}

export async function runFrontendRoleAuthorityTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Frontend Role Authority Boundary";

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

  await testCase("1. RoleContext role is read-only and derived from authenticated session state", () => {
    const source = readSource(ROLE_CONTEXT_PATH);

    if (!source.includes("readonly role: Role")) {
      throw new Error("RoleContext role must be explicitly read-only");
    }
    if (!source.includes("useAuth")) {
      throw new Error("RoleContext presentation role is not sourced from AuthContext");
    }
    if (!/const\s+role\s*:\s*Role\s*=\s*user\s*&&\s*ALL_ROLES\.includes/.test(source)) {
      throw new Error("RoleContext role is not visibly derived from authenticated user.role");
    }
    if (/useState\s*<\s*Role\s*>/.test(source) || /useState\s*\(\s*["']CEO["']\s*\)/.test(source)) {
      throw new Error("RoleContext contains independent mutable/default privileged role state");
    }
  });

  await testCase("2. RoleContext exposes no client-side role mutation API", () => {
    const source = readSource(ROLE_CONTEXT_PATH);
    if (/\bsetRole\b/.test(source)) {
      throw new Error("RoleContext still exposes or references setRole");
    }
  });

  await testCase("3. RoleContext exposes no authentication or permission authority", () => {
    const source = readSource(ROLE_CONTEXT_PATH);
    const forbiddenApiPatterns = [
      /\bpermissions\s*:/,
      /\bhasPermission\s*:/,
      /\bisAuthenticated\s*:/,
      /\blogin\s*:/,
      /\blogout\s*:/,
      /\bswitchOrganization\s*:/,
      /\borganizationId\s*:/,
      /\buserId\s*:/,
    ];

    if (forbiddenApiPatterns.some((pattern) => pattern.test(source))) {
      throw new Error("RoleContext contains authentication, permission, or tenant-authority API surface");
    }
  });

  await testCase("4. No frontend source can call setRole to manufacture a role", () => {
    const frontendFiles = [...walkSourceFiles("app"), ...walkSourceFiles("components")];
    const offenders = frontendFiles.filter((relPath) => /\bsetRole\s*\(/.test(readSource(relPath)));
    if (offenders.length > 0) {
      throw new Error(`Client role mutation call found in: ${offenders.join(", ")}`);
    }
  });

  await testCase("5. Every RoleContext consumer is explicitly audited", () => {
    const discovered = discoverRoleContextConsumers();
    const expected = AUDITED_ROLE_CONTEXT_CONSUMERS;

    const unexpected = discovered.filter((p) => !expected.includes(p));
    const missing = expected.filter((p) => !discovered.includes(p));

    if (unexpected.length > 0 || missing.length > 0) {
      throw new Error(
        `RoleContext consumer audit changed. Unexpected: [${unexpected.join(", ")}]. Missing: [${missing.join(", ")}]. Review every change before updating the allowlist.`
      );
    }
  });

  await testCase("6. Legacy ecosystem-only consumers do not read role", () => {
    for (const relPath of STATE_ONLY_ROLE_CONTEXT_CONSUMERS) {
      const source = readSource(relPath);
      const destructuresRole = /const\s*\{[^}]*\brole\b[^}]*\}\s*=\s*useRole\s*\(/s.test(source);
      if (destructuresRole) {
        throw new Error(`${relPath} began consuming RoleContext.role and requires explicit security review`);
      }
    }
  });

  await testCase("7. Security boundary components use AuthContext directly, never RoleContext", () => {
    const boundaryFiles = [
      "components/layout/InternalOnlyShield.tsx",
      "components/layout/RoleSwitcher.tsx",
    ];

    for (const relPath of boundaryFiles) {
      const source = readSource(relPath);
      if (!source.includes("useAuth")) {
        throw new Error(`${relPath} does not consume authenticated session state directly`);
      }
      if (source.includes("RoleContext") || /\buseRole\s*\(/.test(source)) {
        throw new Error(`${relPath} depends on RoleContext for a security-sensitive decision`);
      }
    }
  });

  await testCase("8. RoleSwitcher is display-only and cannot enumerate or assign roles", () => {
    const source = readSource("components/layout/RoleSwitcher.tsx");
    if (source.includes("ALL_ROLES") || /\bsetRole\b/.test(source)) {
      throw new Error("RoleSwitcher can enumerate or mutate client role state");
    }
    if (!source.includes("user.role")) {
      throw new Error("RoleSwitcher is not displaying the authenticated session role");
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passedCount,
    failedCount,
    passed: failedCount === 0,
    results,
  };
}
