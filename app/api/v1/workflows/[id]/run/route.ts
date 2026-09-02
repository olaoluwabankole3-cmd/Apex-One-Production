import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { parseTriggerWorkflowRunRequest } from "@/lib/backend/domains/workflows/workflowRequestValidation";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedQueryKeys,
  parseCursorPagination,
  readJsonObject,
  type JsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const workflowId = Validator.requireId(id, "workflowId");
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["limit", "cursor"]);
    const pagination = parseCursorPagination(searchParams);
    const runs = await workflowService.getWorkflowRuns(
      workflowId,
      ctx,
      pagination
    );

    return NextResponse.json(toCollectionResponse(runs, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const workflowId = Validator.requireId(id, "workflowId");
    const body: JsonObject = req.body === null ? {} : await readJsonObject(req);
    const dto = parseTriggerWorkflowRunRequest(body, workflowId);
    const run = await workflowService.triggerWorkflowRun(dto, ctx);

    return NextResponse.json(toApiSuccessResponse(run, requestId), {
      status: 201,
    });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
