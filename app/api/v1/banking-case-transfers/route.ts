import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { bankingCaseTransferService } from "@/lib/backend/domains/banking-cases/bankingCaseTransferService";
import { assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

export async function GET(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const data = await bankingCaseTransferService.listMine(ctx);
    return NextResponse.json(toApiSuccessResponse(data, requestId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status,
      headers: { "Cache-Control": "private, no-store" } });
  }
}
