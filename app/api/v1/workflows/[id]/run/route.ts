import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const cursor = searchParams.get("cursor");

    const runs = await workflowService.getWorkflowRuns(id, ctx, { limit, cursor });
    return NextResponse.json({
      success: true,
      data: runs.items,
      nextCursor: runs.nextCursor,
      cursor: runs.nextCursor,
      hasMore: runs.hasMore,
      count: runs.count,
      totalCount: runs.totalCount,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const run = await workflowService.triggerWorkflowRun(
      {
        workflowId: id,
        triggerType: body.triggerType || "manual",
        contextData: body.contextData,
      },
      ctx
    );
    return NextResponse.json({ success: true, data: run }, { status: 201 });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
