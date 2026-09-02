import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { parseUpdateWorkflowRequest } from "@/lib/backend/domains/workflows/workflowRequestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { readJsonObject } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";

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
    const workflow = await workflowService.getWorkflowById(workflowId, ctx);
    return NextResponse.json(toApiSuccessResponse(workflow, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const workflowId = Validator.requireId(id, "workflowId");
    const body = await readJsonObject(req);
    const dto = parseUpdateWorkflowRequest(body);
    const workflow = await workflowService.updateWorkflow(workflowId, dto, ctx);
    return NextResponse.json(toApiSuccessResponse(workflow, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
