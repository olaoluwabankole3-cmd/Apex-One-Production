import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { bankingCaseTransferService } from "@/lib/backend/domains/banking-cases/bankingCaseTransferService";
import { assertAllowedKeys, assertAllowedQueryKeys, readJsonObject } from "@/lib/backend/core/requestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

/**
 * One strict endpoint for the four mutually exclusive ownership transitions.
 * The authenticated actor and persisted tenant membership determine authority.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readJsonObject(req);
    const action = Validator.requireEnum(body.action,
      ["request", "accept", "decline", "cancel"] as const, "action");
    const expectedRevision = body.expectedRevision;
    if (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 1 || expectedRevision > 1_000_000_000) {
      throw new ValidationError("expectedRevision must be a positive integer");
    }
    let result;
    if (action === "request") {
      assertAllowedKeys(body, ["action", "expectedRevision", "recipientUserId", "reason"]);
      result = await bankingCaseTransferService.offer(ctx, params.id, {
        recipientUserId: Validator.requireId(body.recipientUserId, "recipientUserId"),
        reason: Validator.requireString(body.reason, "reason", { minLength: 10, maxLength: 500 }),
        expectedRevision,
      });
    } else {
      assertAllowedKeys(body, action === "decline"
        ? ["action", "expectedRevision", "transferId", "note"]
        : ["action", "expectedRevision", "transferId"]);
      const input = {
        transferId: Validator.requireId(body.transferId, "transferId"),
        expectedRevision,
        ...(action === "decline" ? {
          note: Validator.requireString(body.note, "decline reason", { minLength: 15, maxLength: 400 }),
        } : {}),
      };
      if (action === "accept") result = await bankingCaseTransferService.accept(ctx, params.id, input);
      else if (action === "decline") result = await bankingCaseTransferService.decline(ctx, params.id, input);
      else result = await bankingCaseTransferService.cancel(ctx, params.id, input);
    }
    return NextResponse.json(toApiSuccessResponse(result, requestId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status,
      headers: { "Cache-Control": "private, no-store" } });
  }
}
