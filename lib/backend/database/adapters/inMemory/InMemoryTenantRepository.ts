/**
 * APEX ONE — Temporary In-Memory Repository Adapter
 *
 * Stage 3 repository contract implementation:
 * - tenant scope is always derived from TenantContext
 * - collection reads use QuerySpecification<T>
 * - collection reads return PaginatedResult<T>
 * - findOne/count are explicit primitives
 * - cursor pagination is tenant-bound and deterministic
 */

import {
  TenantContext,
  NotFoundError,
  CrossTenantViolationError,
} from "../../../core/errors";
import type {
  ITenantScopedRepository,
  PaginatedResult,
  QuerySpecification,
} from "../../repository";
import {
  applyQuerySpecificationPaginated,
  matchesSpecification,
} from "../../querySpecification";
import {
  assertNoImmutableFieldMutation,
  IMMUTABLE_PERSISTENCE_FIELDS,
  throwUniquenessConflict,
} from "../../repositoryIntegrity";

export class InMemoryTenantRepository<
  T extends { id: string; organizationId: string },
  TUpdate = Partial<Omit<T, "id" | "organizationId" | "createdAt">>
> implements ITenantScopedRepository<T, TUpdate> {
  constructor(
    protected readonly collectionName: string,
    protected readonly store: Map<string, T>,
    private readonly onAuditViolation?: (
      ctx: TenantContext,
      resourceId: string,
      attemptedOrg: string
    ) => void
  ) {}

  public async findById(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<T> {
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

  protected tenantItems(ctx: TenantContext): T[] {
    return Array.from(this.store.values()).filter(
      (item) => item.organizationId === ctx.organizationId
    );
  }

  public async findMany(
    ctx: TenantContext,
    query?: QuerySpecification<T>
  ): Promise<PaginatedResult<T>> {
    return applyQuerySpecificationPaginated(
      this.tenantItems(ctx),
      query,
      ctx.organizationId,
      this.collectionName
    );
  }

  public async findOne(
    ctx: TenantContext,
    query?: QuerySpecification<T>
  ): Promise<T | undefined> {
    const result = await this.findMany(ctx, {
      ...(query || {}),
      limit: 1,
      cursor: null,
    });
    return result.items[0];
  }

  public async count(
    ctx: TenantContext,
    query?: QuerySpecification<T>
  ): Promise<number> {
    const nonPaginatedSpec = query
      ? {
          where: query.where,
          search: query.search,
        }
      : undefined;

    return this.tenantItems(ctx).filter((item) =>
      matchesSpecification(item, nonPaginatedSpec)
    ).length;
  }

  public async create(
    data: Omit<T, "organizationId">,
    ctx: TenantContext
  ): Promise<T> {
    const id =
      (data as any).id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    if (this.store.has(id)) {
      throwUniquenessConflict(this.collectionName, `${this.collectionName}:id`);
    }

    const item = {
      ...data,
      id,
      organizationId: ctx.organizationId,
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
    const safeUpdates = { ...(updates as Record<string, unknown>) };

    assertNoImmutableFieldMutation(safeUpdates, resourceName);
    for (const field of IMMUTABLE_PERSISTENCE_FIELDS) delete safeUpdates[field];

    const updated = {
      ...existing,
      ...safeUpdates,
      ...("updatedAt" in existing
        ? { updatedAt: new Date().toISOString() }
        : {}),
    } as T;

    this.store.set(id, updated);
    return updated;
  }

  public async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    return this.store.delete(id);
  }
}
