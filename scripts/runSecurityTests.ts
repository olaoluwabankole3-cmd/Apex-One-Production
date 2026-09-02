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
import { runPasswordChangeTenantBoundaryTestSuite } from "../lib/backend/tests/passwordChangeTenantBoundary.test";
import { runAuthSessionAuthorityTestSuite } from "../lib/backend/tests/authSessionAuthority.test";
import { runCustomerDataTruthfulnessTestSuite } from "../lib/backend/tests/customerDataTruthfulness.test";
import { runFinancialIntegrityTestSuite } from "../lib/backend/tests/financialIntegrity.test";
import { runRelationshipIntegrityTestSuite } from "../lib/backend/tests/relationshipIntegrity.test";
import { runEntityLifecycleIntegrityTestSuite } from "../lib/backend/tests/entityLifecycleIntegrity.test";
import { runUnitOfWorkTestSuite } from "../lib/backend/tests/unitOfWork.test";
import { runImmutableUpdateContractsTestSuite } from "../lib/backend/tests/immutableUpdateContracts.test";
import { runQueryLimitsAndSortSafetyTestSuite } from "../lib/backend/tests/queryLimitsAndSortSafety.test";
import { runFinalRepositoryAuditTestSuite } from "../lib/backend/tests/finalRepositoryAudit.test";
import { runRepositoryQuerySpecificationTestSuite } from "../lib/backend/tests/repositoryQuerySpecification.test";
import { runHttpContractFoundationTestSuite } from "../lib/backend/tests/httpContractFoundation.test";
import { runApiClientContractTestSuite } from "../lib/backend/tests/apiClientContract.test";
import { runFrontendCanonicalConsumersTestSuite } from "../lib/backend/tests/frontendCanonicalConsumers.test";

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
  { fileName: "tenantIsolation.test.ts", suiteIdentity: "Tenant Isolation & Security Suite", run: runTenantIsolationTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "frontendAuthCompatibility.test.ts", suiteIdentity: "Frontend Auth Compatibility Suite", run: runFrontendAuthCompatibilityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "frontendRoleAuthority.test.ts", suiteIdentity: "Frontend Role Authority Boundary Suite", run: runFrontendRoleAuthorityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "frontendPrivilegedUiAuthorization.test.ts", suiteIdentity: "Frontend Privileged UI Authorization Suite", run: runFrontendPrivilegedUiAuthorizationTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "passwordChangeTenantBoundary.test.ts", suiteIdentity: "Password Change Tenant Boundary Suite", run: runPasswordChangeTenantBoundaryTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "authSessionAuthority.test.ts", suiteIdentity: "Auth Session Authority & Contract Suite", run: runAuthSessionAuthorityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "customerDataTruthfulness.test.ts", suiteIdentity: "Customer Data Truthfulness Suite", run: runCustomerDataTruthfulnessTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "financialIntegrity.test.ts", suiteIdentity: "Financial & Currency Integrity Suite", run: runFinancialIntegrityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "relationshipIntegrity.test.ts", suiteIdentity: "Relationship Integrity Suite", run: runRelationshipIntegrityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "entityLifecycleIntegrity.test.ts", suiteIdentity: "Entity Lifecycle & Deletion Integrity Suite", run: runEntityLifecycleIntegrityTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "unitOfWork.test.ts", suiteIdentity: "Unit of Work & Transaction Hardening Suite", run: runUnitOfWorkTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "immutableUpdateContracts.test.ts", suiteIdentity: "Immutable Update Contracts Suite", run: runImmutableUpdateContractsTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "queryLimitsAndSortSafety.test.ts", suiteIdentity: "Query Limits & Sort/Filter Safety Suite", run: runQueryLimitsAndSortSafetyTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "finalRepositoryAudit.test.ts", suiteIdentity: "Final Repository Contract Hardening Audit", run: runFinalRepositoryAuditTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "repositoryQuerySpecification.test.ts", suiteIdentity: "Repository Query Specification & Pagination Suite", run: runRepositoryQuerySpecificationTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "httpContractFoundation.test.ts", suiteIdentity: "Canonical HTTP Contract Foundation Suite", run: runHttpContractFoundationTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "apiClientContract.test.ts", suiteIdentity: "Frontend API Client Canonical Contract Suite", run: runApiClientContractTestSuite as () => Promise<GenericSuiteSummary> },
  { fileName: "frontendCanonicalConsumers.test.ts", suiteIdentity: "Frontend Canonical HTTP Consumers Suite", run: runFrontendCanonicalConsumersTestSuite as () => Promise<GenericSuiteSummary> },
];

