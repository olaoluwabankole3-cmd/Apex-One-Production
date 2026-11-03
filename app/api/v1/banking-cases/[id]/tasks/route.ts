import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { bankingWorkTaskService } from "@/lib/backend/domains/banking-tasks/bankingWorkTaskService";
import { assertAllowedQueryKeys, parseCursorPagination } from "@/lib/backend/core/requestValidation";
import { serializeApiError } from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, ["limit", "cursor"]);
    const tasks = await bankingWorkTaskService.listForCase(ctx, params.id, parseCursorPagination(req.nextUrl.searchParams));
    return NextResponse.json(toCollectionResponse(tasks, requestId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
