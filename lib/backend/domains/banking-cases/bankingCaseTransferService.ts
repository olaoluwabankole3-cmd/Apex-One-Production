/**
 * CORTEX — recipient-accepted ownership transfers.
 *
 * Task work is independent. This flow moves responsibility for the ENTIRE
 * confidential case, but only after an explicitly named eligible employee
 * agrees. Until then the original owner retains full accountability.
 *
 * The first pilot supports Operations ↔ Finance only. No bank outcome,
 * payment, settlement, remediation or independent evidence is verified here.
 */
import { randomUUID } from "node:crypto";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { DatabaseStore } from "../../database/store";
import type { BankingCaseRecord, BankingCaseTransferInvitation } from "../../database/schema";
import type { TenantContext } from "../../core/security";
import { getPermissionsForRole } from "../../core/security";
import { ConflictError, CrossTenantViolationError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { Validator } from "../../core/validation";
import { verifyCurrentAccess } from "./bankingCaseService";

interface OfferInput {
  recipientUserId: string;
  reason: string;
  expectedRevision: number;
}
interface TransitionInput {
  transferId: string;
  expectedRevision: number;
  note?: string;
}
export type { BankingCaseTransferInvitation };

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
    throw new ValidationError("expectedRevision must be a positive integer");
  }
  return value;
}
function departmentForRole(role: string): BankingCaseRecord["department"] | null {
  return role === "Finance" || role === "Operations" ? role : null;
}
function ensureOpen(record: BankingCaseRecord, expectedRevision: number): void {
  if (record.status !== "open" || record.decision?.state === "pending") {
    throw new ConflictError("Cannot transfer an unavailable case or one awaiting independent review");
  }
  if ((record.revision ?? 1) !== expectedRevision) {
    throw new ConflictError("Case changed; refresh transfer invitation before continuing");
  }
  if ((record.timeline?.length ?? 0) >= 100) {
    throw new ConflictError("Case timeline full; archive before recording further transfers");
  }
}
function event(
  kind: "transfer_requested" | "transfer_declined" | "transfer_cancelled" | "handed_off",
  actor: string, stamp: string, nextRevision: number, note: string
): NonNullable<BankingCaseRecord["timeline"]>[number] {
  return { id: randomUUID(), type: kind, actorUserId: actor,
    occurredAt: stamp, revision: nextRevision, note };
}

