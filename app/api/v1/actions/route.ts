import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import {
  actionService,
  type CreateActionDto,
} from "@/lib/backend/domains/actions/actionService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
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

const ACTION_STATUSES = ["Ready", "Approved", "In Progress", "Completed", "Measured"] as const;
const ACTION_FILTER_STATUSES = [...ACTION_STATUSES, "all"] as const;
const AUTOMATION_TYPES = ["Manual", "AI-assisted", "Automated", "Awaiting approval"] as const;
const ACTION_BODY_KEYS = [
  "recommendation",
  "owner",
  "deadline",
  "expectedValue",
  "confidence",
  "automationType",
  "requiresHumanApproval",
  "insightSource",
  "decisionDetail",
  "resultMetric",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["status", "limit", "cursor"]);

    const status = Validator.optionalEnum(
      optionalQueryString(searchParams, "status"),
      ACTION_FILTER_STATUSES,
      "status"
    );
    const pagination = parseCursorPagination(searchParams);

    const result = await actionService.getActions(ctx, {
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

    assertAllowedKeys(body, ACTION_BODY_KEYS);

    Validator.requireString(body.recommendation, "recommendation", {
      minLength: 5,
      maxLength: 200,
    });

    if (body.owner !== undefined) {
      Validator.requireString(body.owner, "owner", { maxLength: 160 });
    }
    if (body.deadline !== undefined) {
      Validator.requireString(body.deadline, "deadline", { maxLength: 64 });
    }
    if (body.expectedValue !== undefined) {
      Validator.requireNumber(body.expectedValue, "expectedValue", { min: 0 });
    }
    if (body.confidence !== undefined) {
      Validator.requireNumber(body.confidence, "confidence", { min: 0, max: 100 });
    }
    if (body.automationType !== undefined) {
      Validator.requireEnum(body.automationType, AUTOMATION_TYPES, "automationType");
    }
    if (body.requiresHumanApproval !== undefined) {
      Validator.optionalBoolean(body.requiresHumanApproval, "requiresHumanApproval");
    }
    if (body.insightSource !== undefined) {
      Validator.requireString(body.insightSource, "insightSource", { maxLength: 1_000 });
    }
    if (body.decisionDetail !== undefined) {
      Validator.requireString(body.decisionDetail, "decisionDetail", { maxLength: 2_000 });
    }
    if (body.resultMetric !== undefined) {
      Validator.requireString(body.resultMetric, "resultMetric", { maxLength: 1_000 });
    }

    const action = await actionService.createAction(
      body as unknown as CreateActionDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(action, requestId), { status: 201 });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
