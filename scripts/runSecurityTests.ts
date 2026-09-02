/**
 * APEX ONE — Command-Line Tenant Isolation Security & Release Verification Test Runner
 */

import * as fs from "fs";
import * as path from "path";

process.env.TEST_ENV = "true";

import { runTenantIsolationTestSuite } from "../lib/backend/tests/tenantIsolation.test";
import { runFrontendAuthCompatibilityTestSuite } from "../lib/backend/tests/frontendAuthCompatibility.test";
import { runFrontendRoleAuthorityTestSuite } from "../lib/backend/tests/frontendRoleAuthority.test";
import { runFrontendPrivilegedUiAuthorizationTestSuite } from "../lib/backend/tests/frontendPrivilegedUiAuthorization.test";
import { runCustomerDataTruthfulnessTestSuite } from "../lib/backend/tests/customerDataTruthfulness.test";
import { runFinancialIntegrityTestSuite } from "../lib/backend/tests/financialIntegrity.test";
import { runRelationshipIntegrityTestSuite } from "../lib/backend/tests/relationshipIntegrity.test";
import { runEntityLifecycleIntegrityTestSuite } from "../lib/backend/tests/entityLifecycleIntegrity.test";
import { runUnitOfWorkTestSuite } from "../lib/backend/tests/unitOfWork.test";
import { runImmutableUpdateContractsTestSuite } from "../lib/backend/tests/immutableUpdateContracts.test";
import { runQueryLimitsAndSortSafetyTestSuite } from "../lib/backend/tests/queryLimitsAndSortSafety.test";
import { runFinalRepositoryAuditTestSuite } from "../lib/backend/tests/finalRepositoryAudit.test";
import { runRepositoryQuerySpecificationTestSuite } from "../lib/backend/tests/repositoryQuerySpecification.test";

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

