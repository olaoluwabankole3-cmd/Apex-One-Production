import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { workflowService } from "@/lib/backend/domains/workflows/workflowService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    const wf = await workflowService.getWorkflowById(id, ctx);
    return NextResponse.json({ success: true, data: wf });
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
    const wf = await workflowService.updateWorkflow(id, body, ctx);
    return NextResponse.json({ success: true, data: wf });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
