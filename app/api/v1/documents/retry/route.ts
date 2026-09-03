import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { documentConsistencyService } from "@/lib/backend/domains/documents/documentConsistencyService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  readJsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

export async function POST(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["limit"] as const);

    let limit = 20;
    if (body.limit !== undefined) {
      if (typeof body.limit !== "number" || !Number.isSafeInteger(body.limit) || body.limit < 1) {
        throw new Error("limit must be a positive safe integer");
      }
      limit = Math.min(body.limit, 100);
    }

    const result = await documentConsistencyService.retryPendingDocumentOperations(ctx, limit);
    return NextResponse.json(toApiSuccessResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
