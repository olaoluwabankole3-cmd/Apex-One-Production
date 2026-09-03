import { NextResponse } from "next/server";
import { getInfrastructureReadiness } from "@/lib/backend/infrastructure/runtime";
import {
  getProductionReleaseIdentityIssues,
  resolveReleaseIdentity,
} from "@/lib/backend/infrastructure/releaseIdentity";
import { getDeploymentTopologySummary } from "@/lib/backend/infrastructure/deploymentTopology";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const infrastructure = getInfrastructureReadiness();
  const release = resolveReleaseIdentity();
  const releaseIssues = infrastructure.production ? getProductionReleaseIdentityIssues() : [];
  const started = infrastructure.ready && releaseIssues.length === 0;

  return NextResponse.json(
    {
      status: started ? "started" : "not_started",
      production: infrastructure.production,
      configurationIssueCount: infrastructure.issues.length + releaseIssues.length,
      release,
      topology: getDeploymentTopologySummary(),
      checkedAt: new Date().toISOString(),
      probeDurationMs: Date.now() - startedAt,
    },
    {
      status: started ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
