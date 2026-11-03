import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { bankingWorkTaskService } from "@/lib/backend/domains/banking-tasks/bankingWorkTaskService";
import { assertAllowedKeys, assertAllowedQueryKeys, parseCursorPagination, readJsonObject } from "@/lib/backend/core/requestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, ["view", "limit", "cursor"]);
    const view = req.nextUrl.searchParams.get("view") ?? "received";
    if (view !== "received" && view !== "requested" && view !== "team") throw new ValidationError("Invalid task inbox view");
    const options = parseCursorPagination(req.nextUrl.searchParams);
    const tasks = await bankingWorkTaskService.listMine(ctx, view, options);
    return NextResponse.json(toCollectionResponse(tasks, requestId), { headers: HEADERS });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: HEADERS });
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["caseId", "recipientUserId", "deliveryMode", "targetDepartment",
      "title", "question", "expectedResponse", "dueAt", "expectedCaseRevision"]);
    const deliveryMode = body.deliveryMode === undefined ? "named" :
      Validator.requireEnum(body.deliveryMode, ["named", "department"] as const, "deliveryMode");
    const expectedCaseRevision = body.expectedCaseRevision;
    if (typeof expectedCaseRevision !== "number") throw new ValidationError("expectedCaseRevision is required");
    const task = await bankingWorkTaskService.request(ctx, {
      caseId: Validator.requireId(body.caseId, "caseId"),
      ...(deliveryMode === "department"
        ? {
          deliveryMode: "department" as const,
          targetDepartment: Validator.requireEnum(body.targetDepartment, ["Operations", "Finance"] as const, "targetDepartment"),
          ...(body.recipientUserId !== undefined ? { recipientUserId: body.recipientUserId as string } : {}),
        }
        : {
          recipientUserId: Validator.requireId(body.recipientUserId, "recipientUserId"),
          ...(body.targetDepartment !== undefined ? { targetDepartment: body.targetDepartment as "Operations" | "Finance" } : {}),
        }),
      title: Validator.requireString(body.title, "title", { minLength: 8, maxLength: 120 }),
      question: Validator.requireString(body.question, "question", { minLength: 15, maxLength: 600 }),
      expectedResponse: Validator.requireString(body.expectedResponse, "expectedResponse", { minLength: 15, maxLength: 300 }),
      ...(body.dueAt !== undefined ? {
        dueAt: Validator.requireString(body.dueAt, "dueAt", { minLength: 24, maxLength: 24 }),
      } : {}),
      expectedCaseRevision,
    });
    return NextResponse.json(toApiSuccessResponse(task, requestId), { status: 201, headers: HEADERS });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers: HEADERS });
  }
}
