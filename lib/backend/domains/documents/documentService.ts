/**
 * APEX ONE — Document Domain Service
 *
 * PostgreSQL document metadata is authoritative. Blob storage is deliberately
 * coordinated through durable audit/outbox events because PostgreSQL and S3
 * cannot participate in one ACID transaction.
 */

import { randomUUID } from "node:crypto";
import { db, DatabaseStore } from "../../database/store";
import { AuditLogRecord, DocumentRecord } from "../../database/schema";
import { PaginatedResult, MAX_PAGE_SIZE } from "../../database/querySpecification";
import { collectAllPages } from "../../database/paginationTraversal";
import { TenantContext, requirePermission, ValidationError } from "../../core/security";
import { UploadDocumentDto, DocumentFilterDto, DocumentSummaryDto } from "./documentTypes";
import {
  assertTenantDocumentObjectKey,
  buildTenantDocumentObjectKey,
  IObjectStorageService,
  MAX_DOCUMENT_BYTES,
  ObjectStorageWriteResult,
  objectStorageService,
  resolveDocumentMimeType,
} from "./documentStorage";
import { documentExtractor } from "./documentExtractor";
import { documentSearchIndex, IDocumentSearchIndex } from "./documentSearchIndex";

export interface DocumentListOptions extends DocumentFilterDto {
  limit?: number;
  cursor?: string | null;
}

interface StorageOperationMetadata {
  documentId: string;
  storageKey: string;
  operationType: "upload_cleanup" | "delete_blob";
}

interface StorageOperationAuditMetadata extends StorageOperationMetadata {
  outcome?: "committed" | "deleted" | "compensated";
  attempts?: number;
  lastError?: string;
}

export interface StorageRetrySummary {
  attempted: number;
  completed: number;
  remaining: number;
}

const STORAGE_OPERATION_RESOURCE = "DocumentStorageOperation";
const UPLOAD_PENDING_ACTION = "document_storage:upload_cleanup_pending";
const DELETE_PENDING_ACTION = "document_storage:delete_pending";
const COMPLETED_ACTION = "document_storage:completed";
const RETRY_REQUIRED_ACTION = "document_storage:retry_required";
const INLINE_STORAGE_RETRIES = 3;

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 300);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function storageOperationMetadata(log: AuditLogRecord): StorageOperationMetadata | undefined {
  const metadata = log.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const documentId = metadata.documentId;
  const storageKey = metadata.storageKey;
  const operationType = metadata.operationType;
  if (
    typeof documentId !== "string" ||
    typeof storageKey !== "string" ||
    (operationType !== "upload_cleanup" && operationType !== "delete_blob")
  ) {
    return undefined;
  }
  return { documentId, storageKey, operationType };
}

export class DocumentService {
  constructor(
    private readonly database: DatabaseStore = db,
    private readonly storage: IObjectStorageService = objectStorageService,
    private readonly searchIndex: IDocumentSearchIndex = documentSearchIndex
  ) {}

  public async getDocuments(
    ctx: TenantContext,
    filters?: DocumentListOptions
  ): Promise<PaginatedResult<DocumentRecord>> {
    requirePermission(ctx, "document:read");

    const query = filters?.query?.trim();
    const docIdsFromSearch = query
      ? await this.searchIndex.search(ctx.organizationId, query)
      : undefined;

    return this.database.documentsRepo.findMany(ctx, {
      where: {
        category:
          filters?.category && filters.category !== "all"
            ? (filters.category as any)
            : undefined,
        status:
          filters?.status && filters.status !== "all"
            ? (filters.status as any)
            : undefined,
        customerId: filters?.customerId,
        ...(docIdsFromSearch !== undefined
          ? { id: { in: docIdsFromSearch } }
          : {}),
      },
      limit: filters?.limit,
      cursor: filters?.cursor,
    });
  }

