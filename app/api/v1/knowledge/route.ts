import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { knowledgeService } from "@/lib/backend/domains/knowledge/knowledgeService";
import type { CreateKnowledgeItemDto } from "@/lib/backend/domains/knowledge/knowledgeTypes";
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

const KNOWLEDGE_CATEGORIES = [
  "Playbook",
  "Policy",
  "Onboarding",
  "Product",
  "Financial Regulation",
  "Engineering Standard",
  "Treasury Guideline",
] as const;
const KNOWLEDGE_FILTER_CATEGORIES = [...KNOWLEDGE_CATEGORIES, "all"] as const;
const KNOWLEDGE_BODY_KEYS = [
  "title",
  "category",
  "content",
  "summary",
  "sourceDocId",
  "tags",
  "isPublicPlatformKnowledge",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, ["category", "query", "tag", "limit", "cursor"]);

    const category = Validator.optionalEnum(
      optionalQueryString(searchParams, "category"),
      KNOWLEDGE_FILTER_CATEGORIES,
      "category"
    );
    const query = optionalQueryString(searchParams, "query", 500);
    const tag = optionalQueryString(searchParams, "tag", 100);
    const pagination = parseCursorPagination(searchParams);

    const result = await knowledgeService.getKnowledgeItems(ctx, {
      category,
      query,
      tags: tag ? [tag] : undefined,
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

    assertAllowedKeys(body, KNOWLEDGE_BODY_KEYS);

    Validator.requireString(body.title, "title", { minLength: 1, maxLength: 200 });
    Validator.requireEnum(body.category, KNOWLEDGE_CATEGORIES, "category");
    Validator.requireString(body.content, "content", { minLength: 1, maxLength: 100_000 });

    if (body.summary !== undefined) {
      Validator.requireString(body.summary, "summary", { maxLength: 2_000 });
    }
    if (body.sourceDocId !== undefined) {
      Validator.requireId(body.sourceDocId, "sourceDocId");
    }
    if (body.tags !== undefined) {
      const tags = requireArray(body.tags, "tags", 100);
      tags.forEach((tag, index) =>
        Validator.requireString(tag, `tags[${index}]`, { maxLength: 100 })
      );
    }
    if (body.isPublicPlatformKnowledge !== undefined) {
      Validator.optionalBoolean(body.isPublicPlatformKnowledge, "isPublicPlatformKnowledge");
    }

    const item = await knowledgeService.createKnowledgeItem(
      body as unknown as CreateKnowledgeItemDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(item, requestId), { status: 201 });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
