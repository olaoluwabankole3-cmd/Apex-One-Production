import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { Validator } from "@/lib/backend/core/validation";
import { assertAllowedKeys, readJsonObject } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import {
  VALUE_EXECUTION_COMMANDS,
  type ValueExecutionLifecycleCommand,
} from "@/lib/backend/domains/value/valueExecutionLifecycleModel";
import { valueExecutionLifecycleService } from "@/lib/backend/domains/value/valueExecutionLifecycleService";

const COMMAND_KEYS = {
  validate_opportunity: ["command", "opportunityId", "note"],
  approve_opportunity: ["command", "opportunityId", "note"],
  create_action: [
    "command",
    "opportunityId",
    "owner",
    "deadline",
    "automationType",
    "requiresHumanApproval",
  ],
  approve_action: ["command", "opportunityId", "actionId"],
  start_execution: ["command", "opportunityId", "actionId", "workflowId"],
  complete_execution: ["command", "opportunityId", "actionId", "workflowRunId"],
  record_measurement: [
    "command",
    "opportunityId",
    "actionId",
    "workflowRunId",
    "sources",
    "method",
    "confidence",
    "notes",
  ],
  verify_measurement: [
    "command",
    "opportunityId",
    "actionId",
    "workflowRunId",
    "measurementProvenanceIds",
    "criteria",
    "reason",
  ],
  reject_measurement: [
    "command",
    "opportunityId",
    "actionId",
    "workflowRunId",
    "measurementProvenanceIds",
    "criteria",
    "reason",
  ],
  capture_value: [
    "command",
    "opportunityId",
    "actionId",
    "workflowRunId",
    "measurementProvenanceIds",
    "category",
    "capturedValue",
    "realizationDate",
    "evidenceDescription",
  ],
} as const;

export async function POST(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);
    const command = Validator.requireEnum(body.command, VALUE_EXECUTION_COMMANDS, "command");
    assertAllowedKeys(body, COMMAND_KEYS[command]);

    const result = await valueExecutionLifecycleService.execute(
      body as unknown as ValueExecutionLifecycleCommand,
      ctx
    );
    const status = command === "create_action" || command === "start_execution" || command === "record_measurement" || command === "capture_value"
      ? 201
      : 200;

    return NextResponse.json(toApiSuccessResponse(result, requestId), { status });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
