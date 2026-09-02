/**
 * APEX ONE — Knowledge Domain Service
 *
 * Manages institutional memory, playbooks, policies, and regulatory guidelines
 * with strict organization-level scoping.
 */

import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { KnowledgeItemRecord } from "../../database/schema";
import { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, requirePermission, ValidationError } from "../../core/security";
import { CreateKnowledgeItemDto, UpdateKnowledgeItemDto, KnowledgeFilterDto } from "./knowledgeTypes";

export interface KnowledgeListOptions extends KnowledgeFilterDto {
  limit?: number;
  cursor?: string | null;
}

export class KnowledgeService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  public async getKnowledgeItems(
    ctx: TenantContext,
    filters?: KnowledgeListOptions
  ): Promise<PaginatedResult<KnowledgeItemRecord>> {
    requirePermission(ctx, "knowledge:read");
    const query = filters?.query?.trim();

    return this.database.knowledgeRepo.findMany(ctx, {
      where: {
        category:
          filters?.category && filters.category !== "all"
            ? (filters.category as any)
            : undefined,
        ...(filters?.tags && filters.tags.length > 0
          ? { tags: { arrayContainsAny: filters.tags } }
          : {}),
      },
      ...(query
        ? { search: { fields: ["title", "content", "summary", "tags"], term: query } }
        : {}),
      limit: filters?.limit,
      cursor: filters?.cursor,
    });
  }

  public async getKnowledgeItemById(id: string, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:read");
    return this.database.knowledgeRepo.findById(id, ctx, "KnowledgeItem");
  }

  public async createKnowledgeItem(dto: CreateKnowledgeItemDto, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");

    if (!dto.title || dto.title.trim().length === 0) throw new ValidationError("Knowledge item title is required");
    if (!dto.content || dto.content.trim().length === 0) throw new ValidationError("Knowledge item content is required");

    const id = `know-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newItem: KnowledgeItemRecord = {
      id,
      organizationId: ctx.organizationId,
      title: dto.title.trim(),
      category: dto.category,
      content: dto.content.trim(),
      summary: dto.summary?.trim() || dto.content.slice(0, 160).trim(),
      author: ctx.userEmail,
      sourceDocId: dto.sourceDocId,
      tags: dto.tags || [dto.category],
      isPublicPlatformKnowledge: dto.isPublicPlatformKnowledge || false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.runInTransaction(ctx, async (uow) => {
      const created = await uow.knowledge.create(newItem, uow.context);
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "knowledge:create",
        resource: "KnowledgeItem",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { title: dto.title, category: dto.category },
        timestamp: now,
      });
      return created;
    });
  }

  public async updateKnowledgeItem(
    id: string,
    dto: UpdateKnowledgeItemDto,
    ctx: TenantContext
  ): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");

    return this.database.runInTransaction(ctx, async (uow) => {
      const existing = await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const nextVersion = existing.version + 1;
      const updated = await uow.knowledge.update(
        id,
        { ...dto, version: nextVersion },
        uow.context,
        "KnowledgeItem"
      );
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "knowledge:update",
        resource: "KnowledgeItem",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { version: nextVersion },
        timestamp: new Date().toISOString(),
      });
      return updated;
    });
  }

  public async deleteKnowledgeItem(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "knowledge:write");

    return this.database.runInTransaction(ctx, async (uow) => {
      const result = await uow.knowledge.delete(id, uow.context, "KnowledgeItem");
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "knowledge:delete",
        resource: "KnowledgeItem",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
      return result;
    });
  }
}

export const knowledgeService = new KnowledgeService();
