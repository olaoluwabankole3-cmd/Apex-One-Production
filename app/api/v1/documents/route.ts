import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { documentService } from "@/lib/backend/domains/documents/documentService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const query = searchParams.get("query") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const cursor = searchParams.get("cursor") || undefined;

    const result = await documentService.getDocuments(ctx, { category, status, customerId, query, limit, cursor });
    return NextResponse.json({
      success: true,
      data: result.items,
      cursor: result.nextCursor,
      hasMore: result.hasMore,
      count: result.count,
      organizationId: ctx.organizationId,
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
    const doc = await documentService.uploadDocument(body, ctx);
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
