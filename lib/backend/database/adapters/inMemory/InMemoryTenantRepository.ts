/**
 * APEX ONE — Temporary In-Memory Repository Adapter
 * 
 * ARCHITECTURAL NOTICE:
 * This is an in-memory storage adapter used strictly for development, testing, and isolated demonstrations.
 * In Phase 3, this adapter will be replaced with a PostgreSQL / Cloud SQL implementation without altering domain services.
 */

import { TenantContext, NotFoundError, CrossTenantViolationError } from "../../../core/errors";
import {
  ITenantScopedRepository,
  CollectionQuery,
  SortOptions,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeQueryLimit,
  normalizeQueryOffset,
  validateSortOptions,
} from "../../repository";

export class InMemoryTenantRepository<
  T extends { id: string; organizationId: string },
  TUpdate = Partial<Omit<T, "id" | "organizationId" | "createdAt">>,
  TFilter = unknown,
  TSortField extends string = string
> implements ITenantScopedRepository<T, TUpdate, TFilter, TSortField> {
  protected readonly allowedSortFields: readonly TSortField[] = [];

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

  public async findMany(
    ctx: TenantContext,
    query?: CollectionQuery<TFilter, TSortField>
  ): Promise<T[]> {
    // 1. TENANT SAFETY: Organization scope is strictly derived from TenantContext.
    // Callers cannot bypass tenant isolation or override organizationId via query payload.
    const tenantItems = Array.from(this.store.values()).filter(
      (item) => item.organizationId === ctx.organizationId
    );

    const limit = normalizeQueryLimit(query?.limit);
    const offset = normalizeQueryOffset(query?.offset);

    let filtered = tenantItems;

    // Apply structured filter if provided
    if (query?.filter) {
      filtered = this.applyStructuredFilter(filtered, query.filter);
    }

    // Validate and apply structured sort if provided
    if (query?.sort) {
      const validatedSort = validateSortOptions(query.sort, this.allowedSortFields);
      if (validatedSort) {
        filtered = this.applySort(filtered, validatedSort);
      }
    }

    // Apply bounded pagination
    return filtered.slice(offset, offset + limit);
  }

  protected applyStructuredFilter(items: T[], _filter?: TFilter): T[] {
    return items;
  }

  protected applySort(items: T[], sort: SortOptions<TSortField>): T[] {
    const { field, direction = "asc" } = sort;
    const modifier = direction === "desc" ? -1 : 1;

    return [...items].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[field];
      const valB = (b as Record<string, unknown>)[field];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1 * modifier;
      if (valB === undefined || valB === null) return -1 * modifier;

      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * modifier;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return valA.localeCompare(valB) * modifier;
      }

      if (typeof valA === "boolean" && typeof valB === "boolean") {
        return (valA === valB ? 0 : valA ? 1 : -1) * modifier;
      }

      return String(valA).localeCompare(String(valB)) * modifier;
    });
  }

  public async create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T> {
    const id = (data as any).id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const item = {
      ...data,
      id,
      organizationId: ctx.organizationId, // Strictly bound to authenticated tenant
    } as T;

    this.store.set(item.id, item);
    return item;
  }

  public async update(
    id: string,
    updates: TUpdate,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<T> {
    const existing = await this.findById(id, ctx, resourceName);

    // Defense-in-depth runtime protection:
    // Strip any attempts to mutate immutable persistence fields or system-managed timestamps,
    // even if an attacker attempts to bypass TypeScript typing via raw JSON payloads.
    const safeUpdates = { ...(updates as Record<string, unknown>) };
    delete safeUpdates.organizationId;
    delete safeUpdates.id;
    delete safeUpdates.createdAt;
    delete safeUpdates.detectedAt;
    delete safeUpdates.startedAt;
    delete safeUpdates.updatedAt;

    const updated = {
      ...existing,
      ...safeUpdates,
      ...("updatedAt" in existing ? { updatedAt: new Date().toISOString() } : {}),
    } as T;

    this.store.set(id, updated);
    return updated;
  }

  public async delete(id: string, ctx: TenantContext, resourceName: string = this.collectionName): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    return this.store.delete(id);
  }

  public async search(ctx: TenantContext, predicate: (item: T) => boolean): Promise<T[]> {
    const tenantItems = Array.from(this.store.values()).filter(
      (item) => item.organizationId === ctx.organizationId
    );
    return tenantItems.filter(predicate).slice(0, MAX_PAGE_SIZE);
  }
}
