import { NextRequest, NextResponse } from "next/server";
import { bankingCaseService } from "@/lib/backend/domains/banking-cases/bankingCaseService";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

export async function GET(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const result = await bankingCaseService.listAssignees(ctx);
    return NextResponse.json(toApiSuccessResponse(result, requestId), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status, headers: { "Cache-Control": "no-store" } });
  }
}
