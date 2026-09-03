import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { controlledKnowledgeService } from "@/lib/backend/domains/knowledge/controlledKnowledgeService";
import type { KnowledgePublicationScope } from "@/lib/backend/domains/knowledge/knowledgeRevisionModel";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
import {
  assertAllowedKeys,
  readJsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

function parseRevision(value: string): number {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new ValidationError("revision must be a positive safe integer");
  }
  return revision;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; revision: string }> }
) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id, revision: rawRevision } = await params;
    const knowledgeId = Validator.requireId(id, "knowledgeId");
    const revision = parseRevision(rawRevision);
    const body = await readJsonObject(req);
    assertAllowedKeys(body, ["scope"] as const);
    const scope = Validator.requireEnum(
      body.scope,
      ["tenant", "platform"] as const,
      "scope"
    ) as KnowledgePublicationScope;

    const result = await controlledKnowledgeService.publishRevision(
      knowledgeId,
      revision,
      scope,
      ctx
    );
    return NextResponse.json(toApiSuccessResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
