import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { knowledgeService } from "@/lib/backend/domains/knowledge/knowledgeService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const query = searchParams.get("query") || undefined;
    const tag = searchParams.get("tag");
    const tags = tag ? [tag] : undefined;

    const items = await knowledgeService.getKnowledgeItems(ctx, { category, query, tags });
    return NextResponse.json({
      success: true,
      count: items.length,
      organizationId: ctx.organizationId,
      data: items,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json();
    const item = await knowledgeService.createKnowledgeItem(body, ctx);
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
