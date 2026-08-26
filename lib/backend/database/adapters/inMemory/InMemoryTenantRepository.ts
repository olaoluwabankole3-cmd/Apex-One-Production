/**
 * APEX ONE — Temporary In-Memory Repository Adapter
 * 
 * ARCHITECTURAL NOTICE:
 * This is an in-memory storage adapter used strictly for development, testing, and isolated demonstrations.
 * In Phase 3, this adapter will be replaced with a PostgreSQL / Cloud SQL implementation without altering domain services.
 */

import { TenantContext, NotFoundError, CrossTenantViolationError } from "../../../core/errors";
import { ITenantScopedRepository } from "../../repository";

export class InMemoryTenantRepository<T extends { id: string; organizationId: string }>
  implements ITenantScopedRepository<T>
{
  constructor(
    protected readonly collectionName: string,
    protected readonly store: Map<string, T>,
    private readonly onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void
  ) {}

  public async findById(id: string, ctx: TenantContext, resourceName: string = this.collectionName): Promise<T> {
    const item = this.store.get(id);

    if (!item) {
      throw new NotFoundError(resourceName);
    }

    if (item.organizationId !== ctx.organizationId) {
      if (this.onAuditViolation) {
        this.onAuditViolation(ctx, id, item.organizationId);
      }
      throw new CrossTenantViolationError(item.organizationId, ctx.organizationId);
    }

    return item;
  }

  public async findMany(ctx: TenantContext, filter?: (item: T) => boolean): Promise<T[]> {
    const tenantItems = Array.from(this.store.values()).filter((item) => item.organizationId === ctx.organizationId);
    if (!filter) {
      return tenantItems;
    }
    return tenantItems.filter(filter);
  }

  public async create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T> {
    const item = {
      ...data,
      organizationId: ctx.organizationId, // Strictly bound to authenticated tenant
    } as T;

    this.store.set(item.id, item);
    return item;
  }

  public async update(
    id: string,
    updates: Partial<T>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<T> {
    const existing = await this.findById(id, ctx, resourceName);

    // Prevent caller from overriding tenant ownership or entity ID
    const safeUpdates = { ...updates };
    delete (safeUpdates as Record<string, unknown>).organizationId;
    delete (safeUpdates as Record<string, unknown>).id;

    const updated = {
      ...existing,
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    } as T;

    this.store.set(id, updated);
    return updated;
  }

  public async delete(id: string, ctx: TenantContext, resourceName: string = this.collectionName): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    return this.store.delete(id);
  }

  public async search(ctx: TenantContext, predicate: (item: T) => boolean): Promise<T[]> {
    return this.findMany(ctx, predicate);
  }
}
