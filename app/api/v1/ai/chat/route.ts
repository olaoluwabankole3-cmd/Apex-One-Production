import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { aiOrchestratorService } from "@/lib/backend/domains/ai/aiOrchestratorService";
import { BackendError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json();

    if (!body.prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await aiOrchestratorService.processIntelligencePrompt(
      {
        prompt: body.prompt,
        mode: body.mode,
        contextMemoryIds: body.contextMemoryIds,
      },
      ctx
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
