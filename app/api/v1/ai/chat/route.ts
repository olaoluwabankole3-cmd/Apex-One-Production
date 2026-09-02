import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import {
  aiOrchestratorService,
  type AiChatRequestDto,
} from "@/lib/backend/domains/ai/aiOrchestratorService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  readJsonObject,
  requireArray,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

const AI_MODES = [
  "Revenue",
  "Customers",
  "Operations",
  "Capacity",
  "Leakage",
  "Opportunities",
  "Strategy",
  "Executive",
] as const;

export async function POST(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);

    assertAllowedKeys(body, ["prompt", "mode", "contextMemoryIds"]);

    const prompt = Validator.requireString(body.prompt, "prompt", {
      minLength: 1,
      maxLength: 4_000,
    });
    const mode = Validator.optionalEnum(body.mode, AI_MODES, "mode");

    let contextMemoryIds: string[] | undefined;
    if (body.contextMemoryIds !== undefined) {
      const rawIds = requireArray(body.contextMemoryIds, "contextMemoryIds", 100);
      contextMemoryIds = rawIds.map((id, index) =>
        Validator.requireId(id, `contextMemoryIds[${index}]`)
      );
    }

    const dto: AiChatRequestDto = {
      prompt,
      ...(mode ? { mode } : {}),
      ...(contextMemoryIds ? { contextMemoryIds } : {}),
    };

    const result = await aiOrchestratorService.processIntelligencePrompt(dto, ctx);

    return NextResponse.json(toApiSuccessResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
