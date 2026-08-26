import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { valueService } from "@/lib/backend/domains/value/valueService";
import { BackendError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json();

    const simulation = await valueService.simulateScenario(
      {
        pricingDeltaPct: Number(body.pricingDeltaPct ?? 5),
        retentionRatePct: Number(body.retentionRatePct ?? 92),
        headcountPct: Number(body.headcountPct ?? 100),
        automationPct: Number(body.automationPct ?? 45),
        salesConversionPct: Number(body.salesConversionPct ?? 24),
        profile: body.profile,
      },
      ctx
    );

    return NextResponse.json({ success: true, data: simulation });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
