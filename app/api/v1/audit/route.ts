import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { auditService } from "@/lib/backend/domains/audit/auditService";
import {
  assertAllowedQueryKeys,
  parseCursorPagination,
} from "@/lib/backend/core/requestValidation";
import { serializeApiError } from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["limit", "cursor"]);
    const pagination = parseCursorPagination(searchParams);
    const result = await auditService.getAuditLogs(ctx, pagination);

    return NextResponse.json(toCollectionResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
