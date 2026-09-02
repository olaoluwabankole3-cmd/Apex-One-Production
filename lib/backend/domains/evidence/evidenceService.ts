import { randomUUID } from "node:crypto";
import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { collectAllPages } from "../../database/paginationTraversal";
import { MAX_PAGE_SIZE, type PaginatedResult } from "../../database/querySpecification";
import { TenantContext, requirePermission } from "../../core/security";
import { ConflictError, ValidationError } from "../../core/errors";
import {
  assertCertificationRecordInvariant,
  assertEvidenceSubject,
  assertProvenanceRecordInvariant,
  assertVerificationRecordInvariant,
  deriveEvidenceStateSnapshot,
  type CertificationDecision,
  type CertificationRecord,
  type EvidenceStateSnapshot,
  type EvidenceSubjectType,
  type ProvenanceProducerType,
  type ProvenanceRecord,
  type ProvenanceRelation,
  type ProvenanceSourceReference,
  type VerificationDecision,
  type VerificationRecord,
} from "./model";

export interface EvidenceListOptions {
  limit?: number;
  cursor?: string | null;
}

export interface RecordProvenanceDto {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  relation: ProvenanceRelation;
  sources: ProvenanceSourceReference[];
  producerType: ProvenanceProducerType;
  producerId?: string;
  producerLabel?: string;
  method?: string;
  model?: string;
  confidence?: number;
  notes?: string;
}

export interface RecordVerificationDto {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  state: VerificationDecision;
  provenanceIds?: string[];
  criteria: string[];
  reason?: string;
}

export interface RecordCertificationDto {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  state: CertificationDecision;
  verificationRecordId?: string;
  authority: string;
  reason?: string;
  validFrom?: string;
  validUntil?: string;
}

