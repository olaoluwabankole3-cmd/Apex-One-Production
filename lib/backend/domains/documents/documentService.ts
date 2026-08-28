/**
 * APEX ONE — Document Domain Service
 * 
 * Manages document metadata, secure upload tracking, extraction pipelines,
 * and tenant-isolated index querying.
 */

import { db, DatabaseStore } from "../../database/store";
import { DocumentRecord } from "../../database/schema";
import { TenantContext, requirePermission, ValidationError, NotFoundError } from "../../core/security";
import { UploadDocumentDto, DocumentFilterDto, DocumentSummaryDto } from "./documentTypes";
import { objectStorageService, IObjectStorageService } from "./documentStorage";
import { documentExtractor } from "./documentExtractor";
import { documentSearchIndex, IDocumentSearchIndex } from "./documentSearchIndex";

export class DocumentService {
  constructor(
    private readonly database: DatabaseStore = db,
    private readonly storage: IObjectStorageService = objectStorageService,
    private readonly searchIndex: IDocumentSearchIndex = documentSearchIndex
  ) {}

  /**
   * List all documents matching tenant criteria.
   */
  public async getDocuments(ctx: TenantContext, filters?: DocumentFilterDto): Promise<DocumentRecord[]> {
    requirePermission(ctx, "document:read");

    let docIdsFromSearch: string[] | undefined;
    if (filters?.query && filters.query.trim().length > 0) {
      docIdsFromSearch = await this.searchIndex.search(ctx.organizationId, filters.query.trim());
    }

    return this.database.documentsRepo.findMany(ctx, {
      filter: {
        category: filters?.category && filters.category !== "all" ? (filters.category as any) : undefined,
        status: filters?.status && filters.status !== "all" ? (filters.status as any) : undefined,
        customerId: filters?.customerId,
        search: filters?.query,
      },
    });
  }

  /**
   * Fetch a single document by ID within tenant context.
   */
  public async getDocumentById(id: string, ctx: TenantContext): Promise<DocumentRecord> {
    requirePermission(ctx, "document:read");
    return this.database.documentsRepo.findById(id, ctx, "Document");
  }

  /**
   * Register and upload new document metadata with storage and index triggers.
   */
  public async uploadDocument(dto: UploadDocumentDto, ctx: TenantContext): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");

    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError("Document name is required");
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const storageKey = `documents/${ctx.organizationId}/${docId}/${dto.name}`;

    // 1. Put into object storage
    const content = dto.contentBuffer || `Simulated document content for ${dto.name}`;
    const storageResult = await this.storage.putObject(
      storageKey,
      content,
      dto.fileType === "pdf" ? "application/pdf" : "application/octet-stream"
    );

    // 2. Base Record Creation
    const newDoc: DocumentRecord = {
      id: docId,
      organizationId: ctx.organizationId,
      customerId: dto.customerId,
      name: dto.name.trim(),
      fileType: dto.fileType,
      category: dto.category,
      size: dto.size || "1.0 MB",
      uploadedBy: ctx.userEmail,
      storageKey,
      status: "processing",
      metadata: {
        fileSizeBytes: storageResult.bytes,
        mimeType: dto.fileType === "pdf" ? "application/pdf" : "application/octet-stream",
        storageUri: storageResult.uri,
      },
      tags: dto.tags || [dto.category],
      extractedFields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedDoc = await this.database.runInTransaction(ctx, async (uow) => {
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
        metadata: { name: doc.name, category: doc.category, size: doc.size },
      });

      return doc;
    });

    // 3. Process & Extract
    return this.processDocument(savedDoc.id, ctx, content);
  }

  /**
   * Run extraction and indexing pipeline.
   */
  public async processDocument(id: string, ctx: TenantContext, content?: string): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");

    const doc = await this.database.documentsRepo.findById(id, ctx, "Document");
    const extraction = await documentExtractor.extractFields(doc, content);

    // Index search tokens
    const fullText = `${doc.name} ${doc.category} ${doc.tags.join(" ")} ${extraction.summary} ${extraction.fields
      .map((f) => `${f.label} ${f.value}`)
      .join(" ")}`;
    const indexRef = await this.searchIndex.indexDocument(ctx.organizationId, doc.id, fullText);

    return this.database.runInTransaction(ctx, async (uow) => {
      const updated = await uow.documents.update(
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
      );

      return updated;
    });
  }

  /**
   * Delete a document within tenant context.
   */
  public async deleteDocument(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "document:delete");

    const doc = await this.database.documentsRepo.findById(id, ctx, "Document");
    await this.storage.deleteObject(doc.storageKey);
    await this.searchIndex.removeDocument(ctx.organizationId, doc.id);

    return this.database.runInTransaction(ctx, async (uow) => {
      const result = await uow.documents.delete(id, uow.context, "Document");

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "document:delete",
        resource: "Document",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
      });

      return result;
    });
  }

  /**
   * Get metrics summary of tenant documents.
   */
  public async getSummary(ctx: TenantContext): Promise<DocumentSummaryDto> {
    requirePermission(ctx, "document:read");

    const docs = await this.database.documentsRepo.findMany(ctx);
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalStorageBytes = 0;

    for (const d of docs) {
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      totalStorageBytes += d.metadata?.fileSizeBytes || 0;
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
