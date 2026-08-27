/**
 * APEX ONE — Command-Line Tenant Isolation Security Test Runner
 */

import { runTenantIsolationTestSuite } from "../lib/backend/tests/tenantIsolation.test";
import { runFrontendAuthCompatibilityTestSuite } from "../lib/backend/tests/frontendAuthCompatibility.test";
import { runCustomerDataTruthfulnessTestSuite } from "../lib/backend/tests/customerDataTruthfulness.test";

async function main() {
  console.log("================================================================================");
  console.log("APEX ONE PRODUCTION — TENANT ISOLATION & DATA TRUTHFULNESS SECURITY TEST SUITE");
  console.log("================================================================================\n");

  const start = performance.now();
  const [backendSummary, frontendSummary, customerSummary] = await Promise.all([
    runTenantIsolationTestSuite(),
    runFrontendAuthCompatibilityTestSuite(),
    runCustomerDataTruthfulnessTestSuite(),
  ]);
  const duration = Math.round(performance.now() - start);

  const allResults = [...backendSummary.results, ...frontendSummary.results, ...customerSummary.results];
  const total = backendSummary.total + frontendSummary.total + customerSummary.total;
  const passedCount = backendSummary.passedCount + frontendSummary.passedCount + customerSummary.passedCount;
  const failedCount = backendSummary.failedCount + frontendSummary.failedCount + customerSummary.failedCount;
  const passed = failedCount === 0;

  // Group results by suite
  const suites: Record<string, typeof allResults> = {};
  for (const res of allResults) {
    if (!suites[res.suite]) suites[res.suite] = [];
    suites[res.suite].push(res);
  }

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
  console.log(`TOTAL: ${total}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log(`SKIPPED: 0`);
  console.log(`STATUS: ${passed ? "ALL SECURITY CHECKS PASSED ✅" : "SECURITY VULNERABILITIES DETECTED ❌"}`);
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