export class EvidenceService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  private async assertPersistentSubjectExists(
    subjectType: EvidenceSubjectType,
    subjectId: string,
    ctx: TenantContext
  ): Promise<void> {
    switch (subjectType) {
      case "Customer": await this.database.customersRepo.findById(subjectId, ctx, subjectType); return;
      case "Contract": await this.database.contractsRepo.findById(subjectId, ctx, subjectType); return;
      case "Transaction": await this.database.transactionsRepo.findById(subjectId, ctx, subjectType); return;
      case "Document": await this.database.documentsRepo.findById(subjectId, ctx, subjectType); return;
      case "KnowledgeItem": await this.database.knowledgeRepo.findById(subjectId, ctx, subjectType); return;
      case "OrganizationalMemory": await this.database.memoryRepo.findById(subjectId, ctx, subjectType); return;
      case "Signal": await this.database.signalsRepo.findById(subjectId, ctx, subjectType); return;
      case "ValueOpportunity": await this.database.opportunitiesRepo.findById(subjectId, ctx, subjectType); return;
      case "ValueCaptured": await this.database.valueCapturedRepo.findById(subjectId, ctx, subjectType); return;
      case "Action": await this.database.actionsRepo.findById(subjectId, ctx, subjectType); return;
      case "Workflow": await this.database.workflowsRepo.findById(subjectId, ctx, subjectType); return;
      case "WorkflowRun": await this.database.workflowRunsRepo.findById(subjectId, ctx, subjectType); return;
      case "DerivedMetric":
      case "AiClaim":
        return;
    }
  }

  private async allVerificationRecords(
    subjectType: EvidenceSubjectType,
    subjectId: string,
    ctx: TenantContext
  ): Promise<VerificationRecord[]> {
    return collectAllPages((cursor) =>
      this.database.verificationsRepo.findBySubject(
        { subjectType, subjectId, limit: MAX_PAGE_SIZE, cursor },
        ctx
      )
    );
  }

  private async allCertificationRecords(
    subjectType: EvidenceSubjectType,
    subjectId: string,
    ctx: TenantContext
  ): Promise<CertificationRecord[]> {
    return collectAllPages((cursor) =>
      this.database.certificationsRepo.findBySubject(
        { subjectType, subjectId, limit: MAX_PAGE_SIZE, cursor },
        ctx
      )
    );
  }

  public async getStatus(
    subjectType: EvidenceSubjectType,
    subjectId: string,
    ctx: TenantContext,
    now: Date = new Date()
  ): Promise<EvidenceStateSnapshot> {
    requirePermission(ctx, "org:read");
    assertEvidenceSubject(subjectType, subjectId);
    await this.assertPersistentSubjectExists(subjectType, subjectId, ctx);

    const [verifications, certifications] = await Promise.all([
      this.allVerificationRecords(subjectType, subjectId, ctx),
      this.allCertificationRecords(subjectType, subjectId, ctx),
    ]);
    return deriveEvidenceStateSnapshot(subjectType, subjectId, verifications, certifications, now);
  }

  public async getProvenance(
    subjectType: EvidenceSubjectType,
    subjectId: string,
    ctx: TenantContext,
    options: EvidenceListOptions = {}
  ): Promise<PaginatedResult<ProvenanceRecord>> {
    requirePermission(ctx, "org:read");
    assertEvidenceSubject(subjectType, subjectId);
    await this.assertPersistentSubjectExists(subjectType, subjectId, ctx);
    return this.database.provenanceRepo.findBySubject(
      { subjectType, subjectId, limit: options.limit, cursor: options.cursor },
      ctx
    );
  }

  public async recordProvenance(dto: RecordProvenanceDto, ctx: TenantContext): Promise<ProvenanceRecord> {
    requirePermission(ctx, "org:write");
    assertEvidenceSubject(dto.subjectType, dto.subjectId);
    await this.assertPersistentSubjectExists(dto.subjectType, dto.subjectId, ctx);

    const recordData: Omit<ProvenanceRecord, "organizationId"> = {
      id: `prov-${randomUUID()}`,
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      relation: dto.relation,
      sources: dto.sources,
      producerType: dto.producerType,
      producerId: dto.producerType === "human" ? ctx.userId : dto.producerId,
      producerLabel: dto.producerType === "human" ? ctx.userEmail : dto.producerLabel,
      method: dto.method,
      model: dto.model,
      confidence: dto.confidence,
      notes: dto.notes,
      createdAt: new Date().toISOString(),
    };
    assertProvenanceRecordInvariant(recordData);

    return this.database.runInTransaction(ctx, async (uow) => {
      const record = await this.database.provenanceRepo.create(recordData, uow.context);
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "evidence:provenance_recorded",
        resource: dto.subjectType,
        resourceId: dto.subjectId,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { provenanceId: record.id, relation: record.relation, producerType: record.producerType },
        timestamp: record.createdAt,
      });
      return record;
    });
  }

  public async recordVerification(dto: RecordVerificationDto, ctx: TenantContext): Promise<VerificationRecord> {
    requirePermission(ctx, "org:write");
    assertEvidenceSubject(dto.subjectType, dto.subjectId);
    await this.assertPersistentSubjectExists(dto.subjectType, dto.subjectId, ctx);

    return this.database.runInTransaction(ctx, async (uow) => {
      const status = await this.getStatus(dto.subjectType, dto.subjectId, uow.context);
      if (dto.state === "invalidated" && status.certificationState === "certified") {
        throw new ConflictError("Active certification must be revoked before verification can be invalidated");
      }

      const provenanceIds = [...new Set(dto.provenanceIds ?? [])];
      for (const provenanceId of provenanceIds) {
        const provenance = await this.database.provenanceRepo.findById(provenanceId, uow.context, "Provenance");
        if (provenance.subjectType !== dto.subjectType || provenance.subjectId !== dto.subjectId) {
          throw new ValidationError("Verification provenance must belong to the same evidence subject");
        }
      }

      const recordData: Omit<VerificationRecord, "organizationId"> = {
        id: `verify-${randomUUID()}`,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        state: dto.state,
        provenanceIds,
        verifierType: "human",
        verifierId: uow.context.userId,
        verifierLabel: uow.context.userEmail,
        criteria: dto.criteria,
        reason: dto.reason,
        createdAt: new Date().toISOString(),
      };
      assertVerificationRecordInvariant(recordData, status.verificationState);

      const record = await this.database.verificationsRepo.create(recordData, uow.context);
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "evidence:verification_recorded",
        resource: dto.subjectType,
        resourceId: dto.subjectId,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { verificationId: record.id, state: record.state, provenanceIds: record.provenanceIds },
        timestamp: record.createdAt,
      });
      return record;
    });
  }

  public async recordCertification(dto: RecordCertificationDto, ctx: TenantContext): Promise<CertificationRecord> {
    requirePermission(ctx, "org:admin");
    assertEvidenceSubject(dto.subjectType, dto.subjectId);
    await this.assertPersistentSubjectExists(dto.subjectType, dto.subjectId, ctx);

    return this.database.runInTransaction(ctx, async (uow) => {
      const status = await this.getStatus(dto.subjectType, dto.subjectId, uow.context);
      let basis: VerificationRecord | undefined;
      if (dto.verificationRecordId) {
        basis = await this.database.verificationsRepo.findById(dto.verificationRecordId, uow.context, "Verification");
        if (basis.subjectType !== dto.subjectType || basis.subjectId !== dto.subjectId || basis.state !== "verified") {
          throw new ValidationError("Certification verification basis must be a verified record for the same subject");
        }
      }
      if (dto.state === "certified" && basis?.id !== status.latestVerification?.id) {
        throw new ConflictError("Certification must reference the current verified decision");
      }

      const recordData: Omit<CertificationRecord, "organizationId"> = {
        id: `cert-${randomUUID()}`,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        state: dto.state,
        verificationRecordId: dto.verificationRecordId,
        certifierId: uow.context.userId,
        certifierLabel: uow.context.userEmail,
        authority: dto.authority,
        reason: dto.reason,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        createdAt: new Date().toISOString(),
      };
      assertCertificationRecordInvariant(
        recordData,
        status.certificationState,
        status.verificationState
      );

      const record = await this.database.certificationsRepo.create(recordData, uow.context);
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "evidence:certification_recorded",
        resource: dto.subjectType,
        resourceId: dto.subjectId,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { certificationId: record.id, state: record.state, verificationRecordId: record.verificationRecordId },
        timestamp: record.createdAt,
      });
      return record;
    });
  }
}

export const evidenceService = new EvidenceService();
