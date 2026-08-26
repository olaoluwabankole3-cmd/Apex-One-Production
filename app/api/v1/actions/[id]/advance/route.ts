import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { actionService } from "@/lib/backend/domains/actions/actionService";
import { BackendError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const updated = await actionService.advanceAction(params.id, ctx);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
