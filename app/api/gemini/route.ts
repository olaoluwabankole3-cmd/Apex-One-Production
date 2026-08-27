import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, requirePermission } from "@/lib/backend/core/security";
import { db } from "@/lib/backend/database/store";
import { Validator } from "@/lib/backend/core/validation";
import { BackendError } from "@/lib/backend/core/errors";

let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    requirePermission(ctx, "ai:execute");

    const body = await req.json().catch(() => ({}));
    const validatedPrompt = Validator.requireString(body.prompt, "prompt", { minLength: 1, maxLength: 4000 });

    const org = db.organizations.get(ctx.organizationId);
    const orgName = org?.name || "Enterprise Workspace";
    const currency = org?.currencySymbol || "₦";

    // Dynamic ground context strictly from authenticated tenant data
    const customers = await db.customersRepo.findMany(ctx);
    const opps = await db.opportunitiesRepo.findMany(ctx);
    const totalArr = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const totalOpps = opps.reduce((sum, o) => sum + (o.potentialValue || 0), 0);

    db.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "ai:execute_gemini",
      resource: "GeminiRoute",
      resourceId: "generate",
      requestId: ctx.requestId,
      status: "success",
      metadata: { promptLength: validatedPrompt.length, monitoredAccounts: customers.length },
      timestamp: new Date().toISOString(),
    });

    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: validatedPrompt,
      config: {
        systemInstruction: `You are APEX ONE Executive Intelligence Analyst for ${orgName}.
Monitored Organization Context:
- Currency: ${currency}
- Monitored Accounts: ${customers.length} (Total ARR: ${currency}${totalArr.toLocaleString()})
- Identified Value Opportunities: ${opps.length} (Total: ${currency}${totalOpps.toLocaleString()})

When replying to queries about executive intelligence, financial analysis, audits, or operational strategy:
1. Provide structured, authoritative, and scannable insights.
2. If discussing financial impact, format figures in ${currency}.
3. Speak with executive composure, board-level eloquence, and high precision.
4. If no enterprise data has been loaded yet, provide actionable instructions on configuring database sync or importing records.`,
      },
    });

    return NextResponse.json({ text: response.text || "No response received." });
  } catch (error: any) {
    if (error instanceof BackendError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: error?.message || "An error occurred during generative intelligence execution.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

