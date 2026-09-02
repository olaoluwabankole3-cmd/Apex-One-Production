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
import { InMemoryTenantRepository } from "./InMemoryTenantRepository";

abstract class InMemoryAppendOnlyEvidenceRepository<
  T extends { id: string; organizationId: string; subjectType: string; subjectId: string }
> extends InMemoryTenantRepository<T, never> {
  public override async update(): Promise<T> {
    throw new ValidationError(`${this.collectionName} records are append-only and cannot be updated`);
  }

  public override async delete(): Promise<boolean> {
    throw new ValidationError(`${this.collectionName} records are append-only and cannot be deleted`);
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

export class InMemoryProvenanceRepository
  extends InMemoryAppendOnlyEvidenceRepository<ProvenanceRecord>
  implements IProvenanceRepository
{
  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}

export class InMemoryVerificationRepository
  extends InMemoryAppendOnlyEvidenceRepository<VerificationRecord>
  implements IVerificationRepository
{
  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}

export class InMemoryCertificationRepository
  extends InMemoryAppendOnlyEvidenceRepository<CertificationRecord>
  implements ICertificationRepository
{
  public findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext) {
    return this.findSubjectRecords(query, ctx);
  }
}
