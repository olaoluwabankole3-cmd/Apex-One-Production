import { NextRequest, NextResponse } from "next/server";
import { bankingCaseService } from "@/lib/backend/domains/banking-cases/bankingCaseService";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { Validator } from "@/lib/backend/core/validation";
import { assertAllowedKeys, assertAllowedQueryKeys, parseCursorPagination, readJsonObject } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

export async function GET(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, ["limit", "cursor"]);
    const options = parseCursorPagination(req.nextUrl.searchParams);
    const result = await bankingCaseService.list(ctx, options);
    return NextResponse.json(toCollectionResponse(result, requestId), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["title", "description", "department", "priority", "sourceType", "sourceId"]);
    const title = Validator.requireString(body.title, "title", { minLength: 8, maxLength: 160 });
    const description = Validator.requireString(body.description, "description", { minLength: 10, maxLength: 1200 });
    const department = Validator.requireEnum(body.department, ["Operations", "Finance"] as const, "department");
    const priority = Validator.optionalEnum(body.priority, ["normal", "high"] as const, "priority");
    const sourceType = Validator.optionalEnum(body.sourceType, ["Document", "ValueOpportunity"] as const, "sourceType");
    const sourceId = body.sourceId === undefined ? undefined : Validator.requireId(body.sourceId, "sourceId");
    const record = await bankingCaseService.create(ctx, { title, description, department, priority, sourceType, sourceId });
    return NextResponse.json(toApiSuccessResponse(record, requestId), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
