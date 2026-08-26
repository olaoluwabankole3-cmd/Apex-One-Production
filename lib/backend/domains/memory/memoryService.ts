/**
 * APEX ONE — Organizational Memory Domain Service
 */

import { db } from "../../database/store";
import { OrganizationalMemoryRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";
import { Validator } from "../../core/validation";

export interface CreateMemoryDto {
  type?: "fact" | "history" | "decision" | "insight" | "policy";
  title: string;
  content: string;
  source: string;
  sourceReference?: string;
  confidence?: number;
  effectiveAt?: string;
  verified?: boolean;
}

export class MemoryService {
  /**
   * List organizational memory items for the tenant.
   */
  public async getMemoryItems(
    ctx: TenantContext,
    filters?: { type?: string; search?: string }
  ): Promise<OrganizationalMemoryRecord[]> {
    requirePermission(ctx, "org:read");

    return db.memoryRepo.findMany(ctx, (m) => {
      if (filters?.type && filters.type !== "all" && m.type !== filters.type) {
        return false;
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !m.content.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Retrieve a specific memory record, enforcing repository tenant isolation.
   */
  public async getMemoryById(id: string, ctx: TenantContext): Promise<OrganizationalMemoryRecord> {
    requirePermission(ctx, "org:read");
    Validator.requireId(id, "memoryId");
    return db.memoryRepo.findById(id, ctx, "OrganizationalMemory");
  }

  /**
   * Ingest a new verified memory record with provenance.
   */
  public async addMemory(dto: CreateMemoryDto, ctx: TenantContext): Promise<OrganizationalMemoryRecord> {
    requirePermission(ctx, "org:write");

    const validatedTitle = Validator.requireString(dto.title, "title", { minLength: 3, maxLength: 160 });
    const validatedContent = Validator.requireString(dto.content, "content", { minLength: 5 });
    const validatedSource = Validator.requireString(dto.source, "source", { minLength: 2 });
    const validatedType = Validator.optionalEnum(
      dto.type,
      ["fact", "history", "decision", "insight", "policy"] as const,
      "type"
    ) || "fact";
    const validatedConfidence = Validator.optionalNumber(dto.confidence, "confidence", { min: 0, max: 100 }) ?? 95;

    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const recordData: Omit<OrganizationalMemoryRecord, "organizationId"> = {
      id,
      type: validatedType,
      title: validatedTitle,
      content: validatedContent,
      source: validatedSource,
      sourceReference: dto.sourceReference || "manual_entry",
      confidence: validatedConfidence,
      effectiveAt: dto.effectiveAt || new Date().toISOString(),
      verified: dto.verified ?? true,
      createdAt: new Date().toISOString(),
    };

    const record = await db.memoryRepo.create(recordData, ctx);

    db.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "memory:record",
      resource: "OrganizationalMemory",
      resourceId: id,
      requestId: ctx.requestId,
      status: "success",
      metadata: { title: record.title, source: record.source },
      timestamp: new Date().toISOString(),
    });

    return record;
  }
}

export const memoryService = new MemoryService();
