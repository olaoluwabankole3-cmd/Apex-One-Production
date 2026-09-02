import { TenantContext, ValidationError } from "../../../core/errors";
import type {
  CertificationRecord,
  ProvenanceRecord,
  VerificationRecord,
} from "../../../domains/evidence/model";
import type {
  EvidenceSubjectQuery,
  ICertificationRepository,
  IProvenanceRepository,
  IVerificationRepository,
} from "../../evidenceRepository";
import type { PaginatedResult } from "../../querySpecification";
import {
  PostgresConnectionManager,
  PostgresTenantRepository,
} from "./PostgresPersistence";

abstract class PostgresAppendOnlyEvidenceRepository<
  T extends { id: string; organizationId: string; subjectType: string; subjectId: string }
> extends PostgresTenantRepository<T, never> {
  public override async update(): Promise<T> {
    throw new ValidationError(`${this.entityType} records are append-only and cannot be updated`);
  }

  public override async delete(): Promise<boolean> {
    throw new ValidationError(`${this.entityType} records are append-only and cannot be deleted`);
  }

  protected findSubjectRecords(
    query: EvidenceSubjectQuery,
    ctx: TenantContext
  ): Promise<PaginatedResult<T>> {
    return this.findMany(ctx, {
      where: {
        AND: [
          { subjectType: { eq: query.subjectType } },
          { subjectId: { eq: query.subjectId } },
        ],
      } as any,
      orderBy: { field: "createdAt", direction: "desc" },
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}

export class PostgresProvenanceRepository
  extends PostgresAppendOnlyEvidenceRepository<ProvenanceRecord>
  implements IProvenanceRepository
{
  constructor(manager: PostgresConnectionManager) {
    super("Provenance", manager);
  }

  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}

export class PostgresVerificationRepository
  extends PostgresAppendOnlyEvidenceRepository<VerificationRecord>
  implements IVerificationRepository
{
  constructor(manager: PostgresConnectionManager) {
    super("Verification", manager);
  }

  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}

export class PostgresCertificationRepository
  extends PostgresAppendOnlyEvidenceRepository<CertificationRecord>
  implements ICertificationRepository
{
  constructor(manager: PostgresConnectionManager) {
    super("Certification", manager);
  }

  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}
