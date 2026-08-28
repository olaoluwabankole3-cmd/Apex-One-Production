/**
 * APEX ONE — Unit of Work & Transaction Boundary
 * 
 * ARCHITECTURAL SPECIFICATION:
 * Defines a storage-agnostic transaction / Unit of Work contract that allows
 * multiple domain repositories and related audit operations to participate in
 * ONE atomic business operation.
 * 
 * In Phase 2 (Current): Backed by In-Memory Snapshot/Rollback Adapter.
 * In Phase 3 (Upcoming): Backed by PostgreSQL / Cloud SQL ACID Transactions.
 */

import { TenantContext, CrossTenantViolationError, ValidationError } from "../core/errors";
import {
  ICustomerRepository,
  IContractRepository,
  ITransactionRepository,
  ISignalRepository,
  IValueOpportunityRepository,
  IValueCapturedRepository,
  IOrganizationalMemoryRepository,
  IActionRepository,
  IDocumentRepository,
  IKnowledgeRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
  IAuditLogRepository,
} from "./repository";
import { AuditLogRecord } from "./schema";

/**
 * Storage-agnostic Unit of Work representing an active transaction.
 * All repositories exposed by this interface share the exact same transaction context.
 */
export interface IUnitOfWork {
  /**
   * Immutable, server-controlled TenantContext for the active transaction.
   * Attempting to mutate or override properties on this context is strictly rejected.
   */
  readonly context: Readonly<TenantContext>;

  /**
   * Domain repositories participating in this Unit of Work.
   * All mutations occur within the same transactional boundary.
   */
  readonly customers: ICustomerRepository;
  readonly contracts: IContractRepository;
  readonly transactions: ITransactionRepository;
  readonly signals: ISignalRepository;
  readonly opportunities: IValueOpportunityRepository;
  readonly valueCaptured: IValueCapturedRepository;
  readonly memory: IOrganizationalMemoryRepository;
  readonly actions: IActionRepository;
  readonly documents: IDocumentRepository;
  readonly knowledge: IKnowledgeRepository;
  readonly workflows: IWorkflowRepository;
  readonly workflowRuns: IWorkflowRunRepository;
  readonly auditLogs: IAuditLogRepository;

  /**
   * Records an audit log entry bound to the current transaction.
   * If the transaction rolls back, this audit record is rolled back atomically.
   */
  recordAuditLog(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord>;
}

/**
 * Provider interface for executing atomic business operations across repositories.
 */
export interface IUnitOfWorkProvider {
  /**
   * Executes a business operation within an atomic Unit of Work / transaction.
   * If any error occurs or is thrown within the work callback, all modifications
   * across all participating repositories and audit logs are rolled back cleanly,
   * preserving the exact original error.
   *
   * @param ctx Authenticated, server-derived TenantContext.
   * @param work Callback executing mutations using the provided UnitOfWork.
   */
  runInTransaction<T>(
    ctx: TenantContext,
    work: (uow: IUnitOfWork) => Promise<T>
  ): Promise<T>;
}

/**
 * In-Memory Unit of Work Implementation
 * 
 * Provides concrete repository binding and audit logging during an active in-memory transaction.
 * Strictly guarantees TenantContext immutability.
 */
export class InMemoryUnitOfWork implements IUnitOfWork {
  public readonly context: Readonly<TenantContext>;

  constructor(
    ctx: TenantContext,
    public readonly customers: ICustomerRepository,
    public readonly contracts: IContractRepository,
    public readonly transactions: ITransactionRepository,
    public readonly signals: ISignalRepository,
    public readonly opportunities: IValueOpportunityRepository,
    public readonly valueCaptured: IValueCapturedRepository,
    public readonly memory: IOrganizationalMemoryRepository,
    public readonly actions: IActionRepository,
    public readonly documents: IDocumentRepository,
    public readonly knowledge: IKnowledgeRepository,
    public readonly workflows: IWorkflowRepository,
    public readonly workflowRuns: IWorkflowRunRepository,
    public readonly auditLogs: IAuditLogRepository,
    private readonly store: {
      recordAuditLog(
        log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
      ): Promise<AuditLogRecord>;
    }
  ) {
    if (!ctx || !ctx.organizationId || typeof ctx.organizationId !== "string" || ctx.organizationId.trim().length === 0) {
      throw new ValidationError("Valid TenantContext with non-empty organizationId is required to initialize UnitOfWork");
    }

    // Freeze the tenant context deeply so callers cannot mutate tenant identity
    this.context = Object.freeze({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      userRole: ctx.userRole,
      permissions: Object.freeze([...(ctx.permissions || [])]) as unknown as string[],
      isSuperAdmin: ctx.isSuperAdmin,
      requestId: ctx.requestId,
      timestamp: ctx.timestamp || new Date().toISOString(),
    });
  }

  public async recordAuditLog(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord> {
    if (log.organizationId && log.organizationId !== this.context.organizationId) {
      throw new CrossTenantViolationError(log.organizationId, this.context.organizationId);
    }
    const safeLog = {
      ...log,
      organizationId: this.context.organizationId,
    };
    return this.store.recordAuditLog(safeLog);
  }
}
