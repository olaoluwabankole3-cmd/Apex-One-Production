/**
 * APEX ONE — Customer Domain Service with Defense-in-Depth Tenant Isolation
 */

import { db, DatabaseStore } from "../../database/store";
import { CustomerRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";
import { Validator } from "../../core/validation";

export interface CreateCustomerDto {
  name: string;
  subsidiary?: string;
  tier?: "Enterprise" | "Mid-Market" | "SMB";
  status?: "active" | "at-risk" | "onboarding" | "dormant";
  healthScore?: number;
  arr?: number;
  owner?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail: string;
  tags?: string[];
}

export interface UpdateCustomerDto {
  name?: string;
  subsidiary?: string;
  tier?: "Enterprise" | "Mid-Market" | "SMB";
  status?: "active" | "at-risk" | "onboarding" | "dormant";
  healthScore?: number;
  arr?: number;
  owner?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  tags?: string[];
}

export class CustomerService {
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * List all customers belonging STRICTLY to the authenticated tenant.
   */
  public async getCustomers(
    ctx: TenantContext,
    filters?: { tier?: "Enterprise" | "Mid-Market" | "SMB" | "all" | string; status?: "active" | "at-risk" | "onboarding" | "dormant" | "all" | string; search?: string; limit?: number; offset?: number }
  ): Promise<CustomerRecord[]> {
    requirePermission(ctx, "customer:read");

    return this.database.customersRepo.findMany(ctx, {
      filter: {
        tier: filters?.tier as any,
        status: filters?.status as any,
        search: filters?.search,
      },
      limit: filters?.limit,
      offset: filters?.offset,
    });
  }

  /**
   * Fetch a single customer by ID, rigorously verifying tenant ownership via repository.
   */
  public async getCustomerById(id: string, ctx: TenantContext): Promise<CustomerRecord> {
    requirePermission(ctx, "customer:read");
    Validator.requireId(id, "customerId");
    return this.database.customersRepo.findById(id, ctx, "Customer");
  }

  /**
   * Create a new customer anchored irrevocably to the authenticated tenant.
   */
  public async createCustomer(dto: CreateCustomerDto, ctx: TenantContext): Promise<CustomerRecord> {
    requirePermission(ctx, "customer:write");

    const validatedName = Validator.requireString(dto.name, "name", { minLength: 2, maxLength: 120 });
    const validatedEmail = Validator.requireEmail(dto.contactEmail, "contactEmail");
    const validatedTier = Validator.optionalEnum(dto.tier, ["Enterprise", "Mid-Market", "SMB"] as const, "tier") || "Enterprise";
    const validatedStatus = Validator.optionalEnum(dto.status, ["active", "at-risk", "onboarding", "dormant"] as const, "status") || "active";
    const validatedArr = Validator.optionalNumber(dto.arr, "arr", { min: 0 }) || 0;
    const validatedHealth = Validator.optionalNumber(dto.healthScore, "healthScore", { min: 0, max: 100 }) ?? 85;

    const id = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const recordData: Omit<CustomerRecord, "organizationId"> = {
      id,
      name: validatedName,
      subsidiary: dto.subsidiary?.trim() || "General Operations",
      tier: validatedTier,
      status: validatedStatus,
      healthScore: validatedHealth,
      arr: validatedArr,
      owner: dto.owner?.trim() || ctx.userEmail,
      contactName: dto.contactName?.trim() || "Primary Contact",
      contactRole: dto.contactRole?.trim() || "Account Lead",
      contactEmail: validatedEmail,
      since: "Aug 2026",
      tags: dto.tags || ["New Account"],
      createdAt: now,
      updatedAt: now,
    };

    return this.database.runInTransaction(ctx, async (uow) => {
      const record = await uow.customers.create(recordData, uow.context);

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "customer:create",
        resource: "Customer",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { customerName: validatedName, arr: validatedArr },
        timestamp: now,
      });

      return record;
    });
  }

  /**
   * Update an existing customer with tenant isolation and audit trail.
   */
  public async updateCustomer(
    id: string,
    updates: UpdateCustomerDto,
    ctx: TenantContext
  ): Promise<CustomerRecord> {
    requirePermission(ctx, "customer:write");
    Validator.requireId(id, "customerId");

    const validatedUpdates: Partial<CustomerRecord> = {};
    if (updates.name !== undefined) {
      validatedUpdates.name = Validator.requireString(updates.name, "name", { minLength: 2, maxLength: 120 });
    }
    if (updates.contactEmail !== undefined) {
      validatedUpdates.contactEmail = Validator.requireEmail(updates.contactEmail, "contactEmail");
    }
    if (updates.tier !== undefined) {
      validatedUpdates.tier = Validator.requireEnum(updates.tier, ["Enterprise", "Mid-Market", "SMB"] as const, "tier");
    }
    if (updates.status !== undefined) {
      validatedUpdates.status = Validator.requireEnum(updates.status, ["active", "at-risk", "onboarding", "dormant"] as const, "status");
    }
    if (updates.arr !== undefined) {
      validatedUpdates.arr = Validator.requireNumber(updates.arr, "arr", { min: 0 });
    }
    if (updates.healthScore !== undefined) {
      validatedUpdates.healthScore = Validator.requireNumber(updates.healthScore, "healthScore", { min: 0, max: 100 });
    }
    if (updates.subsidiary !== undefined) validatedUpdates.subsidiary = updates.subsidiary.trim();
    if (updates.owner !== undefined) validatedUpdates.owner = updates.owner.trim();
    if (updates.contactName !== undefined) validatedUpdates.contactName = updates.contactName.trim();
    if (updates.contactRole !== undefined) validatedUpdates.contactRole = updates.contactRole.trim();
    if (updates.tags !== undefined) validatedUpdates.tags = updates.tags;

    return this.database.runInTransaction(ctx, async (uow) => {
      const updated = await uow.customers.update(id, validatedUpdates, uow.context, "Customer");

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "customer:update",
        resource: "Customer",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { modifiedFields: Object.keys(validatedUpdates) },
        timestamp: new Date().toISOString(),
      });

      return updated;
    });
  }

  /**
   * Delete a customer.
   */
  public async deleteCustomer(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "customer:delete");
    Validator.requireId(id, "customerId");

    return this.database.runInTransaction(ctx, async (uow) => {
      const deleted = await uow.customers.delete(id, uow.context, "Customer");

      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "customer:delete",
        resource: "Customer",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });

      return deleted;
    });
  }
}

export const customerService = new CustomerService();
