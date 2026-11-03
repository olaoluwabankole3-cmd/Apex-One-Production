import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { bankingWorkTaskService } from "@/lib/backend/domains/banking-tasks/bankingWorkTaskService";
import { assertAllowedKeys, assertAllowedQueryKeys, readJsonObject } from "@/lib/backend/core/requestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["expectedRevision", "note"]);
    if (typeof body.expectedRevision !== "number") throw new ValidationError("expectedRevision is required");
    const task = await bankingWorkTaskService.decline(ctx, params.id, {
      expectedRevision: body.expectedRevision,
      note: Validator.requireString(body.note, "response note", { minLength: 15, maxLength: 600 }),
    });
    return NextResponse.json(toApiSuccessResponse(task, requestId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