  public async getDocumentById(id: string, ctx: TenantContext): Promise<DocumentRecord> {
    requirePermission(ctx, "document:read");
    return this.database.documentsRepo.findById(id, ctx, "Document");
  }

  private operationAuditRecord(
    ctx: TenantContext,
    operationId: string,
    action: string,
    status: "success" | "error",
    metadata: StorageOperationAuditMetadata
  ) {
    return {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action,
      resource: STORAGE_OPERATION_RESOURCE,
      resourceId: operationId,
      requestId: ctx.requestId,
      status,
      metadata: { ...metadata } as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    } as const;
  }

  private async deleteBlobWithRetries(
    storageKey: string,
    organizationId: string
  ): Promise<number> {
    const safeKey = assertTenantDocumentObjectKey(storageKey, organizationId);
    let lastError: unknown;
    for (let attempt = 1; attempt <= INLINE_STORAGE_RETRIES; attempt += 1) {
      try {
        await this.storage.deleteObject(safeKey);
        return attempt;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async completeStorageOperation(
    ctx: TenantContext,
    operationId: string,
    metadata: StorageOperationMetadata,
    outcome: "committed" | "deleted" | "compensated",
    attempts: number
  ): Promise<void> {
    await this.database.recordAuditLog(
      this.operationAuditRecord(ctx, operationId, COMPLETED_ACTION, "success", {
        ...metadata,
        outcome,
        attempts,
      })
    );
  }

  private async recordStorageRetryRequired(
    ctx: TenantContext,
    operationId: string,
    metadata: StorageOperationMetadata,
    error: unknown
  ): Promise<void> {
    try {
      await this.database.recordAuditLog(
        this.operationAuditRecord(ctx, operationId, RETRY_REQUIRED_ACTION, "error", {
          ...metadata,
          lastError: errorMessage(error),
        })
      );
    } catch {
      // The original pending event remains durable. A later outbox drain can
      // safely retry the idempotent delete even if this diagnostic write fails.
    }
  }

  private async compensateUpload(
    ctx: TenantContext,
    operationId: string,
    metadata: StorageOperationMetadata
  ): Promise<void> {
    try {
      const attempts = await this.deleteBlobWithRetries(metadata.storageKey, ctx.organizationId);
      await this.completeStorageOperation(ctx, operationId, metadata, "compensated", attempts);
    } catch (error) {
      await this.recordStorageRetryRequired(ctx, operationId, metadata, error);
    }
  }

  /**
   * Upload choreography:
   * 1. Durable PostgreSQL audit/outbox reservation.
   * 2. Encrypted S3-compatible object write.
   * 3. PostgreSQL document metadata + audit + outbox completion in one transaction.
   *
   * Any crash after step 1 leaves a recoverable pending operation. If step 3
   * fails after the blob exists, compensation deletes the blob; if compensation
   * cannot complete, the durable pending operation remains retryable.
   */
  public async uploadDocument(dto: UploadDocumentDto, ctx: TenantContext): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");

    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError("Document name is required");
    }
    if (typeof dto.contentBuffer !== "string" || dto.contentBuffer.length === 0) {
      throw new ValidationError("Document content is required");
    }

    const contentBytes = Buffer.byteLength(dto.contentBuffer, "utf8");
    if (contentBytes > MAX_DOCUMENT_BYTES) {
      throw new ValidationError(`Document exceeds maximum size of ${MAX_DOCUMENT_BYTES} bytes`);
    }

    let mimeType: string;
    try {
      mimeType = resolveDocumentMimeType(dto.name, dto.fileType);
    } catch (error) {
      throw new ValidationError(errorMessage(error));
    }

    const docId = `doc-${randomUUID()}`;
    const operationId = `storage-op-${randomUUID()}`;
    const storageKey = buildTenantDocumentObjectKey(ctx.organizationId, docId, dto.name);
    const operationMetadata: StorageOperationMetadata = {
      documentId: docId,
      storageKey,
      operationType: "upload_cleanup",
    };

    await this.database.runInTransaction(ctx, async (uow) => {
      await uow.recordAuditLog(
        this.operationAuditRecord(
          ctx,
          operationId,
          UPLOAD_PENDING_ACTION,
          "success",
          operationMetadata
        )
      );
    });

    let storageResult: ObjectStorageWriteResult;
    try {
      storageResult = await this.storage.putObject(storageKey, dto.contentBuffer, mimeType);
    } catch (error) {
      await this.compensateUpload(ctx, operationId, operationMetadata);
      throw error;
    }

    const now = new Date().toISOString();
    const newDoc: DocumentRecord = {
      id: docId,
      organizationId: ctx.organizationId,
      customerId: dto.customerId,
      name: dto.name.trim(),
      fileType: dto.fileType,
      category: dto.category,
      size: formatBytes(storageResult.bytes),
      uploadedBy: ctx.userEmail,
      storageKey,
      status: "processing",
      metadata: {
        fileSizeBytes: storageResult.bytes,
        mimeType,
        checksumSha256: storageResult.checksumSha256,
        storageUri: storageResult.uri,
      },
      tags: dto.tags || [dto.category],
      extractedFields: [],
      createdAt: now,
      updatedAt: now,
    };

    let savedDoc: DocumentRecord;
    try {
      savedDoc = await this.database.runInTransaction(ctx, async (uow) => {
        const doc = await uow.documents.create(newDoc, uow.context);

        await uow.recordAuditLog({
          organizationId: uow.context.organizationId,
          actorId: uow.context.userId,
          actorEmail: uow.context.userEmail,
          action: "document:upload",
          resource: "Document",
          resourceId: doc.id,
          requestId: uow.context.requestId,
          status: "success",
          metadata: {
            name: doc.name,
            category: doc.category,
            fileSizeBytes: storageResult.bytes,
            checksumSha256: storageResult.checksumSha256,
            storageEncrypted: storageResult.encryption === "AES-256-GCM",
          },
        });

        await uow.recordAuditLog(
          this.operationAuditRecord(
            ctx,
            operationId,
            COMPLETED_ACTION,
            "success",
            {
              ...operationMetadata,
              outcome: "committed",
              attempts: 1,
            }
          )
        );
        return doc;
      });
    } catch (error) {
      await this.compensateUpload(ctx, operationId, operationMetadata);
      throw error;
    }

    return this.processDocument(savedDoc.id, ctx, dto.contentBuffer);
  }

  public async processDocument(
    id: string,
    ctx: TenantContext,
    content?: string
  ): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");

    const doc = await this.database.documentsRepo.findById(id, ctx, "Document");
    const extraction = await documentExtractor.extractFields(doc, content);

    const fullText = `${doc.name} ${doc.category} ${doc.tags.join(" ")} ${extraction.summary} ${extraction.fields
      .map((field) => `${field.label} ${field.value}`)
      .join(" ")}`;
    const indexRef = await this.searchIndex.indexDocument(ctx.organizationId, doc.id, fullText);

    return this.database.runInTransaction(ctx, async (uow) =>
      uow.documents.update(
        id,
        {
          status: "indexed",
          aiSummary: extraction.summary,
          extractedFields: extraction.fields,
          metadata: {
            ...doc.metadata,
            indexRef,
            extractedAt: new Date().toISOString(),
          },
        },
        uow.context,
        "Document"
      )
    );
  }

