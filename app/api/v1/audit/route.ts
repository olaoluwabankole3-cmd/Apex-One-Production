import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { auditService } from "@/lib/backend/domains/audit/auditService";
import { BackendError } from "@/lib/backend/core/errors";
import { Validator } from "@/lib/backend/core/validation";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { searchParams } = new URL(req.url);
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? parseInt(rawLimit, 10) : undefined;
    const cursor = searchParams.get("cursor") || undefined;

    const result = await auditService.getAuditLogs(ctx, { limit, cursor });
    return NextResponse.json({
      success: true,
      data: result.items,
      cursor: result.nextCursor,
      hasMore: result.hasMore,
      count: result.count,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

