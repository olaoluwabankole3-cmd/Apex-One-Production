import { NextRequest, NextResponse } from "next/server";
import { runTenantIsolationTestSuite } from "@/lib/backend/tests/tenantIsolation.test";
import { resolveTenantContext, requirePermission } from "@/lib/backend/core/security";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  // Reject diagnostic endpoints in production environments
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Diagnostic test endpoints are disabled in production environments", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const ctx = await resolveTenantContext(req.headers);
    requirePermission(ctx, "org:admin");

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
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute tenant isolation test suite",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

