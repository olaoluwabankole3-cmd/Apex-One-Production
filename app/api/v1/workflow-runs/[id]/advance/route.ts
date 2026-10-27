import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  optionalRecord,
  readJsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

const ADVANCE_BODY_KEYS = ["stepId", "decision", "output", "comments"] as const;
const STEP_DECISIONS = ["approved", "rejected", "completed"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const runId = Validator.requireId(id, "runId");
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ADVANCE_BODY_KEYS);

    const stepId = Validator.requireString(body.stepId, "stepId", {
      minLength: 1,
      maxLength: 200,
    });
    const decision = Validator.optionalEnum(
      body.decision,
      STEP_DECISIONS,
      "decision"
    );
    const output = optionalRecord(body.output, "output");
    const comments = Validator.optionalString(body.comments, "comments", {
      maxLength: 2_000,
    });

    const updated = await workflowService.advanceWorkflowStep(
      {
        runId,
        stepId,
        ...(decision ? { decision } : {}),
        ...(output ? { output } : {}),
        ...(comments ? { comments } : {}),
      },
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(updated, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
