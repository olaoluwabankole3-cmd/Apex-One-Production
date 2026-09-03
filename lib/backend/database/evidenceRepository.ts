import { TenantContext } from "../core/errors";
import type { PaginatedResult, QuerySpecification } from "./querySpecification";
import type {
  CertificationRecord,
  EvidenceSubjectType,
  ProvenanceRecord,
  VerificationRecord,
} from "../domains/evidence/model";

export interface IAppendOnlyTenantRepository<T extends { id: string; organizationId: string }> {
  findById(id: string, ctx: TenantContext, resourceName?: string): Promise<T>;
  findMany(ctx: TenantContext, query?: QuerySpecification<T>): Promise<PaginatedResult<T>>;
  findOne(ctx: TenantContext, query?: QuerySpecification<T>): Promise<T | undefined>;
  count(ctx: TenantContext, query?: QuerySpecification<T>): Promise<number>;
  create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T>;
}

export interface EvidenceSubjectQuery {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  limit?: number;
  cursor?: string | null;
}

export interface IProvenanceRepository extends IAppendOnlyTenantRepository<ProvenanceRecord> {
  findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext): Promise<PaginatedResult<ProvenanceRecord>>;
}

export interface IVerificationRepository extends IAppendOnlyTenantRepository<VerificationRecord> {
  findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext): Promise<PaginatedResult<VerificationRecord>>;
}

export interface ICertificationRepository extends IAppendOnlyTenantRepository<CertificationRecord> {
  findBySubject(query: EvidenceSubjectQuery, ctx: TenantContext): Promise<PaginatedResult<CertificationRecord>>;
}
