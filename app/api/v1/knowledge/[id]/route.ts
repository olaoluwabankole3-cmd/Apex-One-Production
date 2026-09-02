import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { knowledgeService } from "@/lib/backend/domains/knowledge/knowledgeService";
import type { UpdateKnowledgeItemDto } from "@/lib/backend/domains/knowledge/knowledgeTypes";
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

const KNOWLEDGE_CATEGORIES = [
  "Playbook",
  "Policy",
  "Onboarding",
  "Product",
  "Financial Regulation",
  "Engineering Standard",
  "Treasury Guideline",
] as const;
const KNOWLEDGE_UPDATE_KEYS = [
  "title",
  "category",
  "content",
  "summary",
  "sourceDocId",
  "tags",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const knowledgeId = Validator.requireId(id, "knowledgeId");
    const item = await knowledgeService.getKnowledgeItemById(knowledgeId, ctx);

    return NextResponse.json(toApiSuccessResponse(item, requestId));
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
    const knowledgeId = Validator.requireId(id, "knowledgeId");
    const body = await readJsonObject(req);

    assertAllowedKeys(body, KNOWLEDGE_UPDATE_KEYS);
    assertNonEmptyObject(body);

    if (body.title !== undefined) {
      Validator.requireString(body.title, "title", { minLength: 1, maxLength: 200 });
    }
    if (body.category !== undefined) {
      Validator.requireEnum(body.category, KNOWLEDGE_CATEGORIES, "category");
    }
    if (body.content !== undefined) {
      Validator.requireString(body.content, "content", { minLength: 1, maxLength: 100_000 });
    }
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

    const item = await knowledgeService.updateKnowledgeItem(
      knowledgeId,
      body as unknown as UpdateKnowledgeItemDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(item, requestId));
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
    const knowledgeId = Validator.requireId(id, "knowledgeId");
    await knowledgeService.deleteKnowledgeItem(knowledgeId, ctx);

    return NextResponse.json(
      toApiSuccessResponse({ deleted: true, id: knowledgeId }, requestId)
    );
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
