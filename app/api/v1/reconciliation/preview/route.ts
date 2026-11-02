import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { ValidationError } from "@/lib/backend/core/errors";
import { assertAllowedQueryKeys } from "@/lib/backend/core/requestValidation";
import { serializeApiError, toApiSuccessResponse } from "@/lib/backend/core/httpContract";
import { createApplicationInfrastructure } from "@/lib/backend/infrastructure/composition";
import { prepareFinancialCsvPreview } from "@/lib/backend/domains/reconciliation/csvPreviewService";

/**
 * Preview-only. No bank connector, persisted source import, financial recovery
 * claim or workflow execution. Authentication and authorization are mandatory.
 * Audit metadata is written durably before a successful response is returned.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 320 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
} as const;

async function readBoundedJson(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new ValidationError("Financial preview requires application/json");
  }
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    if (!/^(?:0|[1-9]\d*)$/.test(declared) || Number(declared) > MAX_BODY_BYTES) {
      throw new ValidationError("Financial preview request exceeds the size limit");
    }
  }
  if (!req.body) throw new ValidationError("Financial preview request body is required");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ValidationError("Financial preview request exceeds the size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true })
      .decode(Buffer.concat(chunks.map((part) => Buffer.from(part))));
    return JSON.parse(decoded);
  } catch {
    throw new ValidationError("Financial preview request must contain valid UTF-8 JSON");
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    assertAllowedQueryKeys(req.nextUrl.searchParams, []);
    const body = await readBoundedJson(req);
    const result = prepareFinancialCsvPreview(ctx, body);
    const [expected, observed] = result.feedSummaries;

    // Do not log uploaded CSV contents, transaction IDs, amounts or fee records.
    const requestFingerprint = createHash("sha256")
      .update(JSON.stringify([ctx.organizationId, expected.sha256, observed.sha256,
        result.reconciliation.cases[0]?.kind ?? null]))
      .digest("hex");

    await createApplicationInfrastructure().database.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "financial_reconciliation_preview",
      resource: "FinancialReconciliationPreview",
      resourceId: `preview-${requestFingerprint.slice(0, 32)}`,
      requestId: ctx.requestId,
      status: "success",
      metadata: {
        previewOnly: true,
        sourceStored: false,
        coverageVerified: false,
        sourceDigests: result.feedSummaries.map((feed) => feed.sha256),
        recordCounts: result.feedSummaries.map((feed) => feed.rows),
        caseCount: result.reconciliation.cases.length,
        financialLossAssessed: false,
      },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(toApiSuccessResponse(result, requestId), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, {
      status: serialized.status,
      headers: NO_STORE_HEADERS,
    });
  }
}
