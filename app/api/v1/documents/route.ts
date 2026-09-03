import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { documentConsistencyService } from "@/lib/backend/domains/documents/documentConsistencyService";
import type { UploadDocumentDto } from "@/lib/backend/domains/documents/documentTypes";
import { Validator } from "@/lib/backend/core/validation";
import {
  assertAllowedKeys,
  assertAllowedQueryKeys,
  optionalQueryString,
  parseCursorPagination,
  readJsonObject,
  requireArray,
} from "@/lib/backend/core/requestValidation";
import {
  serializeApiError,
  toApiSuccessResponse,
} from "@/lib/backend/core/httpContract";
import { toCollectionResponse } from "@/lib/contracts/http";

const DOCUMENT_CATEGORIES = [
  "Contract",
  "Invoice",
  "SLA Agreement",
  "Audit Report",
  "Board Paper",
  "Compliance Document",
  "Other",
] as const;
const DOCUMENT_FILTER_CATEGORIES = [...DOCUMENT_CATEGORIES, "all"] as const;
const DOCUMENT_STATUSES = [
  "uploading",
  "processing",
  "indexed",
  "failed",
  "archived",
] as const;
const DOCUMENT_FILTER_STATUSES = [...DOCUMENT_STATUSES, "all"] as const;
const DOCUMENT_FILE_TYPES = ["pdf", "doc", "docx", "xlsx", "csv", "image", "json"] as const;
const DOCUMENT_BODY_KEYS = [
  "name",
  "fileType",
  "category",
  "size",
  "customerId",
  "tags",
  "contentBuffer",
] as const;

export async function GET(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const { searchParams } = req.nextUrl;

    assertAllowedQueryKeys(searchParams, [
      "category",
      "status",
      "customerId",
      "query",
      "limit",
      "cursor",
    ]);

    const category = Validator.optionalEnum(
      optionalQueryString(searchParams, "category"),
      DOCUMENT_FILTER_CATEGORIES,
      "category"
    );
    const status = Validator.optionalEnum(
      optionalQueryString(searchParams, "status"),
      DOCUMENT_FILTER_STATUSES,
      "status"
    );
    const customerIdRaw = optionalQueryString(searchParams, "customerId", 64);
    const customerId = customerIdRaw
      ? Validator.requireId(customerIdRaw, "customerId")
      : undefined;
    const query = optionalQueryString(searchParams, "query", 500);
    const pagination = parseCursorPagination(searchParams);

    const result = await documentConsistencyService.getDocuments(ctx, {
      category,
      status,
      customerId,
      query,
      ...pagination,
    });

    return NextResponse.json(toCollectionResponse(result, requestId));
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}

export async function POST(req: NextRequest) {
  let requestId: string | undefined;

  try {
    const ctx = await resolveTenantContext(req.headers);
    requestId = ctx.requestId;
    const body = await readJsonObject(req);

    assertAllowedKeys(body, DOCUMENT_BODY_KEYS);

    Validator.requireString(body.name, "name", { minLength: 1, maxLength: 255 });
    Validator.requireEnum(body.fileType, DOCUMENT_FILE_TYPES, "fileType");
    Validator.requireEnum(body.category, DOCUMENT_CATEGORIES, "category");
    Validator.requireString(body.size, "size", { maxLength: 64 });

    if (body.customerId !== undefined) {
      Validator.requireId(body.customerId, "customerId");
    }
    if (body.tags !== undefined) {
      const tags = requireArray(body.tags, "tags", 100);
      tags.forEach((tag, index) =>
        Validator.requireString(tag, `tags[${index}]`, { maxLength: 100 })
      );
    }
    if (body.contentBuffer !== undefined) {
      Validator.requireString(body.contentBuffer, "contentBuffer", {
        maxLength: 5_000_000,
      });
    }

    const doc = await documentConsistencyService.uploadDocument(
      body as unknown as UploadDocumentDto,
      ctx
    );

    return NextResponse.json(toApiSuccessResponse(doc, requestId), { status: 201 });
  } catch (error: unknown) {
    const serialized = serializeApiError(error, requestId);
    return NextResponse.json(serialized.body, { status: serialized.status });
  }
}
