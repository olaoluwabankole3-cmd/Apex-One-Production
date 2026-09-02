import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { valueService } from "@/lib/backend/domains/value/valueService";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  readJsonObject,
  type JsonObject,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

const SIMULATION_KEYS = [
  "pricingDeltaPct",
  "retentionRatePct",
  "headcountPct",
  "automationPct",
  "salesConversionPct",
  "profile",
] as const;
const SIMULATION_PROFILES = ["Conservative", "Expected", "Aggressive"] as const;

export async function POST(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body: JsonObject = req.body === null ? {} : await readJsonObject(req);

    assertAllowedKeys(body, SIMULATION_KEYS);

    const pricingDeltaPct =
      Validator.optionalNumber(body.pricingDeltaPct, "pricingDeltaPct", {
        min: -100,
      }) ?? 5;
    const retentionRatePct =
      Validator.optionalNumber(body.retentionRatePct, "retentionRatePct", {
        min: 0,
        max: 100,
      }) ?? 92;
    const headcountPct =
      Validator.optionalNumber(body.headcountPct, "headcountPct", {
        min: 0,
      }) ?? 100;
    const automationPct =
      Validator.optionalNumber(body.automationPct, "automationPct", {
        min: 0,
        max: 100,
      }) ?? 45;
    const salesConversionPct =
      Validator.optionalNumber(body.salesConversionPct, "salesConversionPct", {
        min: 0,
        max: 100,
      }) ?? 24;
    const profile = Validator.optionalEnum(
      body.profile,
      SIMULATION_PROFILES,
      "profile"
    );

    const simulation = await valueService.simulateScenario(
      {
        pricingDeltaPct,
        retentionRatePct,
        headcountPct,
        automationPct,
        salesConversionPct,
        ...(profile ? { profile } : {}),
      },
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(simulation, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
