/**
 * Banking case evidence trail and independent maker-checker control.
 * The only reviewable object is an INTERNAL INVESTIGATION PLAN. A decision
 * never verifies loss, authorizes payments or changes the source ledger.
 *
 * Case and its events are updated with transactional audit records and a
 * strict revision. PostgreSQL transaction isolation is SERIALIZABLE; the
 * in-memory adapter serializes full transactions with rollback snapshots.
 */
import { randomUUID } from "node:crypto";
import { verifyCurrentAccess } from "./bankingCaseService";
import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import type {
  BankingCaseRecord, BankingCaseDecision, BankingCaseEvidenceLink,
} from "../../database/schema";
import type { TenantContext } from "../../core/errors";
import { ConflictError, CrossTenantViolationError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { requirePermission } from "../../core/security";
import { Validator } from "../../core/validation";

const MAX_EVENTS = 100;
const MAX_LINKS = 50;
type SourceKind = BankingCaseEvidenceLink["sourceType"];

export interface LinkEvidenceInput {
  sourceType: SourceKind;
  sourceId: string;
  note: string;
  expectedRevision: number;
}

export interface ProposeDecisionInput {
  disposition: BankingCaseDecision["disposition"];
  rationale: string;
  expectedRevision: number;
}

export interface ReviewDecisionInput {
  decisionId: string;
  verdict: "approved" | "rejected";
  note: string;
  expectedRevision: number;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= 1_000_000_000) {
    throw new ValidationError("expectedRevision must be a positive integer");
  }
  return value;
}

function ensureCapacity(item: BankingCaseRecord, link = false): void {
  if ((item.timeline?.length ?? 0) >= MAX_EVENTS) {
    throw new ConflictError("Case timeline capacity reached; archive before further changes");
  }
  if (link && (item.evidenceLinks?.length ?? 0) >= MAX_LINKS) {
    throw new ConflictError("Maximum evidence references for this case reached");
  }
}

