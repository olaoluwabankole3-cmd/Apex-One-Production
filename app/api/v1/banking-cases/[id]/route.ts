import { NextRequest, NextResponse } from "next/server";
import { bankingCaseService } from "@/lib/backend/domains/banking-cases/bankingCaseService";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const record = await bankingCaseService.findById(ctx, params.id);
    return NextResponse.json(toApiSuccessResponse(record, requestId), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
