/**
 * APEX ONE — Repository Interfaces & Data Access Contracts
 * 
 * Defines abstract data access boundaries between domain services and underlying storage.
 * In Phase 2, these are backed by InMemory Adapters.
 * In Phase 3, these interfaces will be backed by PostgreSQL / Cloud SQL.
 */

import { TenantContext } from "../core/errors";
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
} from "./schema";

export interface ITenantScopedRepository<T extends { id: string; organizationId: string }> {
  findById(id: string, ctx: TenantContext, resourceName?: string): Promise<T>;
  findMany(ctx: TenantContext, filter?: (item: T) => boolean): Promise<T[]>;
  create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T>;
  update(id: string, updates: Partial<T>, ctx: TenantContext, resourceName?: string): Promise<T>;
  delete(id: string, ctx: TenantContext, resourceName?: string): Promise<boolean>;
  search(ctx: TenantContext, predicate: (item: T) => boolean): Promise<T[]>;
}

export interface ICustomerRepository extends ITenantScopedRepository<CustomerRecord> {
  findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined>;
  findAtRisk(ctx: TenantContext): Promise<CustomerRecord[]>;
}

export interface IContractRepository extends ITenantScopedRepository<ContractRecord> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<ContractRecord[]>;
  findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<ContractRecord[]>;
}

export interface ITransactionRepository extends ITenantScopedRepository<TransactionRecord> {
  findByCustomer(customerId: string, ctx: TenantContext): Promise<TransactionRecord[]>;
  calculateFinancialTotals(ctx: TenantContext): Promise<{ totalRevenue: number; totalCosts: number }>;
}

export interface ISignalRepository extends ITenantScopedRepository<SignalRecord> {
  findActiveByCategory(category: string, ctx: TenantContext): Promise<SignalRecord[]>;
}

export interface IValueOpportunityRepository extends ITenantScopedRepository<ValueOpportunityRecord> {
  findByCategory(category: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]>;
  findByStatus(status: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]>;
}

export interface IValueCapturedRepository extends ITenantScopedRepository<ValueCapturedRecord> {
  calculateTotalCaptured(ctx: TenantContext): Promise<number>;
}

export interface IOrganizationalMemoryRepository extends ITenantScopedRepository<OrganizationalMemoryRecord> {
  searchKeywords(keywords: string[], ctx: TenantContext): Promise<OrganizationalMemoryRecord[]>;
}

export interface IActionRepository extends ITenantScopedRepository<ActionRecord> {
  findByStatus(status: string, ctx: TenantContext): Promise<ActionRecord[]>;
}

export interface IDocumentRepository extends ITenantScopedRepository<DocumentRecord> {
  findByCategory(category: string, ctx: TenantContext): Promise<DocumentRecord[]>;
  findByCustomer(customerId: string, ctx: TenantContext): Promise<DocumentRecord[]>;
  findByStatus(status: string, ctx: TenantContext): Promise<DocumentRecord[]>;
}

export interface IKnowledgeRepository extends ITenantScopedRepository<KnowledgeItemRecord> {
  findByCategory(category: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
  findByTags(tags: string[], ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
  searchContent(query: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]>;
}

export interface IWorkflowRepository extends ITenantScopedRepository<WorkflowRecord> {
  findActive(ctx: TenantContext): Promise<WorkflowRecord[]>;
}

export interface IWorkflowRunRepository extends ITenantScopedRepository<WorkflowRunRecord> {
  findByWorkflow(workflowId: string, ctx: TenantContext): Promise<WorkflowRunRecord[]>;
  findActiveRuns(ctx: TenantContext): Promise<WorkflowRunRecord[]>;
}

export interface IAuditLogRepository {
  record(log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })): Promise<AuditLogRecord>;
  findMany(ctx: TenantContext, limit?: number): Promise<AuditLogRecord[]>;
}
