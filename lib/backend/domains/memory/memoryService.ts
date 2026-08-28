/**
 * APEX ONE — Organizational Memory Domain Service
 */

import { db, DatabaseStore } from "../../database/store";
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
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * List organizational memory items for the tenant.
   */
  public async getMemoryItems(
    ctx: TenantContext,
    filters?: { type?: string; search?: string }
  ): Promise<OrganizationalMemoryRecord[]> {
    requirePermission(ctx, "org:read");

    return this.database.memoryRepo.findMany(ctx, {
      filter: {
        type: filters?.type && filters.type !== "all" ? (filters.type as any) : undefined,
        search: filters?.search,
      },
    });
  }

  /**
   * Retrieve a specific memory record, enforcing repository tenant isolation.
   */
  public async getMemoryById(id: string, ctx: TenantContext): Promise<OrganizationalMemoryRecord> {
    requirePermission(ctx, "org:read");
    Validator.requireId(id, "memoryId");
    return this.database.memoryRepo.findById(id, ctx, "OrganizationalMemory");
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
    const now = new Date().toISOString();
    const recordData: Omit<OrganizationalMemoryRecord, "organizationId"> = {
      id,
      type: validatedType,
      title: validatedTitle,
      content: validatedContent,
      source: validatedSource,
      sourceReference: dto.sourceReference || "manual_entry",
      confidence: validatedConfidence,
      effectiveAt: dto.effectiveAt || now,
      verified: dto.verified ?? true,
      createdAt: now,
    };

    return this.database.runInTransaction(ctx, async (uow) => {
      const record = await uow.memory.create(recordData, uow.context);

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "memory:record",
        resource: "OrganizationalMemory",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { title: record.title, source: record.source },
        timestamp: now,
      });

      return record;
    });
  }
}

export const memoryService = new MemoryService();
