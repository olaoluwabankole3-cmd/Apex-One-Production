import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import {
  parseCreateWorkflowRequest,
  WORKFLOW_STATUSES,
} from "@/lib/backend/domains/workflows/workflowRequestValidation";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedQueryKeys,
  optionalQueryString,
  parseCursorPagination,
  readJsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

const WORKFLOW_FILTER_STATUSES = [...WORKFLOW_STATUSES, "all"] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["status", "limit", "cursor"]);

    const status = Validator.optionalEnum(
      optionalQueryString(searchParams, "status"),
      WORKFLOW_FILTER_STATUSES,
      "status"
    );
    const pagination = parseCursorPagination(searchParams);

    const result = await workflowService.getWorkflows(ctx, {
      status,
      ...pagination,
    });

    return NextResponse.json(toCollectionResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);
    const dto = parseCreateWorkflowRequest(body);
    const workflow = await workflowService.createWorkflow(dto, ctx);

    return NextResponse.json(toApiSuccessResponse(workflow, requestId), {
      status: 201,
    });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
