import { NextResponse } from "next/server";
import { resolveReleaseIdentity } from "@/lib/backend/infrastructure/releaseIdentity";
import { getDeploymentTopologySummary } from "@/lib/backend/infrastructure/deploymentTopology";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      service: "APEX ONE Backend",
      release: resolveReleaseIdentity(),
      topology: {
        schemaVersion: getDeploymentTopologySummary().schemaVersion,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
