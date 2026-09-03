import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { controlledKnowledgeService } from "@/lib/backend/domains/knowledge/controlledKnowledgeService";
import { Validator } from "@/lib/backend/core/validation";
import { ValidationError } from "@/lib/backend/core/errors";
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
    const result = await controlledKnowledgeService.validateRevision(
      knowledgeId,
      revision,
      ctx
    );
    return NextResponse.json(toApiSuccessResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
