/**
 * First production-backed CORTEX financial-operations case intake.
 *
 * Intentional boundary: create, list and read an open, UNVERIFIED case.
 * Assignment is bounded, revision-checked, membership-validated and audited.
 * Approval, disposition, money movement and value verification are NOT implemented.
 */
import { randomUUID } from "node:crypto";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { DatabaseStore } from "../../database/store";
import type { BankingCaseRecord, BankingPreviewOrigin } from "../../database/schema";
import type { PaginatedResult } from "../../database/querySpecification";
import { TenantContext, getPermissionsForRole, requirePermission } from "../../core/security";
import { ConflictError, CrossTenantViolationError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
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

export interface BankingCaseAssignee {
  userId: string;
  name: string;
  department: BankingCaseRecord["department"];
}

export interface BankingCaseAssigneeList {
  members: BankingCaseAssignee[];
  hasMore: boolean;
}

export interface HandoffBankingCaseInput {
  recipientUserId: string;
  expectedRevision: number;
  reason: string;
}

function departmentForRole(role: string): BankingCaseRecord["department"] | null {
  if (role === "Operations" || role === "Finance") return role;
  return null;
}

/**
 * Session permission AND currently persisted membership/active status must
 * agree. Demotions and disabled accounts fail closed even with stale cookies.
 */
export async function verifyCurrentAccess(
  ctx: TenantContext,
  database: DatabaseStore,
  capability: "case:read" | "case:create" | "case:assign" | "case:approve"
): Promise<{ isAdministrator: boolean }> {
  requirePermission(ctx, capability);
  // Shared PostgreSQL transactional wire connections cannot run simultaneous
  // queries. Sequential identity reads preserve fail-closed membership checks.
  const membership = await database.findUserMembership(ctx.userId, ctx.organizationId);
  const user = await database.findUserById(ctx.userId);
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

  public async create(ctx: TenantContext, input: CreateBankingCaseInput, internal?: { id: string; previewOrigin: BankingPreviewOrigin }): Promise<BankingCaseRecord> {
    await verifyCurrentAccess(ctx, this.database, "case:create");
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
      await verifyCurrentAccess(ctx, this.database, "case:create");
      try {
        if (sourceType === "Document") {
          await this.database.documentsRepo.findById(sourceId!, ctx, "Document");
        } else if (sourceType === "ValueOpportunity") {
          await this.database.opportunitiesRepo.findById(sourceId!, ctx, "ValueOpportunity");
        }
      } catch (error) {
        if (error instanceof CrossTenantViolationError) throw new NotFoundError("Source record");
        throw error;
      }
      const now = new Date().toISOString();
      const id = internal ? Validator.requireId(internal.id, "caseId") : randomUUID();
      const record = await this.database.bankingCasesRepo.create({
        id, title, description, department, priority,
        status: "open",
        evidenceState: "unverified",
        ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
        createdByUserId: ctx.userId,
        ownerUserId: ctx.userId,
        revision: 1,
        ...(internal ? { previewOrigin: internal.previewOrigin } : {}),
        timeline: [{ id: randomUUID(), type: "created", actorUserId: ctx.userId,
          occurredAt: now, revision: 1,
          note: internal ? "Metadata-only preview candidate routed for human investigation; source not retained or verified" : "Case recorded as open and unverified" }],
        evidenceLinks: [],
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
          ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
          ...(internal ? { previewBatchId: internal.previewOrigin.batchId,
            previewCandidateId: internal.previewOrigin.candidateId,
            previewOnly: true, financialLossAssessed: false } : {}) },
        timestamp: now,
      });
      return record;
    });
  }

  /**
   * A minimal, private assignment roster. Never returns credentials, personal
   * contact information, users in another tenant or staff who cannot receive work.
   * The bound prevents an unbounded organization-wide directory read.
   */
  public async listAssignees(ctx: TenantContext): Promise<BankingCaseAssigneeList> {
    await verifyCurrentAccess(ctx, this.database, "case:assign");
    const membershipRecords = await this.database.findMembershipsForOrganization(ctx.organizationId);
    const members: BankingCaseAssignee[] = [];
    for (const membership of membershipRecords.slice(0, 101)) {
      if (membership.organizationId !== ctx.organizationId) continue;
      const department = departmentForRole(membership.role);
      if (!department) continue;
      if (membership.department && membership.department !== department) continue;
      if (!getPermissionsForRole(membership.role).includes("case:read")) continue;
      const user = await this.database.findUserById(membership.userId);
      if (user?.status !== "active") continue;
      if (members.length < 100) members.push({ userId: user.id, name: user.name || "Institution staff", department });
    }
    return { members, hasMore: membershipRecords.length > 100 };
  }

  /**
   * LEGACY EMERGENCY REASSIGNMENT, available ONLY to a verified Administrator.
   * Normal employees MUST use the recipient-accepted /transfer flow.
   * The instant reassignment exists for documented institutional emergency
   * intervention; it must not bypass an outstanding receiver invitation.
   */
  public async handoff(
    ctx: TenantContext,
    caseId: string,
    input: HandoffBankingCaseInput
  ): Promise<BankingCaseRecord> {
    requirePermission(ctx, "case:assign");
    const validatedCaseId = Validator.requireId(caseId, "caseId");
    const recipientUserId = Validator.requireId(input.recipientUserId, "recipientUserId");
    const reason = Validator.requireString(input.reason, "reason", { minLength: 10, maxLength: 500 });
    if (!Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 || input.expectedRevision > 1_000_000_000) {
      throw new ValidationError("expectedRevision must be a positive integer");
    }
    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:assign");
      if (!isAdministrator) {
        throw new ForbiddenError("Direct handoff is restricted to institutional emergency administrators; request an accepted transfer");
      }
      let existing: BankingCaseRecord;
      try {
        existing = await this.database.bankingCasesRepo.findById(validatedCaseId, ctx, "BankingCase");
      } catch (error) {
        if (error instanceof CrossTenantViolationError) throw new NotFoundError("BankingCase");
        throw error;
      }
      if (!isAdministrator && existing.ownerUserId !== ctx.userId) {
        throw new NotFoundError("BankingCase");
      }
      if (existing.status !== "open") throw new ConflictError("Only open cases can be reassigned");
      if (existing.pendingTransfer) throw new ConflictError("A receiver acceptance is pending; cancel it first");
      if (existing.decision?.state === "pending") throw new ConflictError("Cannot reassign a case awaiting checker review");
      const revision = existing.revision ?? 1;
      if (revision !== input.expectedRevision) {
        throw new ConflictError("Case has changed; reload before reassigning", { retryable: false });
      }
      if (recipientUserId === existing.ownerUserId) {
        throw new ValidationError("Case is already assigned to the selected employee");
      }
      const recipientMembership = await this.database.findUserMembership(recipientUserId, ctx.organizationId);
      const recipient = await this.database.findUserById(recipientUserId);
      const department = recipientMembership ? departmentForRole(recipientMembership.role) : null;
      if (!recipientMembership || recipientMembership.organizationId !== ctx.organizationId ||
          !recipient || recipient.status !== "active" || !department ||
          (recipientMembership.department && recipientMembership.department !== department) ||
          !getPermissionsForRole(recipientMembership.role).includes("case:read")) {
        // Do not reveal whether an unknown ID belongs to a different bank.
        throw new NotFoundError("Eligible case recipient");
      }
      const now = new Date().toISOString();
      if ((existing.timeline?.length ?? 0) >= 100) {
        throw new ConflictError("Case timeline capacity reached; export and archive before more changes");
      }
      const updated = await this.database.bankingCasesRepo.update(
        existing.id, { ownerUserId: recipientUserId, department,
          revision: revision + 1, lastHandoffAt: now,
          timeline: [...(existing.timeline ?? []), {
            id: randomUUID(), type: "handed_off", actorUserId: ctx.userId,
            occurredAt: now, revision: revision + 1, note: reason,
          }] }, ctx, "BankingCase"
      );
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "banking_case:emergency_handoff",
        resource: "BankingCase",
        resourceId: existing.id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: now,
        metadata: {
          fromUserId: existing.ownerUserId, toUserId: recipientUserId,
          fromDepartment: existing.department, toDepartment: department,
          previousRevision: revision, revision: revision + 1,
          reason, emergencyAdministratorOverride: true, evidenceState: existing.evidenceState,
        },
      });
      return updated;
    });
  }

  public async list(ctx: TenantContext, options: BankingCaseListOptions = {}): Promise<PaginatedResult<BankingCaseRecord>> {
    const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:read");
    const query = isAdministrator
      ? { limit: options.limit, cursor: options.cursor }
      : { limit: options.limit, cursor: options.cursor, where: { ownerUserId: { eq: ctx.userId } } };
    return this.database.bankingCasesRepo.findMany(ctx, query);
  }

  public async findById(ctx: TenantContext, id: string): Promise<BankingCaseRecord> {
    const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:read");
    try {
      const record = await this.database.bankingCasesRepo.findById(Validator.requireId(id, "caseId"), ctx, "BankingCase");
      if (!isAdministrator && record.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
      return record;
    } catch (error) {
      if (error instanceof CrossTenantViolationError) throw new NotFoundError("BankingCase");
      throw error;
    }
  }
}

export const bankingCaseService = new BankingCaseService();