function verifySuiteCompleteness(testsDir: string): void {
  if (!fs.existsSync(testsDir)) {
    throw new Error(`TEST RUNNER CONFIGURATION ERROR: Tests directory does not exist: ${testsDir}`);
  }

  const filesOnDisk = fs.readdirSync(testsDir).filter((fileName) => fileName.endsWith(".test.ts")).sort();
  const registeredFiles = REGISTERED_SUITES.map((suite) => suite.fileName).sort();
  const unregisteredFiles = filesOnDisk.filter((fileName) => !registeredFiles.includes(fileName));
  const missingFiles = registeredFiles.filter((fileName) => !filesOnDisk.includes(fileName));

  if (unregisteredFiles.length > 0) {
    throw new Error(`TEST RUNNER CONFIGURATION ERROR: Unregistered test suite(s) detected: ${unregisteredFiles.join(", ")}`);
  }
  if (missingFiles.length > 0) {
    throw new Error(`TEST RUNNER CONFIGURATION ERROR: Registered test file(s) missing on disk: ${missingFiles.join(", ")}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("APEX ONE PRODUCTION — COMPREHENSIVE SECURITY & INTEGRITY TEST SUITE");
  console.log("================================================================================\n");

  const testsDir = path.resolve(__dirname, "../lib/backend/tests");

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

  for (const suite of REGISTERED_SUITES) {
    console.log(`▶ Running Suite: ${suite.suiteIdentity} (${suite.fileName})...`);
    try {
      const summary = await suite.run();
      const suiteResults = summary.results || [];
      allResults.push(...suiteResults);
      total += summary.total;
      passedCount += summary.passedCount;
      failedCount += summary.failedCount;
      console.log(`  ↳ ${suite.suiteIdentity}: ${summary.passedCount}/${summary.total} passed (${summary.failedCount} failed)`);
    } catch (suiteErr: unknown) {
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
  const suites: Record<string, TestResult[]> = {};

  for (const result of allResults) {
    const key = result.suite || "General";
    if (!suites[key]) suites[key] = [];
    suites[key].push(result);
  }

  console.log("\n" + "=".repeat(80));
  console.log("DETAILED TEST RESULTS BY SUITE");
  console.log("=".repeat(80));

  for (const [suiteName, tests] of Object.entries(suites)) {
    console.log(`\n📦 ${suiteName.toUpperCase()}`);
    console.log("-".repeat(80));
    for (const test of tests) {
      const icon = test.passed ? "✅ [PASS]" : "❌ [FAIL]";
      const time = test.durationMs !== undefined ? `(${test.durationMs}ms)` : "";
      console.log(`  ${icon} ${test.testName} ${time}`);
      if (!test.passed && test.error) console.log(`      ↳ Error: ${test.error}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`TOTAL SUITES: ${REGISTERED_SUITES.length}`);
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log("SKIPPED: 0");
  console.log(`STATUS: ${passed ? "ALL SECURITY & INTEGRITY CHECKS PASSED ✅" : "RELEASE SAFETY CHECKS FAILED ❌"}`);
  console.log(`DURATION: ${duration}ms`);
  console.log("=".repeat(80) + "\n");

  if (!passed || failedCount > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL TEST RUNNER ERROR:", err);
  process.exit(1);
});
