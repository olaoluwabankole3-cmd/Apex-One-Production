import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { knowledgeService } from "@/lib/backend/domains/knowledge/knowledgeService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const item = await knowledgeService.getKnowledgeItemById(id, ctx);
    return NextResponse.json({ success: true, data: item });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const body = await req.json();
    const item = await knowledgeService.updateKnowledgeItem(id, body, ctx);
    return NextResponse.json({ success: true, data: item });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    await knowledgeService.deleteKnowledgeItem(id, ctx);
    return NextResponse.json({ success: true, message: "Knowledge item deleted successfully" });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
