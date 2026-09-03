import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { documentConsistencyService } from "@/lib/backend/domains/documents/documentConsistencyService";
import { Validator } from "@/lib/backend/core/validation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const documentId = Validator.requireId(id, "documentId");
    const doc = await documentConsistencyService.getDocumentById(documentId, ctx);

    return NextResponse.json(toApiSuccessResponse(doc, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { id } = await params;
    const documentId = Validator.requireId(id, "documentId");
    await documentConsistencyService.deleteDocument(documentId, ctx);

    return NextResponse.json(
      toApiSuccessResponse({ deleted: true, id: documentId }, requestId)
    );
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
