import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { valueService } from "@/lib/backend/domains/value/valueService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const items = await valueService.getCapturedLedger(ctx);
    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
      organizationId: ctx.organizationId,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
