/**
 * APEX ONE — Repository Interfaces & Data Access Contracts
 *
 * Stage 3 canonical collection boundary:
 * - every collection read returns PaginatedResult<T>
 * - every collection query uses QuerySpecification<T>
 * - cursor pagination is the only repository pagination model
 * - findOne/count are explicit primitives
 * - executable predicate search is not part of the repository contract
 */

import { TenantContext } from "../core/errors";
import type {
  PaginatedResult,
  QuerySpecification,
} from "./querySpecification";
import {
  CustomerRecord,
  ContractRecord,
  TransactionRecord,
  SignalRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  OrganizationalMemoryRecord,
  ActionRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  AuditLogRecord,
  UpdateCustomerInput,
  UpdateContractInput,
  UpdateTransactionInput,
  UpdateSignalInput,
  UpdateValueOpportunityInput,
  UpdateValueCapturedInput,
  UpdateOrganizationalMemoryInput,
  UpdateActionInput,
  UpdateDocumentInput,
  UpdateKnowledgeItemInput,
  UpdateWorkflowInput,
  UpdateWorkflowRunInput,
} from "./schema";

export interface ITenantScopedRepository<
  T extends { id: string; organizationId: string },
  TUpdate = Partial<Omit<T, "id" | "organizationId" | "createdAt">>
> {
  findById(id: string, ctx: TenantContext, resourceName?: string): Promise<T>;
  findMany(ctx: TenantContext, query?: QuerySpecification<T>): Promise<PaginatedResult<T>>;
  findOne(ctx: TenantContext, query?: QuerySpecification<T>): Promise<T | undefined>;
  count(ctx: TenantContext, query?: QuerySpecification<T>): Promise<number>;
  create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T>;
  update(id: string, updates: TUpdate, ctx: TenantContext, resourceName?: string): Promise<T>;
  delete(id: string, ctx: TenantContext, resourceName?: string): Promise<boolean>;
}

export interface ICustomerRepository
  extends ITenantScopedRepository<CustomerRecord, UpdateCustomerInput> {
  findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined>;
  findAtRisk(ctx: TenantContext): Promise<PaginatedResult<CustomerRecord>>;
}

export interface IContractRepository
  extends ITenantScopedRepository<ContractRecord, UpdateContractInput> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<PaginatedResult<ContractRecord>>;
  findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<PaginatedResult<ContractRecord>>;
}

export interface FinancialTotalsByCurrency {
  totalRevenue: number;
  totalCosts: number;
  net: number;
  transactionCount: number;
}

export interface FinancialTotalsResult {
  byCurrency: Record<string, FinancialTotalsByCurrency>;
  isMixedCurrency: boolean;
  currency?: string | null;
  totalRevenue?: number | null;
  totalCosts?: number | null;
}

export interface ITransactionRepository
  extends ITenantScopedRepository<TransactionRecord, UpdateTransactionInput> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<PaginatedResult<TransactionRecord>>;
  calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult>;
}

export interface ISignalRepository
  extends ITenantScopedRepository<SignalRecord, UpdateSignalInput> {
  findActiveByCategory(category: string, ctx: TenantContext): Promise<PaginatedResult<SignalRecord>>;
}

export interface IValueOpportunityRepository
  extends ITenantScopedRepository<ValueOpportunityRecord, UpdateValueOpportunityInput> {
  findByCategory(category: string, ctx: TenantContext): Promise<PaginatedResult<ValueOpportunityRecord>>;
  findByStatus(status: string, ctx: TenantContext): Promise<PaginatedResult<ValueOpportunityRecord>>;
}

export interface IValueCapturedRepository
  extends ITenantScopedRepository<ValueCapturedRecord, UpdateValueCapturedInput> {
  calculateTotalCaptured(ctx: TenantContext): Promise<number>;
}

export interface IOrganizationalMemoryRepository
  extends ITenantScopedRepository<OrganizationalMemoryRecord, UpdateOrganizationalMemoryInput> {
  searchKeywords(keywords: string[], ctx: TenantContext): Promise<PaginatedResult<OrganizationalMemoryRecord>>;
}

export interface IActionRepository
  extends ITenantScopedRepository<ActionRecord, UpdateActionInput> {
  findByStatus(status: string, ctx: TenantContext): Promise<PaginatedResult<ActionRecord>>;
}

export interface IDocumentRepository
  extends ITenantScopedRepository<DocumentRecord, UpdateDocumentInput> {
  findByCategory(category: string, ctx: TenantContext): Promise<PaginatedResult<DocumentRecord>>;
  findByCustomer(customerId: string, ctx: TenantContext): Promise<PaginatedResult<DocumentRecord>>;
  findByStatus(status: string, ctx: TenantContext): Promise<PaginatedResult<DocumentRecord>>;
}

export interface IKnowledgeRepository
  extends ITenantScopedRepository<KnowledgeItemRecord, UpdateKnowledgeItemInput> {
  findByCategory(category: string, ctx: TenantContext): Promise<PaginatedResult<KnowledgeItemRecord>>;
  findByTags(tags: string[], ctx: TenantContext): Promise<PaginatedResult<KnowledgeItemRecord>>;
  searchContent(query: string, ctx: TenantContext): Promise<PaginatedResult<KnowledgeItemRecord>>;
}

export interface IWorkflowRepository
  extends ITenantScopedRepository<WorkflowRecord, UpdateWorkflowInput> {
  findActive(ctx: TenantContext): Promise<PaginatedResult<WorkflowRecord>>;
}

export interface IWorkflowRunRepository
  extends ITenantScopedRepository<WorkflowRunRecord, UpdateWorkflowRunInput> {
  findByWorkflow(workflowId: string, ctx: TenantContext): Promise<PaginatedResult<WorkflowRunRecord>>;
  findActiveRuns(ctx: TenantContext): Promise<PaginatedResult<WorkflowRunRecord>>;
}

export interface IAuditLogRepository {
  record(
    log:
      | Omit<AuditLogRecord, "id">
      | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord>;
  findMany(
    ctx: TenantContext,
    query?: QuerySpecification<AuditLogRecord>
  ): Promise<PaginatedResult<AuditLogRecord>>;
  findOne(
    ctx: TenantContext,
    query?: QuerySpecification<AuditLogRecord>
  ): Promise<AuditLogRecord | undefined>;
  count(ctx: TenantContext, query?: QuerySpecification<AuditLogRecord>): Promise<number>;
}

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeLimit,
  encodeCursor,
  decodeCursor,
  ENTITY_SORT_WHITELIST,
  normalizeAndValidateOrderBy,
  compareRecords,
} from "./querySpecification";

export type {
  PaginatedResult,
  PaginationOptions,
  QuerySpecification,
  QueryFilter,
  FieldCondition,
  ComparisonOperator,
  SearchSpecification,
  OrderBySpecification,
  OrderByClause,
} from "./querySpecification";

export type {
  UpdateCustomerInput,
  UpdateContractInput,
  UpdateTransactionInput,
  UpdateSignalInput,
  UpdateValueOpportunityInput,
  UpdateValueCapturedInput,
  UpdateOrganizationalMemoryInput,
  UpdateActionInput,
  UpdateDocumentInput,
  UpdateKnowledgeItemInput,
  UpdateWorkflowInput,
  UpdateWorkflowRunInput,
} from "./schema";

export type { IUnitOfWork, IUnitOfWorkProvider } from "./unitOfWork";
