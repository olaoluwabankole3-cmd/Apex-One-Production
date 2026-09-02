import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import {
  customerService,
  type UpdateCustomerDto,
} from "@/lib/backend/domains/customers/customerService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  assertNonEmptyObject,
  readJsonObject,
  requireArray,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

const CUSTOMER_UPDATE_KEYS = [
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
const CUSTOMER_TIERS = ["Enterprise", "Mid-Market", "SMB"] as const;
const CUSTOMER_STATUSES = ["active", "at-risk", "onboarding", "dormant"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const customerId = Validator.requireId(id, "customerId");
    const customer = await customerService.getCustomerById(customerId, ctx);

    return NextResponse.json(toApiSuccessResponse(customer, requestId));
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
    const customerId = Validator.requireId(id, "customerId");
    const body = await readJsonObject(req);

    assertAllowedKeys(body, CUSTOMER_UPDATE_KEYS);
    assertNonEmptyObject(body);

    if (body.name !== undefined) {
      Validator.requireString(body.name, "name", { minLength: 2, maxLength: 120 });
    }
    if (body.subsidiary !== undefined) {
      Validator.requireString(body.subsidiary, "subsidiary", { maxLength: 120 });
    }
    if (body.tier !== undefined) {
      Validator.requireEnum(body.tier, CUSTOMER_TIERS, "tier");
    }
    if (body.status !== undefined) {
      Validator.requireEnum(body.status, CUSTOMER_STATUSES, "status");
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
    if (body.contactEmail !== undefined) {
      Validator.requireEmail(body.contactEmail, "contactEmail");
    }
    if (body.tags !== undefined) {
      const tags = requireArray(body.tags, "tags", 100);
      tags.forEach((tag, index) =>
        Validator.requireString(tag, `tags[${index}]`, { maxLength: 100 })
      );
    }

    const customer = await customerService.updateCustomer(
      customerId,
      body as unknown as UpdateCustomerDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(customer, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const customerId = Validator.requireId(id, "customerId");
    await customerService.deleteCustomer(customerId, ctx);

    return NextResponse.json(
      toApiSuccessResponse({ deleted: true, id: customerId }, requestId)
    );
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
