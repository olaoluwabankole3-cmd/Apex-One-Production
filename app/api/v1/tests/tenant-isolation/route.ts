import { NextRequest, NextResponse } from "next/server";
import { runTenantIsolationTestSuite } from "@/lib/backend/tests/tenantIsolation.test";
import { resolveTenantContext, requirePermission } from "@/lib/backend/core/security";
import { BackendError, ForbiddenError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  // Reject diagnostic endpoints in production
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Diagnostic test endpoints are disabled in production environments" },
      { status: 403 }
    );
  }

  try {
    // Requires authenticated admin context even in non-production
    const ctx = await resolveTenantContext(req.headers);
    requirePermission(ctx, "org:admin");

    const results = await runTenantIsolationTestSuite();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: results.passed ? "ALL_PASSED" : "FAILED",
      passed: results.passed,
      totalTests: results.total,
      details: results.results,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
