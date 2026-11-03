/**
 * CORTEX — restricted cross-department task operations, first production slice.
 *
 * A task is a request for work, NOT a case ownership transfer or a grant of
 * parent-case visibility. It cannot verify financial outcomes or move funds.
 * Current pilot supports named Finance ↔ Operations task recipients only.
 */
import { randomUUID } from "node:crypto";
import type { BankingWorkTaskRecord, BankingCaseRecord } from "../../database/schema";
import { DatabaseStore } from "../../database/store";
import type { PaginatedResult } from "../../database/querySpecification";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { getPermissionsForRole, type TenantContext } from "../../core/security";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { Validator } from "../../core/validation";
import { BankingCaseService, verifyCurrentAccess } from "../banking-cases/bankingCaseService";

const MAX_CASE_TASKS = 25;
const MAX_REVISION = 1_000_000_000;
const MAX_PAGE = 50;

type TaskStatus = BankingWorkTaskRecord["status"];
type AssigneeDepartment = BankingWorkTaskRecord["targetDepartment"];

export interface RequestBankingTaskInput {
  caseId: string;
  recipientUserId?: string;
  /** An explicitly department-shared request has no initial named recipient. */
  deliveryMode?: "named" | "department";
  targetDepartment?: AssigneeDepartment;
  title: string;
  question: string;
  expectedResponse: string;
  /** Optional canonical UTC target, five minutes to thirty days ahead. */
  dueAt?: string;
  expectedCaseRevision: number;
}
export interface TransitionBankingTaskInput {
  expectedRevision: number;
  note?: string;
}
export interface ListBankingTaskOptions {
  limit?: number;
  cursor?: string | null;
}

function requireRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_REVISION) {
    throw new ValidationError("expectedRevision must be a positive integer");
  }
  return value;
}

function validateDueAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new ValidationError("dueAt must be a canonical UTC timestamp");
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) {
    throw new ValidationError("dueAt must be a valid UTC timestamp");
  }
  const lead = millis - Date.now();
  if (lead < 5 * 60 * 1000 || lead > 30 * 24 * 60 * 60 * 1000) {
    throw new ValidationError("dueAt must be between 5 minutes and 30 days in the future");
  }
  return value;
}

function recipientDepartment(role: string): AssigneeDepartment | null {
  return role === "Finance" || role === "Operations" ? role : null;
}

function assertCaseOpenForRequests(record: BankingCaseRecord): void {
  if (record.status !== "open" || record.decision?.state === "pending") {
    throw new ConflictError("Case is not available for a new departmental request");
  }
}

export class BankingWorkTaskService {
  private readonly caseService: BankingCaseService;
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {
    this.caseService = new BankingCaseService(database);
  }

