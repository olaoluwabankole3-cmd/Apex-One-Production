import { randomUUID } from "node:crypto";
import type { AuditLogRecord, DocumentRecord } from "../../database/schema";
import { DatabaseStore } from "../../database/store";
import { collectAllPages } from "../../database/paginationTraversal";
import { MAX_PAGE_SIZE } from "../../database/querySpecification";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import type { TenantContext } from "../../core/errors";
import { ConflictError } from "../../core/errors";
import { requirePermission } from "../../core/security";
import { DocumentService, type StorageRetrySummary } from "./documentService";
import type { IObjectStorageService } from "./documentStorage";
import type { IDocumentSearchIndex } from "./documentSearchIndex";
import { nextDocumentConsistencyAttempt } from "./documentConsistencyModel";

const CONSISTENCY_RESOURCE = "DocumentConsistencyOperation";
const PROCESS_PENDING = "document_consistency:process_pending";
const PROCESS_RETRY_REQUIRED = "document_consistency:process_retry_required";
const PROCESS_COMPLETED = "document_consistency:process_completed";
const INDEX_DELETE_DEFERRED = "document_search:delete_deferred";
const INDEX_DELETE_RETRY_REQUIRED = "document_search:delete_retry_required";
const INDEX_DELETE_RETRY_COMPLETED = "document_search:delete_retry_completed";

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 300);
}

interface ProcessingOperationMetadata extends Record<string, unknown> {
  documentId: string;
  operationType: "process_document";
  attempts: number;
  lastError?: string;
}

export interface DocumentRetryLaneSummary {
  attempted: number;
  completed: number;
  remaining: number;
}

export interface DocumentConsistencyRetrySummary {
  attempted: number;
  completed: number;
  remaining: number;
  processing: DocumentRetryLaneSummary;
  searchIndex: DocumentRetryLaneSummary;
  storage: StorageRetrySummary;
}

function readProcessingMetadata(log: AuditLogRecord): ProcessingOperationMetadata | undefined {
  const metadata = log.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  if (metadata.operationType !== "process_document" || typeof metadata.documentId !== "string") {
    return undefined;
  }
  const attempts = typeof metadata.attempts === "number" && Number.isSafeInteger(metadata.attempts)
    ? metadata.attempts
    : 0;
  return {
    documentId: metadata.documentId,
    operationType: "process_document",
    attempts,
    lastError: typeof metadata.lastError === "string" ? metadata.lastError : undefined,
  };
}

export class DocumentConsistencyService extends DocumentService {
  private readonly stage9Database: DatabaseStore;
  private readonly stage9Storage: IObjectStorageService;
  private readonly stage9SearchIndex: IDocumentSearchIndex;

  constructor(
    database?: DatabaseStore,
    storage?: IObjectStorageService,
    searchIndex?: IDocumentSearchIndex
  ) {
    const infrastructure =
      database && storage && searchIndex ? undefined : createApplicationInfrastructure();
    const resolvedDatabase = database ?? infrastructure!.database;
    const resolvedStorage = storage ?? infrastructure!.objectStorage;
    const resolvedSearchIndex = searchIndex ?? infrastructure!.searchIndex;
    super(resolvedDatabase, resolvedStorage, resolvedSearchIndex);
    this.stage9Database = resolvedDatabase;
    this.stage9Storage = resolvedStorage;
    this.stage9SearchIndex = resolvedSearchIndex;
  }

