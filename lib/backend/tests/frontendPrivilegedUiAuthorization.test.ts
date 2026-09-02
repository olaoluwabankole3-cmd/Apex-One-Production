/**
 * APEX ONE — Frontend Privileged UI Authorization Test Suite
 *
 * Stage 2D invariant:
 * Internal/admin/privileged UI decisions must be derived from authenticated
 * session capability metadata exposed by AuthContext. RoleContext remains
 * presentation-only and must never gate privileged UI access.
 *
 * Frontend checks are UX guards only. Backend authorization remains authoritative.
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

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

export async function runFrontendPrivilegedUiAuthorizationTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Frontend Privileged UI Authorization";

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

  await testCase("1. InternalOnlyShield derives internal access from authenticated session capability", () => {
    const source = readSource("components/layout/InternalOnlyShield.tsx");

    if (!source.includes("useAuth")) {
      throw new Error("InternalOnlyShield does not consume AuthContext");
    }
    if (!source.includes('hasPermission("org:read")')) {
      throw new Error("InternalOnlyShield does not require the internal org:read session capability");
    }
    if (source.includes("RoleContext") || /\buseRole\s*\(/.test(source) || /user\??\.role/.test(source)) {
      throw new Error("InternalOnlyShield still trusts role state instead of session capabilities");
    }
  });

  await testCase("2. InternalOnlyShield supports additional capability requirements and fails closed while loading", () => {
    const source = readSource("components/layout/InternalOnlyShield.tsx");

    if (!source.includes("requiredPermission?: string")) {
      throw new Error("InternalOnlyShield cannot express a specific privileged capability");
    }
    if (!source.includes("hasPermission(requiredPermission)")) {
      throw new Error("InternalOnlyShield does not evaluate the requested session capability");
    }
    if (!/if\s*\(isLoading\)\s*\{\s*return null;/s.test(source)) {
      throw new Error("InternalOnlyShield does not fail closed while session state is unresolved");
    }
  });

  await testCase("3. Organizational Control Center is gated by org:admin", () => {
    const source = readSource("app/settings/page.tsx");

    if (!source.includes("InternalOnlyShield")) {
      throw new Error("Settings page is not wrapped in the privileged UI shield");
    }
    if (!source.includes('requiredPermission="org:admin"')) {
      throw new Error("Settings page does not require org:admin");
    }
    if (!/<InternalOnlyShield[^>]*>[\s\S]*<SettingsWorkspace\s*\/>[\s\S]*<\/InternalOnlyShield>/.test(source)) {
      throw new Error("SettingsWorkspace can render outside the admin shield");
    }
  });

  await testCase("4. Entire Value Intelligence subtree requires internal value:read capability", () => {
    const layoutPath = "app/value-intelligence/layout.tsx";
    if (!fs.existsSync(path.join(process.cwd(), layoutPath))) {
      throw new Error("Value Intelligence subtree has no shared authorization layout");
    }

    const source = readSource(layoutPath);
    if (!source.includes("InternalOnlyShield")) {
      throw new Error("Value Intelligence layout is not shielded");
    }
    if (!source.includes('requiredPermission="value:read"')) {
      throw new Error("Value Intelligence layout does not require value:read");
    }
  });

  await testCase("5. Root staff dashboard selection uses session capability, not RoleContext", () => {
    const source = readSource("app/page.tsx");

    if (!source.includes("useAuth")) {
      throw new Error("Root dashboard does not consume authenticated session state");
    }
    if (!source.includes('hasPermission("org:read")')) {
      throw new Error("Root dashboard does not require org:read before rendering the staff experience");
    }
    if (source.includes("RoleContext") || /\buseRole\s*\(/.test(source)) {
      throw new Error("Root dashboard still selects privileged UI through RoleContext");
    }
  });

  await testCase("6. AuthContext capability helper reads only server-hydrated user permission metadata", () => {
    const source = readSource("components/auth/AuthContext.tsx");

    if (!source.includes("authClient.getCurrentSession()")) {
      throw new Error("AuthContext is not hydrated from the current server session");
    }
    if (!source.includes("user.permissions.includes(permission)")) {
      throw new Error("hasPermission is not derived from authenticated user permission metadata");
    }
    if (/useState\s*<[^>]*Permission[^>]*>/.test(source)) {
      throw new Error("AuthContext contains independent mutable permission state");
    }
  });

  await testCase("7. Backend role capability model preserves the internal/admin boundary assumed by UI guards", () => {
    const source = readSource("lib/backend/core/security.ts");
    const customerBlock = source.match(/"Customer \/ Investor"\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";
    const ceoBlock = source.match(/CEO\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";
    const administratorBlock = source.match(/Administrator\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";

    if (customerBlock.includes('"org:read"') || customerBlock.includes('"org:admin"')) {
      throw new Error("External customer role unexpectedly carries internal/admin organization capability");
    }
    if (!ceoBlock.includes('"org:admin"') || !administratorBlock.includes('"org:admin"')) {
      throw new Error("Administrative roles no longer carry org:admin capability");
    }
  });

  await testCase("8. Privileged boundary source files contain no role-string authorization checks", () => {
    const boundaryFiles = [
      "components/layout/InternalOnlyShield.tsx",
      "app/page.tsx",
      "app/settings/page.tsx",
      "app/value-intelligence/layout.tsx",
    ];

    for (const relPath of boundaryFiles) {
      const source = readSource(relPath);
      if (/role\s*(===|!==|==|!=)/.test(source)) {
        throw new Error(`${relPath} contains role-string authorization logic`);
      }
      if (/\bsetRole\b/.test(source)) {
        throw new Error(`${relPath} contains mutable role authority`);
      }
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