export class BankingCaseTransferService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  /** Do not copy private case details or freeform reason into the offer inbox. */
  async listMine(ctx: TenantContext): Promise<{ items: BankingCaseTransferInvitation[]; hasMore: boolean }> {
    await verifyCurrentAccess(ctx, this.database, "case:read");
    const department = departmentForRole(ctx.userRole);
    const membership = await this.database.findUserMembership(ctx.userId, ctx.organizationId);
    if (!department || (membership?.department && membership.department !== department)) {
      return { items: [], hasMore: false };
    }
    const result = await this.database.listPendingCaseTransferInvitations(ctx);
    return { items: result.items.filter(item => item.targetDepartment === department), hasMore: result.hasMore };
  }

  async offer(ctx: TenantContext, caseId: string, input: OfferInput): Promise<BankingCaseRecord> {
    const id = Validator.requireId(caseId, "caseId");
    const recipientId = Validator.requireId(input.recipientUserId, "recipientUserId");
    const reason = Validator.requireString(input.reason, "reason", { minLength: 10, maxLength: 500 });
    const expected = revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:assign");
      let existing: BankingCaseRecord;
      try {
        existing = await this.database.bankingCasesRepo.findById(id, ctx, "BankingCase");
      } catch (error) {
        if (error instanceof CrossTenantViolationError) throw new NotFoundError("BankingCase");
        throw error;
      }
      if (!isAdministrator && existing.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
      ensureOpen(existing, expected);
      if (existing.pendingTransfer) throw new ConflictError("Another ownership transfer is awaiting the receiver");
      if (recipientId === existing.ownerUserId) {
        throw new ValidationError("Current case owner cannot receive their own transfer");
      }
      const membership = await this.database.findUserMembership(recipientId, ctx.organizationId);
      const recipient = await this.database.findUserById(recipientId);
      const department = membership ? departmentForRole(membership.role) : null;
      if (!membership || membership.organizationId !== ctx.organizationId ||
          !recipient || recipient.status !== "active" || !department ||
          department === existing.department ||
          (membership.department && membership.department !== department) ||
          !getPermissionsForRole(membership.role).includes("case:read") ||
          !getPermissionsForRole(membership.role).includes("case:assign")) {
        throw new NotFoundError("Eligible receiving employee");
      }
      const now = new Date().toISOString();
      const invitation = {
        id: randomUUID(), requestedByUserId: ctx.userId,
        recipientUserId: recipientId, fromDepartment: existing.department,
        targetDepartment: department, requestedAt: now, reason,
      };
      const updated = await this.database.commitBankingCaseTransfer(ctx, existing, "offer", {
        pendingTransfer: invitation,
        revision: expected + 1,
        timeline: [...(existing.timeline ?? []), event("transfer_requested", ctx.userId,
          now, expected + 1, "Ownership transfer requested; current owner remains accountable")],
      });
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: "banking_case:transfer_requested", resource: "BankingCase",
        resourceId: id, requestId: ctx.requestId, status: "success", timestamp: now,
        metadata: { transferId: invitation.id, fromUserId: existing.ownerUserId,
          toUserId: recipientId, fromDepartment: existing.department,
          toDepartment: department, ownerUnchanged: true, revision: updated.revision,
          financialOutcomeVerified: false },
      });
      return updated;
    });
  }

  async accept(ctx: TenantContext, caseId: string, input: TransitionInput): Promise<BankingCaseRecord> {
    const id = Validator.requireId(caseId, "caseId");
    const transferId = Validator.requireId(input.transferId, "transferId");
    const expected = revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      await verifyCurrentAccess(ctx, this.database, "case:assign");
      let existing: BankingCaseRecord;
      try { existing = await this.database.bankingCasesRepo.findById(id, ctx, "BankingCase"); }
      catch { throw new NotFoundError("Case transfer invitation"); }
      const invite = existing.pendingTransfer;
      if (!invite || invite.id !== transferId || invite.recipientUserId !== ctx.userId) {
        throw new NotFoundError("Case transfer invitation");
      }
      const membership = await this.database.findUserMembership(ctx.userId, ctx.organizationId);
      const receivingDepartment = departmentForRole(ctx.userRole);
      if (!receivingDepartment || receivingDepartment !== invite.targetDepartment ||
          !membership || membership.role !== ctx.userRole ||
          (membership.department && membership.department !== receivingDepartment)) {
        throw new NotFoundError("Case transfer invitation");
      }
      ensureOpen(existing, expected);
      const now = new Date().toISOString();
      const updated = await this.database.commitBankingCaseTransfer(ctx, existing, "accept", {
        ownerUserId: ctx.userId,
        department: receivingDepartment,
        pendingTransfer: null,
        lastHandoffAt: now,
        revision: expected + 1,
        timeline: [...(existing.timeline ?? []), event("handed_off", ctx.userId,
          now, expected + 1, "Receiving employee accepted full case ownership")],
      }, transferId);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: "banking_case:transfer_accepted", resource: "BankingCase",
        resourceId: id, requestId: ctx.requestId, status: "success", timestamp: now,
        metadata: { transferId, fromUserId: existing.ownerUserId,
          toUserId: ctx.userId, fromDepartment: existing.department,
          toDepartment: receivingDepartment, revision: updated.revision,
          financialOutcomeVerified: false },
      });
      return updated;
    });
  }

  async decline(ctx: TenantContext, caseId: string, input: TransitionInput):
    Promise<{ caseId: string; transferId: string; status: "declined"; ownerUnchanged: true }> {
    const id = Validator.requireId(caseId, "caseId");
    const transferId = Validator.requireId(input.transferId, "transferId");
    const expected = revision(input.expectedRevision);
    const note = Validator.requireString(input.note, "decline reason", { minLength: 15, maxLength: 400 });
    return this.database.runInTransaction(ctx, async () => {
      await verifyCurrentAccess(ctx, this.database, "case:read");
      let existing: BankingCaseRecord;
      try { existing = await this.database.bankingCasesRepo.findById(id, ctx, "BankingCase"); }
      catch { throw new NotFoundError("Case transfer invitation"); }
      const invite = existing.pendingTransfer;
      if (!invite || invite.id !== transferId || invite.recipientUserId !== ctx.userId ||
          invite.targetDepartment !== departmentForRole(ctx.userRole)) {
        throw new NotFoundError("Case transfer invitation");
      }
      ensureOpen(existing, expected);
      const now = new Date().toISOString();
      await this.database.commitBankingCaseTransfer(ctx, existing, "decline", {
        pendingTransfer: null, revision: expected + 1,
        timeline: [...(existing.timeline ?? []), event("transfer_declined",
          ctx.userId, now, expected + 1, "Recipient declined ownership; sender remains accountable")],
      }, transferId);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: "banking_case:transfer_declined", resource: "BankingCase",
        resourceId: id, requestId: ctx.requestId, status: "success", timestamp: now,
        metadata: { transferId, ownerUnchanged: true,
          declinedByUserId: ctx.userId, declineReason: note, revision: expected + 1,
          financialOutcomeVerified: false },
      });
      // Recipient still cannot read the private case; return only a receipt.
      return { caseId: id, transferId, status: "declined", ownerUnchanged: true };
    });
  }

  async cancel(ctx: TenantContext, caseId: string, input: TransitionInput): Promise<BankingCaseRecord> {
    const id = Validator.requireId(caseId, "caseId");
    const transferId = Validator.requireId(input.transferId, "transferId");
    const expected = revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:assign");
      const existing = await this.database.bankingCasesRepo.findById(id, ctx, "BankingCase");
      if (!isAdministrator && existing.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
      if (!existing.pendingTransfer || existing.pendingTransfer.id !== transferId) {
        throw new ConflictError("Transfer no longer pending");
      }
      ensureOpen(existing, expected);
      const now = new Date().toISOString();
      const updated = await this.database.commitBankingCaseTransfer(ctx, existing, "cancel", {
        pendingTransfer: null, revision: expected + 1,
        timeline: [...(existing.timeline ?? []), event("transfer_cancelled",
          ctx.userId, now, expected + 1, "Sender withdrew the ownership offer")],
      }, transferId);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId, actorEmail: ctx.userEmail,
        action: "banking_case:transfer_cancelled", resource: "BankingCase",
        resourceId: id, requestId: ctx.requestId, status: "success", timestamp: now,
        metadata: { transferId, ownerUnchanged: true,
          revision: updated.revision, financialOutcomeVerified: false },
      });
      return updated;
    });
  }
}

export const bankingCaseTransferService = new BankingCaseTransferService();
