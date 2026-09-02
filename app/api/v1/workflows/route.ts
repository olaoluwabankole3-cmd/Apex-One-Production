import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const cursor = searchParams.get("cursor") || undefined;

    const result = await workflowService.getWorkflows(ctx, { status, limit, cursor });
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
    const wf = await workflowService.createWorkflow(body, ctx);
    return NextResponse.json({ success: true, data: wf }, { status: 201 });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