  /**
   * Request a scoped question from a named colleague in another department.
   * Do not copy the confidential parent case description into the task.
   * This does NOT change the existing case owner or grant case access.
   */
  async request(ctx: TenantContext, input: RequestBankingTaskInput): Promise<BankingWorkTaskRecord> {
    const caseId = Validator.requireId(input.caseId, "caseId");
    const deliveryMode = input.deliveryMode ?? "named";
    if (deliveryMode !== "named" && deliveryMode !== "department") {
      throw new ValidationError("Unknown task delivery mode");
    }
    if (deliveryMode === "department" && input.recipientUserId !== undefined) {
      throw new ValidationError("Department queue requests must not name a recipient");
    }
    if (deliveryMode === "named" && input.targetDepartment !== undefined) {
      throw new ValidationError("Named requests derive their department from the recipient");
    }
    const recipientUserId = deliveryMode === "named"
      ? Validator.requireId(input.recipientUserId, "recipientUserId") : "";
    const targetDepartment = deliveryMode === "department"
      ? Validator.requireEnum(input.targetDepartment, ["Operations", "Finance"] as const, "targetDepartment")
      : undefined;
    const title = Validator.requireString(input.title, "title", { minLength: 8, maxLength: 120 });
    const question = Validator.requireString(input.question, "question", { minLength: 15, maxLength: 600 });
    const expectedResponse = Validator.requireString(input.expectedResponse, "expectedResponse", { minLength: 15, maxLength: 300 });
    const expectedCaseRevision = requireRevision(input.expectedCaseRevision);
    const dueAt = validateDueAt(input.dueAt);

    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:assign");
      const parent = await this.caseService.findById(ctx, caseId);
      if (!isAdministrator && parent.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
      assertCaseOpenForRequests(parent);
      if ((parent.revision ?? 1) !== expectedCaseRevision) {
        throw new ConflictError("Case changed; refresh before requesting a task");
      }
      if (deliveryMode === "named" && recipientUserId === ctx.userId) {
        throw new ValidationError("A cross-department task must be assigned to a different employee");
      }

      // A department queue is an *explicit opt-in* distribution of just the
      // task question, NOT the parent case, its documents or transaction details.
      // Current pilot permits only Operations <-> Finance, and fails closed if
      // the destination has no eligible active institutional team member.
      let department: AssigneeDepartment;
      if (deliveryMode === "department") {
        if (!targetDepartment || targetDepartment === parent.department) {
          throw new ValidationError("Choose a different eligible task department");
        }
        const memberships = await this.database.findMembershipsForOrganization(ctx.organizationId);
        let eligible = false;
        for (const member of memberships) {
          if (member.organizationId !== ctx.organizationId ||
              recipientDepartment(member.role) !== targetDepartment ||
              (member.department && member.department !== targetDepartment) ||
              !getPermissionsForRole(member.role).includes("case:read")) continue;
          const colleague = await this.database.findUserById(member.userId);
          if (colleague?.status === "active") { eligible = true; break; }
        }
        if (!eligible) throw new NotFoundError("Eligible departmental task queue");
        department = targetDepartment;
      } else {
        // Resolve named-recipient eligibility inside the same tenant transaction.
        // Never reveal cross-tenant membership or disabled account existence.
        const membership = await this.database.findUserMembership(recipientUserId, ctx.organizationId);
        const recipient = await this.database.findUserById(recipientUserId);
        const permittedDepartment = membership ? recipientDepartment(membership.role) : null;
        if (!membership || membership.organizationId !== ctx.organizationId ||
            !recipient || recipient.status !== "active" || !permittedDepartment ||
            permittedDepartment === parent.department ||
            (membership.department && membership.department !== permittedDepartment) ||
            !getPermissionsForRole(membership.role).includes("case:read")) {
          throw new NotFoundError("Eligible departmental task recipient");
        }
        department = permittedDepartment;
      }
      const prior = await this.database.bankingWorkTasksRepo.findMany(ctx, {
        where: { caseId: { eq: caseId } }, limit: MAX_CASE_TASKS + 1,
      });
      if (prior.items.length >= MAX_CASE_TASKS) {
        throw new ConflictError("Case task capacity reached; resolve existing requests before adding more");
      }

      const now = new Date().toISOString();
      const task = await this.database.bankingWorkTasksRepo.create({
        id: randomUUID(), caseId,
        requestedByUserId: ctx.userId, recipientUserId,
        targetDepartment: department,
        ...(deliveryMode === "department" ? { deliveryMode: "department" as const } : {}),
        title, question, expectedResponse,
        ...(dueAt ? { dueAt } : {}),
        status: "requested", revision: 1,
        requestedAt: now, createdAt: now, updatedAt: now,
        financialOutcomeVerified: false,
      }, ctx);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: "banking_task:requested", resource: "BankingWorkTask",
        resourceId: task.id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { caseId, recipientUserId, targetDepartment: department,
          deliveryMode, departmentShared: deliveryMode === "department",
          caseOwnerUnchanged: true, financialOutcomeVerified: false,
          ...(dueAt ? { dueAt } : {}) },
      });
      return task;
    });
  }

  /**
   * A task inbox is *not* a case inbox. Its results are limited to tasks
   * explicitly assigned to/requested by the currently authenticated member.
   */
  async listMine(
    ctx: TenantContext, view: "received" | "requested" | "team",
    options: ListBankingTaskOptions = {}
  ): Promise<PaginatedResult<BankingWorkTaskRecord>> {
    await verifyCurrentAccess(ctx, this.database, "case:read");
    if (view !== "received" && view !== "requested" && view !== "team") {
      throw new ValidationError("Invalid task inbox view");
    }
    if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 ||
        options.limit > MAX_PAGE)) throw new ValidationError("Invalid task inbox page size");
    if (view === "team") {
      const department = recipientDepartment(ctx.userRole);
      const membership = await this.database.findUserMembership(ctx.userId, ctx.organizationId);
      if (!department || !membership ||
          (membership.department && membership.department !== department)) {
        throw new ForbiddenError("A current Operations or Finance team membership is required");
      }
      return this.database.bankingWorkTasksRepo.findMany(ctx, {
        where: {
          targetDepartment: { eq: department },
          deliveryMode: { eq: "department" },
          recipientUserId: { eq: "" },
          status: { eq: "requested" },
        },
        limit: options.limit ?? 25, cursor: options.cursor,
      });
    }
    const field = view === "received" ? "recipientUserId" : "requestedByUserId";
    return this.database.bankingWorkTasksRepo.findMany(ctx, {
      where: { [field]: { eq: ctx.userId } },
      limit: options.limit ?? 25, cursor: options.cursor,
    });
  }

  async listForCase(
    ctx: TenantContext, caseId: string,
    options: ListBankingTaskOptions = {}
  ): Promise<PaginatedResult<BankingWorkTaskRecord>> {
    // Parent-case access remains strictly owner/administrator-only.
    const parent = await this.caseService.findById(ctx, Validator.requireId(caseId, "caseId"));
    if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 ||
        options.limit > MAX_PAGE)) throw new ValidationError("Invalid task page size");
    return this.database.bankingWorkTasksRepo.findMany(ctx, {
      where: { caseId: { eq: parent.id } },
      limit: options.limit ?? 25, cursor: options.cursor,
    });
  }

  private async transition(
    ctx: TenantContext, taskId: string,
    from: TaskStatus, to: TaskStatus,
    input: TransitionBankingTaskInput
  ): Promise<BankingWorkTaskRecord> {
    const id = Validator.requireId(taskId, "taskId");
    const expectedRevision = requireRevision(input.expectedRevision);
    const note = to === "responded" || to === "declined"
      ? Validator.requireString(input.note, "response note", { minLength: 15, maxLength: 600 })
      : undefined;

    return this.database.runInTransaction(ctx, async () => {
      await verifyCurrentAccess(ctx, this.database, "case:read");
      const task = await this.database.bankingWorkTasksRepo.findById(id, ctx, "BankingWorkTask");
      // Explicit team-queue claims can be accepted by ANY *currently active*
      // member of that department, but exactly one claim may commit. Named
      // tasks remain private to their specifically designated recipient.
      const department = recipientDepartment(ctx.userRole);
      const isTeamClaim = to === "accepted" &&
        task.deliveryMode === "department" && task.recipientUserId === "";
      const membership = await this.database.findUserMembership(ctx.userId, ctx.organizationId);
      if (!department || task.targetDepartment !== department || !membership ||
          (membership.department && membership.department !== department)) {
        throw new NotFoundError("BankingWorkTask");
      }
      // Team members previously eligible to claim this request receive a
      // generic conflict after another member succeeds, with NO task details.
      // Other departments and named-task strangers still receive 404.
      if (to === "accepted" && task.deliveryMode === "department" &&
          task.recipientUserId !== "") {
        throw new ConflictError("Department request already claimed; refresh the team queue");
      }
      if (!isTeamClaim && task.recipientUserId !== ctx.userId) {
        throw new NotFoundError("BankingWorkTask");
      }
      if (task.revision !== expectedRevision || task.status !== from) {
        throw new ConflictError("Task changed or cannot make this transition; refresh your inbox");
      }
      const now = new Date().toISOString();
      const changes = {
        status: to, revision: expectedRevision + 1,
        ...(to === "accepted" ? { acceptedAt: now } : {}),
        ...(to === "responded" ? { respondedAt: now, responseNote: note! } : {}),
        ...(to === "declined" ? { declinedAt: now, responseNote: note! } : {}),
      };
      const updated = isTeamClaim
        ? await this.database.claimUnassignedBankingTask(ctx, id, department, expectedRevision, now)
        : await this.database.bankingWorkTasksRepo.update(id, changes, ctx, "BankingWorkTask");
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: `banking_task:${to}`, resource: "BankingWorkTask",
        resourceId: id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { caseId: task.caseId, from, to, recipientUserId: ctx.userId,
          caseOwnerUnchanged: true, financialOutcomeVerified: false,
          claimedFromTeamQueue: isTeamClaim,
          revision: expectedRevision + 1 },
      });
      return updated;
    });
  }

  accept(ctx: TenantContext, taskId: string, expectedRevision: number): Promise<BankingWorkTaskRecord> {
    return this.transition(ctx, taskId, "requested", "accepted", { expectedRevision });
  }
  respond(ctx: TenantContext, taskId: string, input: TransitionBankingTaskInput): Promise<BankingWorkTaskRecord> {
    return this.transition(ctx, taskId, "accepted", "responded", input);
  }
  decline(ctx: TenantContext, taskId: string, input: TransitionBankingTaskInput): Promise<BankingWorkTaskRecord> {
    return this.transition(ctx, taskId, "requested", "declined", input);
  }
}

export const bankingWorkTaskService = new BankingWorkTaskService();
