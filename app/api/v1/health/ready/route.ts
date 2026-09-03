import { NextResponse } from "next/server";
import { getProductionReadinessReport } from "@/lib/backend/infrastructure/productionReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getProductionReadinessReport();
    return NextResponse.json(report, {
      status: report.status === "ready" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        production: process.env.APP_ENV?.trim().toLowerCase() === "production",
        configurationIssueCount: 1,
        unavailableAuthorities: [],
        checks: [],
        checkedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