  /**
   * PostgreSQL metadata deletion and the pending blob-delete event commit in the
   * same transaction. The subsequent S3 DELETE is idempotent. If it fails or
   * the process crashes, the pending operation remains durably retryable.
   */
  public async deleteDocument(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "document:delete");

    const doc = await this.database.documentsRepo.findById(id, ctx, "Document");
    const storageKey = assertTenantDocumentObjectKey(doc.storageKey, ctx.organizationId);
    const operationId = `storage-op-${randomUUID()}`;
    const operationMetadata: StorageOperationMetadata = {
      documentId: doc.id,
      storageKey,
      operationType: "delete_blob",
    };

    const deleted = await this.database.runInTransaction(ctx, async (uow) => {
      const result = await uow.documents.delete(id, uow.context, "Document");
      await uow.recordAuditLog(
        this.operationAuditRecord(
          ctx,
          operationId,
          DELETE_PENDING_ACTION,
          "success",
          operationMetadata
        )
      );
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "document:delete",
        resource: "Document",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { storageCleanupPending: true },
      });
      return result;
    });

    try {
      await this.searchIndex.removeDocument(ctx.organizationId, doc.id);
    } catch (error) {
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "document_search:delete_deferred",
        resource: "Document",
        resourceId: id,
        requestId: ctx.requestId,
        status: "error",
        metadata: { reason: errorMessage(error) },
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const attempts = await this.deleteBlobWithRetries(storageKey, ctx.organizationId);
      await this.completeStorageOperation(ctx, operationId, operationMetadata, "deleted", attempts);
    } catch (error) {
      await this.recordStorageRetryRequired(ctx, operationId, operationMetadata, error);
    }

    return deleted;
  }

  /**
   * Drain durable pending storage operations for one authenticated tenant.
   * Repeated invocation is safe because object deletion is idempotent and an
   * operation is complete only when a completion audit event exists.
   */
  public async retryPendingStorageOperations(
    ctx: TenantContext,
    limit: number = 20
  ): Promise<StorageRetrySummary> {
    requirePermission(ctx, "document:write");
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAX_PAGE_SIZE));
    const logs = await collectAllPages<AuditLogRecord>((cursor) =>
      this.database.auditLogsRepo.findMany(ctx, {
        where: { resource: { eq: STORAGE_OPERATION_RESOURCE } },
        limit: MAX_PAGE_SIZE,
        cursor,
      })
    );

    const completedIds = new Set(
      logs.filter((log) => log.action === COMPLETED_ACTION).map((log) => log.resourceId)
    );
    const pending = new Map<string, { log: AuditLogRecord; metadata: StorageOperationMetadata }>();
    for (const log of logs) {
      if (log.action !== UPLOAD_PENDING_ACTION && log.action !== DELETE_PENDING_ACTION) continue;
      if (completedIds.has(log.resourceId) || pending.has(log.resourceId)) continue;
      const metadata = storageOperationMetadata(log);
      if (metadata) pending.set(log.resourceId, { log, metadata });
    }

    let attempted = 0;
    let completed = 0;
    for (const [operationId, operation] of Array.from(pending.entries()).slice(0, safeLimit)) {
      attempted += 1;
      try {
        const attempts = await this.deleteBlobWithRetries(
          operation.metadata.storageKey,
          ctx.organizationId
        );
        await this.completeStorageOperation(
          ctx,
          operationId,
          operation.metadata,
          operation.metadata.operationType === "upload_cleanup" ? "compensated" : "deleted",
          attempts
        );
        completed += 1;
      } catch (error) {
        await this.recordStorageRetryRequired(ctx, operationId, operation.metadata, error);
      }
    }

    return {
      attempted,
      completed,
      remaining: Math.max(0, pending.size - completed),
    };
  }

  public async getSummary(ctx: TenantContext): Promise<DocumentSummaryDto> {
    requirePermission(ctx, "document:read");

    const docs = await collectAllPages<DocumentRecord>((cursor) =>
      this.database.documentsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
    );
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalStorageBytes = 0;

    for (const document of docs) {
      byCategory[document.category] = (byCategory[document.category] || 0) + 1;
      byStatus[document.status] = (byStatus[document.status] || 0) + 1;
      totalStorageBytes += document.metadata?.fileSizeBytes || 0;
    }

    return {
      totalDocuments: docs.length,
      byCategory,
      byStatus,
      totalStorageBytes,
    };
  }
}

export const documentService = new DocumentService();
