import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { Validator } from "@/lib/backend/core/validation";
import { BackendError } from "@/lib/backend/core/errors";
import { aiOrchestratorService } from "@/lib/backend/domains/ai/aiOrchestratorService";

/**
 * Legacy compatibility route.
 *
 * Stage 8 removes the historical direct repository/Gemini bypass. All AI
 * requests now traverse the same authenticated, query-scoped trust boundary as
 * /api/v1/ai/chat. The response keeps a top-level `text` alias for older clients
 * while also exposing the canonical facts/modelProse/retrieval structure.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json().catch(() => ({}));
    const prompt = Validator.requireString(body.prompt, "prompt", { minLength: 1, maxLength: 4000 });
    const mode = typeof body.mode === "string" ? body.mode : "Executive";
    const contextMemoryIds = Array.isArray(body.contextMemoryIds)
      ? body.contextMemoryIds.filter((value: unknown): value is string => typeof value === "string").slice(0, 25)
      : undefined;

    const result = await aiOrchestratorService.processIntelligencePrompt(
      { prompt, mode, contextMemoryIds },
      ctx
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof BackendError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("AI compatibility route error:", error);
    return NextResponse.json(
      { error: "An error occurred during enterprise intelligence execution.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
