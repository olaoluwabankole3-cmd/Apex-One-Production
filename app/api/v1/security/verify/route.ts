import { NextRequest, NextResponse } from "next/server";
import { runTenantIsolationTestSuite } from "@/lib/backend/tests/tenantIsolation.test";

export async function GET(req: NextRequest) {
  try {
    const testResults = await runTenantIsolationTestSuite();
    return NextResponse.json(
      {
        success: true,
        summary: {
          allPassed: testResults.passed,
          totalTests: testResults.total,
          passedTests: testResults.results.filter((r) => r.passed).length,
          failedTests: testResults.results.filter((r) => !r.passed).length,
        },
        results: testResults.results,
        timestamp: new Date().toISOString(),
      },
      { status: testResults.passed ? 200 : 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to execute tenant isolation test suite",
      },
      { status: 500 }
    );
  }
}