export class BankingCaseReviewService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  private async visibleCase(ctx: TenantContext, id: string): Promise<BankingCaseRecord> {
    const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:read");
    let item: BankingCaseRecord;
    try {
      item = await this.database.bankingCasesRepo.findById(Validator.requireId(id, "caseId"), ctx, "BankingCase");
    } catch (error) {
      if (error instanceof CrossTenantViolationError) throw new NotFoundError("BankingCase");
      throw error;
    }
    if (!isAdministrator && item.ownerUserId !== ctx.userId) throw new NotFoundError("BankingCase");
    return item;
  }

  private async validateSource(ctx: TenantContext, sourceType: SourceKind, id: string): Promise<void> {
    requirePermission(ctx, sourceType === "Document" ? "document:read" : "value:read");
    try {
      if (sourceType === "Document") await this.database.documentsRepo.findById(id, ctx, "Document");
      else await this.database.opportunitiesRepo.findById(id, ctx, "ValueOpportunity");
    } catch (error) {
      if (error instanceof CrossTenantViolationError) throw new NotFoundError("Evidence source");
      throw error;
    }
  }

  public async linkEvidence(ctx: TenantContext, caseId: string, input: LinkEvidenceInput): Promise<BankingCaseRecord> {
    requirePermission(ctx, "case:create");
    const sourceType = Validator.requireEnum(input.sourceType, ["Document", "ValueOpportunity"] as const, "sourceType");
    const sourceId = Validator.requireId(input.sourceId, "sourceId");
    const note = Validator.requireString(input.note, "note", { minLength: 10, maxLength: 300 });
    revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      await verifyCurrentAccess(ctx, this.database, "case:create");
      const item = await this.visibleCase(ctx, caseId);
      if ((item.revision ?? 1) !== input.expectedRevision) throw new ConflictError("Case changed; reload before linking evidence");
      if (item.status !== "open" || item.decision?.state === "pending") {
        throw new ConflictError("Cannot change evidence while an investigation plan awaits approval");
      }
      ensureCapacity(item, true);
      if ((item.evidenceLinks ?? []).some(link => link.sourceType === sourceType && link.sourceId === sourceId)) {
        throw new ConflictError("Evidence source is already linked to this case");
      }
      await this.validateSource(ctx, sourceType, sourceId);
      const now = new Date().toISOString(), id = randomUUID(), nextRevision = (item.revision ?? 1) + 1;
      const link: BankingCaseEvidenceLink = { id, sourceType, sourceId, note, addedByUserId: ctx.userId, addedAt: now };
      const updated = await this.database.bankingCasesRepo.update(item.id, {
        evidenceLinks: [...(item.evidenceLinks ?? []), link],
        timeline: [...(item.timeline ?? []), {
          id: randomUUID(), type: "evidence_linked", actorUserId: ctx.userId,
          occurredAt: now, revision: nextRevision, note,
          reference: { kind: sourceType, id: sourceId },
        }],
        revision: nextRevision,
      }, ctx);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId,
        actorEmail: ctx.userEmail, action: "banking_case:evidence_linked",
        resource: "BankingCase", resourceId: item.id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { evidenceLinkId: id, sourceType, sourceId,
          revision: nextRevision, verificationState: "unverified" },
      });
      return updated;
    });
  }

  public async propose(ctx: TenantContext, caseId: string, input: ProposeDecisionInput): Promise<BankingCaseRecord> {
    requirePermission(ctx, "case:create");
    const disposition = Validator.requireEnum(input.disposition,
      ["continue_investigation", "request_source_review", "escalate_for_control_review"] as const, "disposition");
    const rationale = Validator.requireString(input.rationale, "rationale", { minLength: 15, maxLength: 600 });
    revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      await verifyCurrentAccess(ctx, this.database, "case:create");
      const item = await this.visibleCase(ctx, caseId);
      if ((item.revision ?? 1) !== input.expectedRevision) throw new ConflictError("Case changed; reload before proposing");
      if (item.status !== "open" || item.decision?.state === "pending") {
        throw new ConflictError("A case cannot have more than one pending investigation plan");
      }
      if (item.decision) throw new ConflictError("This review cycle is already concluded; new cycles require a separate workflow");
      // A preview candidate is unverified source metadata, not bank evidence.
      if (item.previewOrigin && !item.evidenceLinks?.length && !item.sourceId &&
          disposition !== "request_source_review") {
        throw new ConflictError("Metadata-only preview candidates permit source-review requests only");
      }
      if (!(item.evidenceLinks?.length || item.sourceId || item.previewOrigin)) {
        throw new ConflictError("Link source evidence or an authorized preview candidate before proposing a review");
      }
      ensureCapacity(item);
      const now = new Date().toISOString(), nextRevision = (item.revision ?? 1) + 1;
      const decision: BankingCaseDecision = {
        id: randomUUID(), state: "pending", disposition, rationale,
        proposedByUserId: ctx.userId, proposedAt: now,
        evidenceLinkIds: (item.evidenceLinks ?? []).map(link => link.id),
      };
      const updated = await this.database.bankingCasesRepo.update(item.id, {
        decision, revision: nextRevision,
        timeline: [...(item.timeline ?? []), {
          id: randomUUID(), type: "decision_proposed", actorUserId: ctx.userId,
          occurredAt: now, revision: nextRevision, note: rationale,
        }],
      }, ctx);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId,
        actorEmail: ctx.userEmail, action: "banking_case:decision_proposed",
        resource: "BankingCase", resourceId: item.id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { decisionId: decision.id, disposition,
          linkedEvidenceCount: decision.evidenceLinkIds.length,
          previewOnly: Boolean(item.previewOrigin), revision: nextRevision },
      });
      return updated;
    });
  }

  public async review(ctx: TenantContext, caseId: string, input: ReviewDecisionInput): Promise<BankingCaseRecord> {
    requirePermission(ctx, "case:approve");
    const decisionId = Validator.requireId(input.decisionId, "decisionId");
    const verdict = Validator.requireEnum(input.verdict, ["approved", "rejected"] as const, "verdict");
    const note = Validator.requireString(input.note, "note", { minLength: 10, maxLength: 600 });
    revision(input.expectedRevision);
    return this.database.runInTransaction(ctx, async () => {
      const { isAdministrator } = await verifyCurrentAccess(ctx, this.database, "case:approve");
      if (!isAdministrator) throw new ForbiddenError("Independent case review requires institution administrator authority");
      const item = await this.visibleCase(ctx, caseId);
      if ((item.revision ?? 1) !== input.expectedRevision) throw new ConflictError("Case changed; reload before reviewing");
      if (item.status !== "open" || !item.decision || item.decision.state !== "pending" ||
          item.decision.id !== decisionId) {
        throw new ConflictError("This case has no matching pending plan");
      }
      if (item.createdByUserId === ctx.userId || item.decision.proposedByUserId === ctx.userId) {
        throw new ForbiddenError("Maker-checker separation: the originator or proposer cannot review this case plan");
      }
      // Even a procedural sign-off may not rely on a deleted or foreign source.
      // Verifying existence is NOT authenticating its financial contents.
      for (const link of item.evidenceLinks ?? []) {
        await this.validateSource(ctx, link.sourceType, link.sourceId);
      }
      if (item.sourceType && item.sourceId) {
        await this.validateSource(ctx, item.sourceType, item.sourceId);
      }
      ensureCapacity(item);
      const now = new Date().toISOString(), nextRevision = (item.revision ?? 1) + 1;
      const decision: BankingCaseDecision = {
        ...item.decision, state: verdict, reviewedByUserId: ctx.userId,
        reviewedAt: now, reviewNote: note,
      };
      const updated = await this.database.bankingCasesRepo.update(item.id, {
        decision, revision: nextRevision,
        timeline: [...(item.timeline ?? []), {
          id: randomUUID(), type: "decision_reviewed", actorUserId: ctx.userId,
          occurredAt: now, revision: nextRevision,
          note: verdict + ": " + note,
        }],
      }, ctx);
      await this.database.recordAuditLog({
        organizationId: ctx.organizationId, actorId: ctx.userId,
        actorEmail: ctx.userEmail, action: "banking_case:decision_reviewed",
        resource: "BankingCase", resourceId: item.id, requestId: ctx.requestId,
        status: "success", timestamp: now,
        metadata: { decisionId, verdict, reviewerId: ctx.userId,
          proposerId: item.decision.proposedByUserId,
          caseCreatorId: item.createdByUserId,
          revision: nextRevision,
          decisionScope: "internal_investigation_plan_only",
          financialLossAssessed: false },
      });
      return updated;
    });
  }
}

export const bankingCaseReviewService = new BankingCaseReviewService();
