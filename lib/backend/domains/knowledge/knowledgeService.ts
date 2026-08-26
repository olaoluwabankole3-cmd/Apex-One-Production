/**
 * APEX ONE — Knowledge Domain Service
 * 
 * Manages institutional memory, playbooks, policies, and regulatory guidelines
 * with strict organization-level scoping.
 */

import { db } from "../../database/store";
import { KnowledgeItemRecord } from "../../database/schema";
import { TenantContext, requirePermission, ValidationError, NotFoundError } from "../../core/security";
import { CreateKnowledgeItemDto, UpdateKnowledgeItemDto, KnowledgeFilterDto } from "./knowledgeTypes";

export class KnowledgeService {
  /**
   * List all knowledge items accessible in the tenant context.
   */
  public async getKnowledgeItems(ctx: TenantContext, filters?: KnowledgeFilterDto): Promise<KnowledgeItemRecord[]> {
    requirePermission(ctx, "knowledge:read");

    return db.knowledgeRepo.findMany(ctx, (k) => {
      if (filters?.category && filters.category !== "all" && k.category !== filters.category) {
        return false;
      }
      if (filters?.tags && filters.tags.length > 0) {
        const matchesTag = filters.tags.some((t) => k.tags.includes(t));
        if (!matchesTag) return false;
      }
      if (filters?.query && filters.query.trim().length > 0) {
        const q = filters.query.toLowerCase().trim();
        return (
          k.title.toLowerCase().includes(q) ||
          k.content.toLowerCase().includes(q) ||
          (k.summary && k.summary.toLowerCase().includes(q)) ||
          k.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }

  /**
   * Fetch single knowledge item by ID.
   */
  public async getKnowledgeItemById(id: string, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:read");
    return db.knowledgeRepo.findById(id, ctx, "KnowledgeItem");
  }

  /**
   * Create new knowledge item for the tenant.
   */
  public async createKnowledgeItem(dto: CreateKnowledgeItemDto, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");

    if (!dto.title || dto.title.trim().length === 0) {
      throw new ValidationError("Knowledge item title is required");
    }
    if (!dto.content || dto.content.trim().length === 0) {
      throw new ValidationError("Knowledge item content is required");
    }

    const id = `know-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return db.knowledgeRepo.create(newItem, ctx);
  }

  /**
   * Update an existing knowledge item.
   */
  public async updateKnowledgeItem(
    id: string,
    dto: UpdateKnowledgeItemDto,
    ctx: TenantContext
  ): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");

    const existing = await db.knowledgeRepo.findById(id, ctx, "KnowledgeItem");
    const nextVersion = existing.version + 1;

    return db.knowledgeRepo.update(
      id,
      {
        ...dto,
        version: nextVersion,
      },
      ctx,
      "KnowledgeItem"
    );
  }

  /**
   * Delete knowledge item within tenant context.
   */
  public async deleteKnowledgeItem(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "knowledge:write");
    return db.knowledgeRepo.delete(id, ctx, "KnowledgeItem");
  }
}

export const knowledgeService = new KnowledgeService();
