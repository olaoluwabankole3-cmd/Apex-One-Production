import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { documentService } from "@/lib/backend/domains/documents/documentService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const doc = await documentService.getDocumentById(id, ctx);
    return NextResponse.json({ success: true, data: doc });
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
    await documentService.deleteDocument(id, ctx);
    return NextResponse.json({ success: true, message: "Document deleted successfully" });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
