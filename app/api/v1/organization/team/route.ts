import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { createDatabaseStoreFromEnvironment } from "@/lib/backend/infrastructure/composition";
import { listInstitutionTeam } from "@/lib/backend/domains/organization/institutionTeamService";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

export const dynamic = "force-dynamic";

/** No organization ID is accepted from headers, paths or query parameters. */
export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const data = await listInstitutionTeam(ctx, createDatabaseStoreFromEnvironment());

    return NextResponse.json(toApiSuccessResponse(data, requestId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, {
      status: serialized.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
