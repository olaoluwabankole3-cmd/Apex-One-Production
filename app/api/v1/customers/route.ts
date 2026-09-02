import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import {
  customerService,
  type CreateCustomerDto,
} from "@/lib/backend/domains/customers/customerService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  assertAllowedQueryKeys,
  optionalQueryString,
  parseCursorPagination,
  readJsonObject,
  requireArray,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

const CUSTOMER_TIERS = ["Enterprise", "Mid-Market", "SMB", "all"] as const;
const CUSTOMER_STATUSES = ["active", "at-risk", "onboarding", "dormant", "all"] as const;
const CUSTOMER_BODY_KEYS = [
  "name",
  "subsidiary",
  "tier",
  "status",
  "healthScore",
  "arr",
  "owner",
  "contactName",
  "contactRole",
  "contactEmail",
  "tags",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["tier", "status", "search", "limit", "cursor"]);

    const tier = Validator.optionalEnum(
      optionalQueryString(searchParams, "tier"),
      CUSTOMER_TIERS,
      "tier"
    );
    const status = Validator.optionalEnum(
      optionalQueryString(searchParams, "status"),
      CUSTOMER_STATUSES,
      "status"
    );
    const search = optionalQueryString(searchParams, "search", 500);
    const pagination = parseCursorPagination(searchParams);

    const result = await customerService.getCustomers(ctx, {
      tier,
      status,
      search,
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

    assertAllowedKeys(body, CUSTOMER_BODY_KEYS);

    Validator.requireString(body.name, "name", { minLength: 2, maxLength: 120 });
    Validator.requireEmail(body.contactEmail, "contactEmail");

    if (body.subsidiary !== undefined) {
      Validator.requireString(body.subsidiary, "subsidiary", { maxLength: 120 });
    }
    if (body.tier !== undefined) {
      Validator.requireEnum(body.tier, CUSTOMER_TIERS.slice(0, 3), "tier");
    }
    if (body.status !== undefined) {
      Validator.requireEnum(body.status, CUSTOMER_STATUSES.slice(0, 4), "status");
    }
    if (body.healthScore !== undefined) {
      Validator.requireNumber(body.healthScore, "healthScore", { min: 0, max: 100 });
    }
    if (body.arr !== undefined) {
      Validator.requireNumber(body.arr, "arr", { min: 0 });
    }
    if (body.owner !== undefined) {
      Validator.requireString(body.owner, "owner", { maxLength: 160 });
    }
    if (body.contactName !== undefined) {
      Validator.requireString(body.contactName, "contactName", { maxLength: 160 });
    }
    if (body.contactRole !== undefined) {
      Validator.requireString(body.contactRole, "contactRole", { maxLength: 160 });
    }
    if (body.tags !== undefined) {
      const tags = requireArray(body.tags, "tags", 100);
      tags.forEach((tag, index) =>
        Validator.requireString(tag, `tags[${index}]`, { maxLength: 100 })
      );
    }

    const newCustomer = await customerService.createCustomer(
      body as unknown as CreateCustomerDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(newCustomer, requestId), {
      status: 201,
    });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
