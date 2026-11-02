import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { readJsonObject, assertAllowedKeys, assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import { bankingCaseReviewService } from "@/lib/backend/domains/banking-cases/bankingCaseReviewService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["decisionId", "verdict", "note", "expectedRevision"]);
    const decisionId = Validator.requireId(body.decisionId, "decisionId");
    const verdict = Validator.requireEnum(body.verdict, ["approved", "rejected"] as const, "verdict");
    const note = Validator.requireString(body.note, "note", { minLength: 10, maxLength: 600 });
    if (!Number.isSafeInteger(body.expectedRevision)) throw new ValidationError("Invalid expectedRevision");
    const record = await bankingCaseReviewService.review(ctx, params.id, {
      decisionId, verdict, note, expectedRevision: body.expectedRevision as number,
    });
    return NextResponse.json(toApiSuccessResponse(record, requestId), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: { "Cache-Control": "no-store, private" } });
  }
}
