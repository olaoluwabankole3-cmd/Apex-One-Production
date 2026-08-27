import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { aiOrchestratorService } from "@/lib/backend/domains/ai/aiOrchestratorService";
import { BackendError } from "@/lib/backend/core/errors";
import { Validator } from "@/lib/backend/core/validation";

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json().catch(() => ({}));

    const validatedPrompt = Validator.requireString(body.prompt, "prompt", { minLength: 1, maxLength: 4000 });
    const validatedMode = Validator.optionalEnum(
      body.mode,
      ["Revenue", "Customers", "Operations", "Capacity", "Leakage", "Opportunities", "Strategy", "Executive"] as const,
      "mode"
    );

    const result = await aiOrchestratorService.processIntelligencePrompt(
      {
        prompt: validatedPrompt,
        mode: validatedMode,
        contextMemoryIds: Array.isArray(body.contextMemoryIds) ? body.contextMemoryIds : undefined,
      },
      ctx
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