  private operationLog(
    ctx: TenantContext,
    operationId: string,
    action: string,
    status: AuditLogRecord["status"],
    metadata: ProcessingOperationMetadata
  ): Omit<AuditLogRecord, "id"> {
    return {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action,
      resource: CONSISTENCY_RESOURCE,
      resourceId: operationId,
      requestId: ctx.requestId,
      status,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }

  private async markProcessingFailed(
    documentId: string,
    ctx: TenantContext,
    error: unknown
  ): Promise<void> {
    try {
      const current = await this.stage9Database.documentsRepo.findById(
        documentId,
        ctx,
        "Document"
      );
      if (current.status === "indexed" || current.status === "archived") return;
      if (current.status === "failed") return;
      await this.stage9Database.runInTransaction(ctx, async (uow) => {
        const locked = await uow.documents.findById(documentId, uow.context, "Document");
        if (locked.status === "processing" || locked.status === "uploading") {
          await uow.documents.update(
            documentId,
            { status: "failed" },
            uow.context,
            "Document"
          );
          await uow.recordAuditLog({
            organizationId: uow.context.organizationId,
            actorId: uow.context.userId,
            actorEmail: uow.context.userEmail,
            action: "document:processing_failed",
            resource: "Document",
            resourceId: documentId,
            requestId: uow.context.requestId,
            status: "error",
            metadata: { reason: errorMessage(error), retryable: true },
            timestamp: new Date().toISOString(),
          });
        }
      });
    } catch {
      // Preserve the original processing failure. Missing/deleted records do not
      // need a processing-state transition.
    }
  }

  private async runProcessingOperation(
    operationId: string,
    metadata: ProcessingOperationMetadata,
    ctx: TenantContext,
    content?: string
  ): Promise<DocumentRecord> {
    try {
      const current = await this.stage9Database.documentsRepo.findById(
        metadata.documentId,
        ctx,
        "Document"
      );
      if (current.status === "indexed") {
        await this.stage9Database.recordAuditLog(
          this.operationLog(ctx, operationId, PROCESS_COMPLETED, "success", metadata)
        );
        return current;
      }
      if (current.status === "archived") {
        throw new ConflictError("Archived documents cannot be reprocessed");
      }
      if (current.status === "failed") {
        await this.stage9Database.runInTransaction(ctx, async (uow) => {
          await uow.documents.update(
            metadata.documentId,
            { status: "processing" },
            uow.context,
            "Document"
          );
        });
      }

      const result = await super.processDocument(metadata.documentId, ctx, content);
      await this.stage9Database.recordAuditLog(
        this.operationLog(ctx, operationId, PROCESS_COMPLETED, "success", metadata)
      );
      return result;
    } catch (error) {
      await this.markProcessingFailed(metadata.documentId, ctx, error);
      const retryMetadata: ProcessingOperationMetadata = {
        ...metadata,
        attempts: nextDocumentConsistencyAttempt(metadata.attempts),
        lastError: errorMessage(error),
      };
      await this.stage9Database.recordAuditLog(
        this.operationLog(ctx, operationId, PROCESS_RETRY_REQUIRED, "error", retryMetadata)
      );
      throw error;
    }
  }

  public override async processDocument(
    id: string,
    ctx: TenantContext,
    content?: string
  ): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");
    const operationId = `document-consistency-${randomUUID()}`;
    const metadata: ProcessingOperationMetadata = {
      documentId: id,
      operationType: "process_document",
      attempts: 0,
    };
    await this.stage9Database.recordAuditLog(
      this.operationLog(ctx, operationId, PROCESS_PENDING, "success", metadata)
    );
    return this.runProcessingOperation(operationId, metadata, ctx, content);
  }

  private async processingOperations(ctx: TenantContext): Promise<{
    pending: Array<{ operationId: string; metadata: ProcessingOperationMetadata }>;
    totalPending: number;
  }> {
    const logs = await collectAllPages((cursor) =>
      this.stage9Database.auditLogsRepo.findMany(ctx, {
        where: { resource: { eq: CONSISTENCY_RESOURCE } },
        limit: MAX_PAGE_SIZE,
        cursor,
      })
    );
    const completed = new Set(
      logs.filter((log) => log.action === PROCESS_COMPLETED).map((log) => log.resourceId)
    );
    const operations = new Map<string, ProcessingOperationMetadata>();

    for (const log of [...logs].reverse()) {
      if (completed.has(log.resourceId)) continue;
      if (log.action !== PROCESS_PENDING && log.action !== PROCESS_RETRY_REQUIRED) continue;
      const metadata = readProcessingMetadata(log);
      if (!metadata) continue;
      const current = operations.get(log.resourceId);
      if (!current || metadata.attempts >= current.attempts) {
        operations.set(log.resourceId, metadata);
      }
    }

    // Document status is independently durable. If the document row committed
    // but the first consistency event did not (for example, a transient audit
    // write failure), reconstruct retry work from the authoritative status so
    // the document cannot remain permanently stranded in processing/failed.
    const coveredDocumentIds = new Set(
      Array.from(operations.values()).map((metadata) => metadata.documentId)
    );
    const stranded = await collectAllPages((cursor) =>
      this.stage9Database.documentsRepo.findMany(ctx, {
        where: { status: { in: ["processing", "failed"] } },
        limit: MAX_PAGE_SIZE,
        cursor,
      })
    );
    for (const document of stranded) {
      if (coveredDocumentIds.has(document.id)) continue;
      const operationId = `document-consistency-recovery-${document.id}`;
      operations.set(operationId, {
        documentId: document.id,
        operationType: "process_document",
        attempts: 0,
        lastError: "Recovered from durable document status without an active consistency event",
      });
      coveredDocumentIds.add(document.id);
    }

    return {
      pending: Array.from(operations.entries()).map(([operationId, metadata]) => ({ operationId, metadata })),
      totalPending: operations.size,
    };
  }

