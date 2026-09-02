import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import {
  memoryService,
  type CreateMemoryDto,
} from "@/lib/backend/domains/memory/memoryService";
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

const MEMORY_TYPES = ["fact", "history", "decision", "insight", "policy"] as const;
const MEMORY_FILTER_TYPES = [...MEMORY_TYPES, "all"] as const;
const MEMORY_BODY_KEYS = [
  "type",
  "title",
  "content",
  "source",
  "sourceReference",
  "confidence",
  "effectiveAt",
  "verified",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["type", "search", "limit", "cursor"]);

    const type = Validator.optionalEnum(
      optionalQueryString(searchParams, "type"),
      MEMORY_FILTER_TYPES,
      "type"
    );
    const search = optionalQueryString(searchParams, "search", 500);
    const pagination = parseCursorPagination(searchParams);

    const result = await memoryService.getMemoryItems(ctx, {
      type,
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

    assertAllowedKeys(body, MEMORY_BODY_KEYS);

    Validator.requireString(body.title, "title", { minLength: 3, maxLength: 160 });
    Validator.requireString(body.content, "content", { minLength: 5, maxLength: 100_000 });
    Validator.requireString(body.source, "source", { minLength: 2, maxLength: 500 });

    if (body.type !== undefined) {
      Validator.requireEnum(body.type, MEMORY_TYPES, "type");
    }
    if (body.sourceReference !== undefined) {
      Validator.requireString(body.sourceReference, "sourceReference", { maxLength: 1_000 });
    }
    if (body.confidence !== undefined) {
      Validator.requireNumber(body.confidence, "confidence", { min: 0, max: 100 });
    }
    if (body.effectiveAt !== undefined) {
      Validator.requireString(body.effectiveAt, "effectiveAt", { maxLength: 64 });
    }
    if (body.verified !== undefined) {
      Validator.optionalBoolean(body.verified, "verified");
    }

    const memory = await memoryService.addMemory(
      body as unknown as CreateMemoryDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(memory, requestId), { status: 201 });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
