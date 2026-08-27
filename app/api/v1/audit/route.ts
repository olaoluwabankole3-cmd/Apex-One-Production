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
    const limit = rawLimit ? Validator.optionalNumber(Number(rawLimit), "limit", { min: 1, max: 500 }) ?? 50 : 50;

    const logs = await auditService.getAuditLogs(ctx, limit);
    return NextResponse.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