interface GenericSuiteSummary {
  suite?: string;
  suiteName?: string;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

interface RegisteredSuite {
  fileName: string;
  suiteIdentity: string;
  run: () => Promise<GenericSuiteSummary>;
}

const REGISTERED_SUITES: RegisteredSuite[] = [
  {
    fileName: "tenantIsolation.test.ts",
    suiteIdentity: "Tenant Isolation & Security Suite",
    run: runTenantIsolationTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "frontendAuthCompatibility.test.ts",
    suiteIdentity: "Frontend Auth Compatibility Suite",
    run: runFrontendAuthCompatibilityTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "frontendRoleAuthority.test.ts",
    suiteIdentity: "Frontend Role Authority Boundary Suite",
    run: runFrontendRoleAuthorityTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "frontendPrivilegedUiAuthorization.test.ts",
    suiteIdentity: "Frontend Privileged UI Authorization Suite",
    run: runFrontendPrivilegedUiAuthorizationTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "customerDataTruthfulness.test.ts",
    suiteIdentity: "Customer Data Truthfulness Suite",
    run: runCustomerDataTruthfulnessTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "financialIntegrity.test.ts",
    suiteIdentity: "Financial & Currency Integrity Suite",
    run: runFinancialIntegrityTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "relationshipIntegrity.test.ts",
    suiteIdentity: "Relationship Integrity Suite",
    run: runRelationshipIntegrityTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "entityLifecycleIntegrity.test.ts",
    suiteIdentity: "Entity Lifecycle & Deletion Integrity Suite",
    run: runEntityLifecycleIntegrityTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "unitOfWork.test.ts",
    suiteIdentity: "Unit of Work & Transaction Hardening Suite",
    run: runUnitOfWorkTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "immutableUpdateContracts.test.ts",
    suiteIdentity: "Immutable Update Contracts Suite",
    run: runImmutableUpdateContractsTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "queryLimitsAndSortSafety.test.ts",
    suiteIdentity: "Query Limits & Sort/Filter Safety Suite",
    run: runQueryLimitsAndSortSafetyTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "finalRepositoryAudit.test.ts",
    suiteIdentity: "Final Repository Contract Hardening Audit",
    run: runFinalRepositoryAuditTestSuite as () => Promise<GenericSuiteSummary>,
  },
  {
    fileName: "repositoryQuerySpecification.test.ts",
    suiteIdentity: "Repository Query Specification & Pagination Suite",
    run: runRepositoryQuerySpecificationTestSuite as () => Promise<GenericSuiteSummary>,
  },
];

function verifySuiteCompleteness(testsDir: string): void {
  if (!fs.existsSync(testsDir)) {
    throw new Error(`TEST RUNNER CONFIGURATION ERROR: Tests directory does not exist: ${testsDir}`);
  }

  const filesOnDisk = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort();

  const registeredFiles = REGISTERED_SUITES.map((s) => s.fileName).sort();

  const unregisteredFiles = filesOnDisk.filter((f) => !registeredFiles.includes(f));
  if (unregisteredFiles.length > 0) {
    throw new Error(
      `TEST RUNNER CONFIGURATION ERROR: Unregistered test suite(s) detected: ${unregisteredFiles.join(", ")}`
    );
  }

  const missingFiles = registeredFiles.filter((f) => !filesOnDisk.includes(f));
  if (missingFiles.length > 0) {
    throw new Error(
      `TEST RUNNER CONFIGURATION ERROR: Registered test file(s) missing on disk: ${missingFiles.join(", ")}`
    );
  }
}

async function main() {
  console.log("================================================================================");
  console.log("APEX ONE PRODUCTION — COMPREHENSIVE SECURITY & INTEGRITY TEST SUITE");
  console.log("================================================================================\n");

  const testsDir = path.resolve(__dirname, "../lib/backend/tests");

  // Safeguard: verify all *.test.ts files in lib/backend/tests are registered
  try {
    verifySuiteCompleteness(testsDir);
    console.log(`[PASS] Suite Completeness Verified: All ${REGISTERED_SUITES.length} test suite files registered.\n`);
  } catch (err: unknown) {
    console.error(`❌ ${(err as Error).message}\n`);
    process.exit(1);
  }

  const start = performance.now();
  const allResults: TestResult[] = [];
  let total = 0;
  let passedCount = 0;
  let failedCount = 0;

  // Execute test suites sequentially for strict deterministic isolation
  for (const suite of REGISTERED_SUITES) {
    console.log(`▶ Running Suite: ${suite.suiteIdentity} (${suite.fileName})...`);
    try {
      const summary = await suite.run();
      const suiteResults = summary.results || [];
      allResults.push(...suiteResults);
      total += summary.total;
      passedCount += summary.passedCount;
      failedCount += summary.failedCount;

      console.log(
        `  ↳ ${suite.suiteIdentity}: ${summary.passedCount}/${summary.total} passed (${summary.failedCount} failed)`
      );
    } catch (suiteErr: unknown) {
      console.error(`  ❌ Fatal error executing suite ${suite.fileName}:`, suiteErr);
      failedCount += 1;
      total += 1;
      allResults.push({
        suite: suite.suiteIdentity,
        testName: `Fatal Suite Execution Error in ${suite.fileName}`,
        passed: false,
        error: (suiteErr as Error).message || String(suiteErr),
      });
    }
  }

  const duration = Math.round(performance.now() - start);
  const passed = failedCount === 0 && total > 0;

  // Group results by suite for detailed console output
  const suites: Record<string, TestResult[]> = {};
  for (const res of allResults) {
    const key = res.suite || "General";
    if (!suites[key]) suites[key] = [];
    suites[key].push(res);
  }

  console.log("\n" + "=".repeat(80));
  console.log("DETAILED TEST RESULTS BY SUITE");
  console.log("=".repeat(80));

  for (const [suiteName, tests] of Object.entries(suites)) {
    console.log(`\n📦 ${suiteName.toUpperCase()}`);
    console.log("-".repeat(80));
    for (const t of tests) {
      const icon = t.passed ? "✅ [PASS]" : "❌ [FAIL]";
      const time = t.durationMs !== undefined ? `(${t.durationMs}ms)` : "";
      console.log(`  ${icon} ${t.testName} ${time}`);
      if (!t.passed && t.error) {
        console.log(`      ↳ Error: ${t.error}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`TOTAL SUITES: ${REGISTERED_SUITES.length}`);
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log(`SKIPPED: 0`);
  console.log(`STATUS: ${passed ? "ALL SECURITY & INTEGRITY CHECKS PASSED ✅" : "RELEASE SAFETY CHECKS FAILED ❌"}`);
  console.log(`DURATION: ${duration}ms`);
  console.log("=".repeat(80) + "\n");

  if (!passed || failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL TEST RUNNER ERROR:", err);
  process.exit(1);
});
