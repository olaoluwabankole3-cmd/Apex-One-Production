import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { NotFoundError, ValidationError } from "@/lib/backend/core/errors";
import { requireJsonObject, assertAllowedKeys, assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { Validator } from "@/lib/backend/core/validation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import { createApplicationInfrastructure } from "@/lib/backend/infrastructure/composition";
import { FinancialPreviewCaseLedger } from "@/lib/backend/domains/reconciliation/financialPreviewCaseLedger";
import { BankingCaseService } from "@/lib/backend/domains/banking-cases/bankingCaseService";
import { BankingCasePilotBridge } from "@/lib/backend/domains/banking-cases/bankingCasePilotBridge";

/**
 * Staging-only opt-in. Operates on previously persisted, metadata-only
 * financial preview candidates. No raw CSV upload, bank connector, source
 * certification, financial-loss assertion or money movement is supported.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

async function readBoundedPilotIds(req: NextRequest) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get("content-type") ?? "")) {
    throw new ValidationError("Pilot bridge requires application/json");
  }
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^(?:0|[1-9][0-9]*)$/.test(declared) || Number(declared) > 2048)) {
    throw new ValidationError("Pilot bridge input exceeds 2048-byte limit");
  }
  if (!req.body) throw new ValidationError("Pilot bridge request body is required");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2048) {
        await reader.cancel();
        throw new ValidationError("Pilot bridge input exceeds 2048-byte limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const data = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map(x => Buffer.from(x))));
    return requireJsonObject(JSON.parse(data));
  } catch {
    throw new ValidationError("Pilot bridge requires valid UTF-8 JSON object");
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;
  try {
    if (process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging" ||
        process.env.CORTEX_FINANCIAL_CASE_BRIDGE_ENABLED !== "true") {
      throw new NotFoundError("Financial case pilot");
    }
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readBoundedPilotIds(req);
    assertAllowedKeys(body, ["batchId", "candidateId"]);
    const batchId = Validator.requireString(body.batchId, "batchId", { maxLength: 48 });
    const candidateId = Validator.requireString(body.candidateId, "candidateId", { maxLength: 40 });
    const infrastructure = createApplicationInfrastructure();
    if (!infrastructure.database.isPostgresBacked() || !process.env.DATABASE_URL) {
      throw new NotFoundError("Financial case pilot");
    }
    const bridge = new BankingCasePilotBridge(
      new BankingCaseService(infrastructure.database),
      new FinancialPreviewCaseLedger(process.env.DATABASE_URL)
    );
    const record = await bridge.createEscalatedCandidate(ctx, { batchId, candidateId });
    return NextResponse.json(toApiSuccessResponse(record, requestId), { status: 201, headers });
  } catch (error) {
    const failure = serializeApiError(error, requestId);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
