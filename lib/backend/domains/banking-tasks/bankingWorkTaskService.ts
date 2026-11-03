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
  recipientUserId: string;
  title: string;
  question: string;
  expectedResponse: string;
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
    const recipientUserId = Validator.requireId(input.recipientUserId, "recipientUserId");
    const title = Validator.requireString(input.title, "title", { minLength: 8, maxLength: 120 });
    const question = Validator.requireString(input.question, "question", { minLength: 15, maxLength: 600 });
    const expectedResponse = Validator.requireString(input.expectedResponse, "expectedResponse", { minLength: 15, maxLength: 300 });
    const expectedCaseRevision = requireRevision(input.expectedCaseRevision);

    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:assign");
      const parent = await this.caseService.findById(ctx, caseId);
      if (!isAdministrator && parent.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
      assertCaseOpenForRequests(parent);
      if ((parent.revision ?? 1) !== expectedCaseRevision) {
        throw new ConflictError("Case changed; refresh before requesting a task");
      }
      if (recipientUserId === ctx.userId) {
        throw new ValidationError("A cross-department task must be assigned to a different employee");
      }

      // Resolve eligibility inside the same tenant transaction. Never reveal a
      // target user's actual organization or active status on failure.
      const membership = await this.database.findUserMembership(recipientUserId, ctx.organizationId);
      const recipient = await this.database.findUserById(recipientUserId);
      const department = membership ? recipientDepartment(membership.role) : null;
      if (!membership || membership.organizationId !== ctx.organizationId ||
          !recipient || recipient.status !== "active" || !department ||
          department === parent.department ||
          (membership.department && membership.department !== department) ||
          !getPermissionsForRole(membership.role).includes("case:read")) {
        throw new NotFoundError("Eligible departmental task recipient");
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
        title, question, expectedResponse,
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
          caseOwnerUnchanged: true, financialOutcomeVerified: false },
      });
      return task;
    });
  }

  /**
   * A task inbox is *not* a case inbox. Its results are limited to tasks
   * explicitly assigned to/requested by the currently authenticated member.
   */
  async listMine(
    ctx: TenantContext, view: "received" | "requested",
    options: ListBankingTaskOptions = {}
  ): Promise<PaginatedResult<BankingWorkTaskRecord>> {
    await verifyCurrentAccess(ctx, this.database, "case:read");
    if (view !== "received" && view !== "requested") throw new ValidationError("Invalid task inbox view");
    if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 ||
        options.limit > MAX_PAGE)) throw new ValidationError("Invalid task inbox page size");
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
      // A known but unassigned task must remain indistinguishable from an
      // unknown task. Assignment does not grant access to the parent case.
      if (task.recipientUserId !== ctx.userId ||
          task.targetDepartment !== recipientDepartment(ctx.userRole)) {
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
      const updated = await this.database.bankingWorkTasksRepo.update(id, changes, ctx, "BankingWorkTask");
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: `banking_task:${to}`, resource: "BankingWorkTask",
        resourceId: id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { caseId: task.caseId, from, to, recipientUserId: ctx.userId,
          caseOwnerUnchanged: true, financialOutcomeVerified: false,
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
