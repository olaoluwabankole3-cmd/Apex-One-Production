/**
 * APEX ONE — Repository Interfaces & Data Access Contracts
 * 
 * Defines abstract data access boundaries between domain services and underlying storage.
 * In Phase 2, these are backed by InMemory Adapters.
 * In Phase 3, these interfaces will be backed by PostgreSQL / Cloud SQL.
 */

import { TenantContext } from "../core/errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  CollectionQuery,
  SortOptions,
  SortDirection,
  CustomerQueryFilter,
  CustomerSortField,
  ContractQueryFilter,
  ContractSortField,
  TransactionQueryFilter,
  TransactionSortField,
  SignalQueryFilter,
  SignalSortField,
  ValueOpportunityQueryFilter,
  ValueOpportunitySortField,
  ValueCapturedQueryFilter,
  ValueCapturedSortField,
  OrganizationalMemoryQueryFilter,
  OrganizationalMemorySortField,
  ActionQueryFilter,
  ActionSortField,
  DocumentQueryFilter,
  DocumentSortField,
  KnowledgeQueryFilter,
  KnowledgeSortField,
  WorkflowQueryFilter,
  WorkflowSortField,
  WorkflowRunQueryFilter,
  WorkflowRunSortField,
  AuditLogQueryFilter,
  AuditLogSortField,
} from "./query";
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
  TUpdate = Partial<Omit<T, "id" | "organizationId" | "createdAt">>,
  TFilter = unknown,
  TSortField extends string = string
> {
  findById(id: string, ctx: TenantContext, resourceName?: string): Promise<T>;
  findMany(
    ctx: TenantContext,
    query?: CollectionQuery<TFilter, TSortField> | ((item: T) => boolean)
  ): Promise<T[]>;
  create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T>;
  update(id: string, updates: TUpdate, ctx: TenantContext, resourceName?: string): Promise<T>;
  delete(id: string, ctx: TenantContext, resourceName?: string): Promise<boolean>;
  search(ctx: TenantContext, predicate: (item: T) => boolean): Promise<T[]>;
}

export interface ICustomerRepository
  extends ITenantScopedRepository<CustomerRecord, UpdateCustomerInput, CustomerQueryFilter, CustomerSortField> {
  findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined>;
  findAtRisk(ctx: TenantContext): Promise<CustomerRecord[]>;
}

export interface IContractRepository
  extends ITenantScopedRepository<ContractRecord, UpdateContractInput, ContractQueryFilter, ContractSortField> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<ContractRecord[]>;
  findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<ContractRecord[]>;
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
  extends ITenantScopedRepository<TransactionRecord, UpdateTransactionInput, TransactionQueryFilter, TransactionSortField> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<TransactionRecord[]>;
  calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult>;
}

export interface ISignalRepository
  extends ITenantScopedRepository<SignalRecord, UpdateSignalInput, SignalQueryFilter, SignalSortField> {
  findActiveByCategory(category: string, ctx: TenantContext): Promise<SignalRecord[]>;
}

export interface IValueOpportunityRepository
  extends ITenantScopedRepository<ValueOpportunityRecord, UpdateValueOpportunityInput, ValueOpportunityQueryFilter, ValueOpportunitySortField> {
  findByCategory(category: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]>;
  findByStatus(status: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]>;
}

export interface IValueCapturedRepository
  extends ITenantScopedRepository<ValueCapturedRecord, UpdateValueCapturedInput, ValueCapturedQueryFilter, ValueCapturedSortField> {
  calculateTotalCaptured(ctx: TenantContext): Promise<number>;
}

export interface IOrganizationalMemoryRepository
  extends ITenantScopedRepository<OrganizationalMemoryRecord, UpdateOrganizationalMemoryInput, OrganizationalMemoryQueryFilter, OrganizationalMemorySortField> {
  searchKeywords(keywords: string[], ctx: TenantContext): Promise<OrganizationalMemoryRecord[]>;
}

export interface IActionRepository
  extends ITenantScopedRepository<ActionRecord, UpdateActionInput, ActionQueryFilter, ActionSortField> {
  findByStatus(status: string, ctx: TenantContext): Promise<ActionRecord[]>;
}

export interface IDocumentRepository
  extends ITenantScopedRepository<DocumentRecord, UpdateDocumentInput, DocumentQueryFilter, DocumentSortField> {
  findByCategory(category: string, ctx: TenantContext): Promise<DocumentRecord[]>;
  findByCustomer(customerId: string, ctx: TenantContext): Promise<DocumentRecord[]>;
  findByStatus(status: string, ctx: TenantContext): Promise<DocumentRecord[]>;
}

export interface IKnowledgeRepository
  extends ITenantScopedRepository<KnowledgeItemRecord, UpdateKnowledgeItemInput, KnowledgeQueryFilter, KnowledgeSortField> {
  findByCategory(category: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
  findByTags(tags: string[], ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
  searchContent(query: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
}

export interface IWorkflowRepository
  extends ITenantScopedRepository<WorkflowRecord, UpdateWorkflowInput, WorkflowQueryFilter, WorkflowSortField> {
  findActive(ctx: TenantContext): Promise<WorkflowRecord[]>;
}

export interface IWorkflowRunRepository
  extends ITenantScopedRepository<WorkflowRunRecord, UpdateWorkflowRunInput, WorkflowRunQueryFilter, WorkflowRunSortField> {
  findByWorkflow(workflowId: string, ctx: TenantContext): Promise<WorkflowRunRecord[]>;
  findActiveRuns(ctx: TenantContext): Promise<WorkflowRunRecord[]>;
}

export interface IAuditLogRepository {
  record(log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })): Promise<AuditLogRecord>;
  findMany(
    ctx: TenantContext,
    queryOrLimit?: CollectionQuery<AuditLogQueryFilter, AuditLogSortField> | number
  ): Promise<AuditLogRecord[]>;
}

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeQueryLimit,
  normalizeQueryOffset,
  validateSortOptions,
  CUSTOMER_SORT_FIELDS,
  CONTRACT_SORT_FIELDS,
  TRANSACTION_SORT_FIELDS,
  SIGNAL_SORT_FIELDS,
  VALUE_OPPORTUNITY_SORT_FIELDS,
  VALUE_CAPTURED_SORT_FIELDS,
  ORGANIZATIONAL_MEMORY_SORT_FIELDS,
  ACTION_SORT_FIELDS,
  DOCUMENT_SORT_FIELDS,
  KNOWLEDGE_SORT_FIELDS,
  WORKFLOW_SORT_FIELDS,
  WORKFLOW_RUN_SORT_FIELDS,
  AUDIT_LOG_SORT_FIELDS,
} from "./query";

export type {
  CollectionQuery,
  SortOptions,
  SortDirection,
  CustomerQueryFilter,
  CustomerSortField,
  ContractQueryFilter,
  ContractSortField,
  TransactionQueryFilter,
  TransactionSortField,
  SignalQueryFilter,
  SignalSortField,
  ValueOpportunityQueryFilter,
  ValueOpportunitySortField,
  ValueCapturedQueryFilter,
  ValueCapturedSortField,
  OrganizationalMemoryQueryFilter,
  OrganizationalMemorySortField,
  ActionQueryFilter,
  ActionSortField,
  DocumentQueryFilter,
  DocumentSortField,
  KnowledgeQueryFilter,
  KnowledgeSortField,
  WorkflowQueryFilter,
  WorkflowSortField,
  WorkflowRunQueryFilter,
  WorkflowRunSortField,
  AuditLogQueryFilter,
  AuditLogSortField,
} from "./query";

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
