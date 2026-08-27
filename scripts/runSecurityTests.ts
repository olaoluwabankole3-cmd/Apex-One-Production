/**
 * APEX ONE — Command-Line Tenant Isolation Security Test Runner
 */

import { runTenantIsolationTestSuite } from "../lib/backend/tests/tenantIsolation.test";

async function main() {
  console.log("================================================================================");
  console.log("APEX ONE PRODUCTION — TENANT ISOLATION & SECURITY TEST SUITE");
  console.log("================================================================================\n");

  const start = performance.now();
  const summary = await runTenantIsolationTestSuite();
  const duration = Math.round(performance.now() - start);

  // Group results by suite
  const suites: Record<string, typeof summary.results> = {};
  for (const res of summary.results) {
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
  console.log(`TOTAL: ${summary.total}`);
  console.log(`PASSED: ${summary.passedCount}`);
  console.log(`FAILED: ${summary.failedCount}`);
  console.log(`SKIPPED: 0`);
  console.log(`STATUS: ${summary.passed ? "ALL SECURITY CHECKS PASSED ✅" : "SECURITY VULNERABILITIES DETECTED ❌"}`);
  console.log(`DURATION: ${duration}ms`);
  console.log("=".repeat(80) + "\n");

  if (!summary.passed || summary.failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL TEST RUNNER ERROR:", err);
  process.exit(1);
});
