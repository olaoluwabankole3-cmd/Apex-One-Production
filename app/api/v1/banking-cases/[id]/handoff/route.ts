import { NextRequest, NextResponse } from "next/server";
import { bankingCaseService } from "@/lib/backend/domains/banking-cases/bankingCaseService";
import { resolveTenantContext } from "@/lib/backend/core/security";
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
    assertAllowedKeys(body, ["recipientUserId", "expectedRevision", "reason"]);
    const recipientUserId = Validator.requireId(body.recipientUserId, "recipientUserId");
    const reason = Validator.requireString(body.reason, "reason", { minLength: 10, maxLength: 500 });
    if (!Number.isSafeInteger(body.expectedRevision) ||
        (body.expectedRevision as number) < 1 || (body.expectedRevision as number) > 1_000_000_000) {
      throw new ValidationError("expectedRevision must be a positive integer");
    }
    const result = await bankingCaseService.handoff(ctx, params.id, {
      recipientUserId, reason, expectedRevision: body.expectedRevision as number,
    });
    return NextResponse.json(toApiSuccessResponse(result, requestId), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status, headers: { "Cache-Control": "no-store" } });
  }
}
