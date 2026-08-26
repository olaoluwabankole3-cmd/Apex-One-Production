/**
 * APEX ONE — Document Domain Service
 * 
 * Manages document metadata, secure upload tracking, extraction pipelines,
 * and tenant-isolated index querying.
 */

import { db } from "../../database/store";
import { DocumentRecord } from "../../database/schema";
import { TenantContext, requirePermission, ValidationError, NotFoundError } from "../../core/security";
import { UploadDocumentDto, DocumentFilterDto, DocumentSummaryDto } from "./documentTypes";
import { objectStorageService } from "./documentStorage";
import { documentExtractor } from "./documentExtractor";
import { documentSearchIndex } from "./documentSearchIndex";

export class DocumentService {
  /**
   * List all documents matching tenant criteria.
   */
  public async getDocuments(ctx: TenantContext, filters?: DocumentFilterDto): Promise<DocumentRecord[]> {
    requirePermission(ctx, "document:read");

    let docIdsFromSearch: string[] | undefined;
    if (filters?.query && filters.query.trim().length > 0) {
      docIdsFromSearch = await documentSearchIndex.search(ctx.organizationId, filters.query.trim());
    }

    return db.documentsRepo.findMany(ctx, (doc) => {
      if (filters?.category && filters.category !== "all" && doc.category !== filters.category) {
        return false;
      }
      if (filters?.status && filters.status !== "all" && doc.status !== filters.status) {
        return false;
      }
      if (filters?.customerId && doc.customerId !== filters.customerId) {
        return false;
      }
      if (docIdsFromSearch !== undefined) {
        return (
          docIdsFromSearch.includes(doc.id) ||
          doc.name.toLowerCase().includes(filters!.query!.toLowerCase()) ||
          doc.tags.some((t) => t.toLowerCase().includes(filters!.query!.toLowerCase()))
        );
      }
      return true;
    });
  }

  /**
   * Fetch a single document by ID within tenant context.
   */
  public async getDocumentById(id: string, ctx: TenantContext): Promise<DocumentRecord> {
    requirePermission(ctx, "document:read");
    return db.documentsRepo.findById(id, ctx, "Document");
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
    const storageResult = await objectStorageService.putObject(
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

    const savedDoc = await db.documentsRepo.create(newDoc, ctx);

    // 3. Process & Extract
    return this.processDocument(savedDoc.id, ctx, content);
  }

  /**
   * Run extraction and indexing pipeline.
   */
  public async processDocument(id: string, ctx: TenantContext, content?: string): Promise<DocumentRecord> {
    requirePermission(ctx, "document:write");

    const doc = await db.documentsRepo.findById(id, ctx, "Document");
    const extraction = await documentExtractor.extractFields(doc, content);

    // Index search tokens
    const fullText = `${doc.name} ${doc.category} ${doc.tags.join(" ")} ${extraction.summary} ${extraction.fields
      .map((f) => `${f.label} ${f.value}`)
      .join(" ")}`;
    const indexRef = await documentSearchIndex.indexDocument(ctx.organizationId, doc.id, fullText);

    const updated = await db.documentsRepo.update(
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
      ctx,
      "Document"
    );

    return updated;
  }

  /**
   * Delete a document within tenant context.
   */
  public async deleteDocument(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "document:delete");

    const doc = await db.documentsRepo.findById(id, ctx, "Document");
    await objectStorageService.deleteObject(doc.storageKey);
    await documentSearchIndex.removeDocument(ctx.organizationId, doc.id);
    return db.documentsRepo.delete(id, ctx, "Document");
  }

  /**
   * Get metrics summary of tenant documents.
   */
  public async getSummary(ctx: TenantContext): Promise<DocumentSummaryDto> {
    requirePermission(ctx, "document:read");

    const docs = await db.documentsRepo.findMany(ctx);
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
