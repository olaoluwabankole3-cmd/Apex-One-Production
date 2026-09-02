import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { valueService } from "@/lib/backend/domains/value/valueService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedQueryKeys,
  optionalQueryString,
  parseCursorPagination,
} from "@/lib/backend/core/requestValidation";
import { serializeApiError } from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

const VALUE_CATEGORIES = [
  "Customer expansion",
  "Dormant customers",
  "Contract optimization",
  "Revenue recovery",
  "Process optimization",
  "Capacity utilization",
  "all",
] as const;
const VALUE_STATUSES = [
  "Identified",
  "Validated",
  "Approved",
  "Executing",
  "Captured",
  "all",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["category", "status", "limit", "cursor"]);

    const category = Validator.optionalEnum(
      optionalQueryString(searchParams, "category"),
      VALUE_CATEGORIES,
      "category"
    );
    const status = Validator.optionalEnum(
      optionalQueryString(searchParams, "status"),
      VALUE_STATUSES,
      "status"
    );
    const pagination = parseCursorPagination(searchParams);

    const result = await valueService.getOpportunities(ctx, {
      category,
      status,
      ...pagination,
    });

    return NextResponse.json(toCollectionResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
