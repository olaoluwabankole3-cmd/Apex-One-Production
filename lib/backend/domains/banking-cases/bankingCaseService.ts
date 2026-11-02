/**
 * First production-backed CORTEX financial-operations case intake.
 *
 * Intentional boundary: create, list and read an open, UNVERIFIED case.
 * Assignment, approval, disposition, money movement and value verification are
 * NOT implemented here. Future transitions require a separate audited engine.
 */
import { randomUUID } from "node:crypto";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { DatabaseStore } from "../../database/store";
import type { BankingCaseRecord } from "../../database/schema";
import type { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, getPermissionsForRole, requirePermission } from "../../core/security";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { Validator } from "../../core/validation";

export interface CreateBankingCaseInput {
  title: string;
  description: string;
  department: BankingCaseRecord["department"];
  priority?: BankingCaseRecord["priority"];
  sourceType?: BankingCaseRecord["sourceType"];
  sourceId?: string;
}

export interface BankingCaseListOptions {
  limit?: number;
  cursor?: string | null;
}

/**
 * Session permission AND currently persisted membership/active status must
 * agree. Demotions and disabled accounts fail closed even with stale cookies.
 */
async function verifyCurrentAccess(
  ctx: TenantContext,
  database: DatabaseStore,
  capability: "workflow:read" | "workflow:write"
): Promise<{ isAdministrator: boolean }> {
  requirePermission(ctx, capability);
  const [membership, user] = await Promise.all([
    database.findUserMembership(ctx.userId, ctx.organizationId),
    database.findUserById(ctx.userId),
  ]);
  if (!membership || !user || user.status !== "active" ||
      membership.role !== ctx.userRole ||
      !getPermissionsForRole(membership.role).includes(capability)) {
    throw new ForbiddenError("Current institutional membership does not permit case access");
  }
  return {
    isAdministrator: ctx.permissions.includes("org:admin") &&
      getPermissionsForRole(membership.role).includes("org:admin"),
  };
}

export class BankingCaseService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  public async create(ctx: TenantContext, input: CreateBankingCaseInput): Promise<BankingCaseRecord> {
    await verifyCurrentAccess(ctx, this.database, "workflow:write");
    const title = Validator.requireString(input.title, "title", { minLength: 8, maxLength: 160 });
    const description = Validator.requireString(input.description, "description", { minLength: 10, maxLength: 1200 });
    const department = Validator.requireEnum(input.department, ["Operations", "Finance"] as const, "department");
    const priority = Validator.optionalEnum(input.priority, ["normal", "high"] as const, "priority") ?? "normal";
    if ((input.sourceType === undefined) !== (input.sourceId === undefined)) {
      throw new ValidationError("sourceType and sourceId must be supplied together");
    }

    let sourceType: BankingCaseRecord["sourceType"];
    let sourceId: string | undefined;
    if (input.sourceType !== undefined) {
      sourceType = Validator.requireEnum(input.sourceType, ["Document", "ValueOpportunity"] as const, "sourceType");
      sourceId = Validator.requireId(input.sourceId, "sourceId");
      if (sourceType === "Document") {
        requirePermission(ctx, "document:read");
      } else {
        requirePermission(ctx, "value:read");
      }
    }

    return this.database.runInTransaction(ctx, async () => {
      // Verify within the transaction as well, to resist membership revocation
      // between initial request validation and the database write.
      await verifyCurrentAccess(ctx, this.database, "workflow:write");
      if (sourceType === "Document") {
        await this.database.documentsRepo.findById(sourceId!, ctx, "Document");
      } else if (sourceType === "ValueOpportunity") {
        await this.database.opportunitiesRepo.findById(sourceId!, ctx, "ValueOpportunity");
      }
      const now = new Date().toISOString();
      const id = randomUUID();
      const record = await this.database.bankingCasesRepo.create({
        id, title, description, department, priority,
        status: "open",
        evidenceState: "unverified",
        ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
        createdByUserId: ctx.userId,
        ownerUserId: ctx.userId,
        createdAt: now,
        updatedAt: now,
      }, ctx);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "banking_case:create",
        resource: "BankingCase",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        metadata: { department, priority, evidenceState: "unverified",
          ...(sourceType && sourceId ? { sourceType, sourceId } : {}) },
        timestamp: now,
      });
      return record;
    });
  }

  public async list(ctx: TenantContext, options: BankingCaseListOptions = {}): Promise<PaginatedResult<BankingCaseRecord>> {
    const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "workflow:read");
    const query = isAdministrator
      ? { limit: options.limit, cursor: options.cursor }
      : { limit: options.limit, cursor: options.cursor, where: { ownerUserId: { eq: ctx.userId } } };
    return this.database.bankingCasesRepo.findMany(ctx, query);
  }

  public async findById(ctx: TenantContext, id: string): Promise<BankingCaseRecord> {
    const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "workflow:read");
    const record = await this.database.bankingCasesRepo.findById(Validator.requireId(id, "caseId"), ctx, "BankingCase");
    if (!isAdministrator && record.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
    return record;
  }
}

export const bankingCaseService = new BankingCaseService();