  private async retryProcessingOperations(
    ctx: TenantContext,
    limit: number
  ): Promise<DocumentRetryLaneSummary> {
    const operations = await this.processingOperations(ctx);
    let attempted = 0;
    let completed = 0;

    for (const operation of operations.pending.slice(0, limit)) {
      attempted += 1;
      try {
        const current = await this.stage9Database.documentsRepo.findById(
          operation.metadata.documentId,
          ctx,
          "Document"
        );
        if (current.status === "indexed") {
          await this.stage9Database.recordAuditLog(
            this.operationLog(ctx, operation.operationId, PROCESS_COMPLETED, "success", operation.metadata)
          );
          completed += 1;
          continue;
        }
        const stored = await this.stage9Storage.getObject(current.storageKey);
        if (!stored) throw new ConflictError("Document blob is unavailable for processing retry");
        const content = Buffer.from(stored.data).toString("utf8");
        await this.runProcessingOperation(
          operation.operationId,
          operation.metadata,
          ctx,
          content
        );
        completed += 1;
      } catch {
        // runProcessingOperation records retry diagnostics; retrieval failures are
        // recorded here because processing was never entered.
        const latest = operation.metadata;
        if (latest.lastError === undefined) {
          const retryMetadata: ProcessingOperationMetadata = {
            ...latest,
            attempts: nextDocumentConsistencyAttempt(latest.attempts),
            lastError: "Document processing retry could not retrieve durable input",
          };
          await this.stage9Database.recordAuditLog(
            this.operationLog(ctx, operation.operationId, PROCESS_RETRY_REQUIRED, "error", retryMetadata)
          );
        }
      }
    }

    const remainingState = await this.processingOperations(ctx);
    return { attempted, completed, remaining: remainingState.totalPending };
  }

  private async retryDeferredSearchDeletes(
    ctx: TenantContext,
    limit: number
  ): Promise<DocumentRetryLaneSummary> {
    const logs = await collectAllPages((cursor) =>
      this.stage9Database.auditLogsRepo.findMany(ctx, {
        where: {
          resource: { eq: "Document" },
          action: { in: [
            INDEX_DELETE_DEFERRED,
            INDEX_DELETE_RETRY_REQUIRED,
            INDEX_DELETE_RETRY_COMPLETED,
          ] },
        },
        limit: MAX_PAGE_SIZE,
        cursor,
      })
    );
    const completed = new Set(
      logs.filter((log) => log.action === INDEX_DELETE_RETRY_COMPLETED).map((log) => log.resourceId)
    );
    const pendingIds = Array.from(
      new Set(
        logs
          .filter(
            (log) =>
              (log.action === INDEX_DELETE_DEFERRED || log.action === INDEX_DELETE_RETRY_REQUIRED) &&
              !completed.has(log.resourceId)
          )
          .map((log) => log.resourceId)
      )
    );

    let attempted = 0;
    let completedCount = 0;
    for (const documentId of pendingIds.slice(0, limit)) {
      attempted += 1;
      try {
        await this.stage9SearchIndex.removeDocument(ctx.organizationId, documentId);
        await this.stage9Database.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: INDEX_DELETE_RETRY_COMPLETED,
          resource: "Document",
          resourceId: documentId,
          requestId: ctx.requestId,
          status: "success",
          metadata: { consistencyOperation: "delete_search_index" },
          timestamp: new Date().toISOString(),
        });
        completedCount += 1;
      } catch (error) {
        await this.stage9Database.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: INDEX_DELETE_RETRY_REQUIRED,
          resource: "Document",
          resourceId: documentId,
          requestId: ctx.requestId,
          status: "error",
          metadata: {
            consistencyOperation: "delete_search_index",
            reason: errorMessage(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      attempted,
      completed: completedCount,
      remaining: Math.max(0, pendingIds.length - completedCount),
    };
  }

  public async retryPendingDocumentOperations(
    ctx: TenantContext,
    limit: number = 20
  ): Promise<DocumentConsistencyRetrySummary> {
    requirePermission(ctx, "document:write");
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAX_PAGE_SIZE));

    const storage = await super.retryPendingStorageOperations(ctx, safeLimit);
    const processing = await this.retryProcessingOperations(ctx, safeLimit);
    const searchIndex = await this.retryDeferredSearchDeletes(ctx, safeLimit);

    return {
      attempted: storage.attempted + processing.attempted + searchIndex.attempted,
      completed: storage.completed + processing.completed + searchIndex.completed,
      remaining: storage.remaining + processing.remaining + searchIndex.remaining,
      storage,
      processing,
      searchIndex,
    };
  }
}

export const documentConsistencyService = new DocumentConsistencyService();
