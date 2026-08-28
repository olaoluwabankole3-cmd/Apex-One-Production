/**
 * APEX ONE — Multi-Tenant Backend Database Store
 * 
 * Central registry for domain entities and repository adapters.
 * Connects domain services to isolated data access adapters.
 */

import {
  OrganizationRecord,
  UserRecord,
  OrganizationMembershipRecord,
  CustomerRecord,
  ContractRecord,
  TransactionRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  OrganizationalMemoryRecord,
  EventRecord,
  SignalRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  ActionRecord,
  AuditLogRecord,
} from "./schema";
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
import {
  InMemoryCustomerRepository,
  InMemoryContractRepository,
  InMemoryTransactionRepository,
  InMemorySignalRepository,
  InMemoryValueOpportunityRepository,
  InMemoryValueCapturedRepository,
  InMemoryOrganizationalMemoryRepository,
  InMemoryActionRepository,
  InMemoryDocumentRepository,
  InMemoryKnowledgeRepository,
  InMemoryWorkflowRepository,
  InMemoryWorkflowRunRepository,
  InMemoryAuditLogRepository,
} from "./adapters/inMemory/InMemoryDomainRepositories";
import { IDataProvider, ProductionDataProvider } from "./demoDataProvider";
import { TenantContext, CrossTenantViolationError, ValidationError } from "../core/errors";
import { IUnitOfWork, IUnitOfWorkProvider, InMemoryUnitOfWork } from "./unitOfWork";

export interface DatabaseStateSnapshot {
  organizations: Map<string, OrganizationRecord>;
  users: Map<string, UserRecord>;
  memberships: Map<string, OrganizationMembershipRecord>;
  customers: Map<string, CustomerRecord>;
  contracts: Map<string, ContractRecord>;
  transactions: Map<string, TransactionRecord>;
  documents: Map<string, DocumentRecord>;
  knowledge: Map<string, KnowledgeItemRecord>;
  memory: Map<string, OrganizationalMemoryRecord>;
  events: Map<string, EventRecord>;
  signals: Map<string, SignalRecord>;
  opportunities: Map<string, ValueOpportunityRecord>;
  valueCaptured: Map<string, ValueCapturedRecord>;
  workflows: Map<string, WorkflowRecord>;
  workflowRuns: Map<string, WorkflowRunRecord>;
  actions: Map<string, ActionRecord>;
  auditLogs: AuditLogRecord[];
}

export class DatabaseStore implements IUnitOfWorkProvider {
  // In-Memory Collections (Isolated state for Phase 2)
  public organizations: Map<string, OrganizationRecord> = new Map();
  public users: Map<string, UserRecord> = new Map();
  public memberships: Map<string, OrganizationMembershipRecord> = new Map();
  public customers: Map<string, CustomerRecord> = new Map();
  public contracts: Map<string, ContractRecord> = new Map();
  public transactions: Map<string, TransactionRecord> = new Map();
  public documents: Map<string, DocumentRecord> = new Map();
  public knowledge: Map<string, KnowledgeItemRecord> = new Map();
  public memory: Map<string, OrganizationalMemoryRecord> = new Map();
  public events: Map<string, EventRecord> = new Map();
  public signals: Map<string, SignalRecord> = new Map();
  public opportunities: Map<string, ValueOpportunityRecord> = new Map();
  public valueCaptured: Map<string, ValueCapturedRecord> = new Map();
  public workflows: Map<string, WorkflowRecord> = new Map();
  public workflowRuns: Map<string, WorkflowRunRecord> = new Map();
  public actions: Map<string, ActionRecord> = new Map();

  // Repository Adapters
  public readonly customersRepo: ICustomerRepository;
  public readonly contractsRepo: IContractRepository;
  public readonly transactionsRepo: ITransactionRepository;
  public readonly signalsRepo: ISignalRepository;
  public readonly opportunitiesRepo: IValueOpportunityRepository;
  public readonly valueCapturedRepo: IValueCapturedRepository;
  public readonly memoryRepo: IOrganizationalMemoryRepository;
  public readonly actionsRepo: IActionRepository;
  public readonly documentsRepo: IDocumentRepository;
  public readonly knowledgeRepo: IKnowledgeRepository;
  public readonly workflowsRepo: IWorkflowRepository;
  public readonly workflowRunsRepo: IWorkflowRunRepository;
  public readonly auditLogsRepo: IAuditLogRepository;

  constructor(dataProvider: IDataProvider = new ProductionDataProvider()) {
    const handleViolation = (ctx: TenantContext, resourceId: string, attemptedOrg: string) => {
      this.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "security:cross_tenant_access_attempt",
        resource: "Entity",
        resourceId,
        requestId: ctx.requestId,
        status: "denied",
        metadata: { attemptedOrg, actualOrg: ctx.organizationId },
        timestamp: new Date().toISOString(),
      });
    };

    // Instantiate Repositories
    this.customersRepo = new InMemoryCustomerRepository("Customer", this.customers, handleViolation, this);
    this.contractsRepo = new InMemoryContractRepository("Contract", this.contracts, handleViolation, this);
    this.transactionsRepo = new InMemoryTransactionRepository("Transaction", this.transactions, handleViolation, this);
    this.signalsRepo = new InMemorySignalRepository("Signal", this.signals, handleViolation, this);
    this.opportunitiesRepo = new InMemoryValueOpportunityRepository("ValueOpportunity", this.opportunities, handleViolation, this);
    this.valueCapturedRepo = new InMemoryValueCapturedRepository("ValueCaptured", this.valueCaptured, handleViolation, this);
    this.memoryRepo = new InMemoryOrganizationalMemoryRepository("OrganizationalMemory", this.memory, handleViolation, this);
    this.actionsRepo = new InMemoryActionRepository("Action", this.actions, handleViolation, this);
    this.documentsRepo = new InMemoryDocumentRepository("Document", this.documents, handleViolation, this);
    this.knowledgeRepo = new InMemoryKnowledgeRepository("Knowledge", this.knowledge, handleViolation, this);
    this.workflowsRepo = new InMemoryWorkflowRepository("Workflow", this.workflows, handleViolation, this);
    this.workflowRunsRepo = new InMemoryWorkflowRunRepository("WorkflowRun", this.workflowRuns, handleViolation, this);
    this.auditLogsRepo = new InMemoryAuditLogRepository();

    // Populate initial dataset
    dataProvider.seedInitialTenants(this);
  }

  /**
   * Clears all in-memory entity tables and audit logs.
   * Useful for test isolation to ensure state does not leak between test suites.
   */
  public clearAll(): void {
    this.organizations.clear();
    this.users.clear();
    this.memberships.clear();
    this.customers.clear();
    this.contracts.clear();
    this.transactions.clear();
    this.documents.clear();
    this.knowledge.clear();
    this.memory.clear();
    this.events.clear();
    this.signals.clear();
    this.opportunities.clear();
    this.valueCaptured.clear();
    this.workflows.clear();
    this.workflowRuns.clear();
    this.actions.clear();
    if (this.auditLogsRepo instanceof InMemoryAuditLogRepository) {
      this.auditLogsRepo.clear();
    }
  }

  /**
   * Resets database state and optionally re-seeds using a provider.
   */
  public reset(dataProvider?: IDataProvider): void {
    this.clearAll();
    if (dataProvider) {
      dataProvider.seedInitialTenants(this);
    }
  }

  /**
   * Creates a fresh, isolated DatabaseStore instance.
   */
  public static createFreshStore(dataProvider?: IDataProvider): DatabaseStore {
    return new DatabaseStore(dataProvider);
  }

  public recordAuditLog(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ) {
    return this.auditLogsRepo.record(log);
  }

  public getOrganizationById(id: string): OrganizationRecord | undefined {
    return this.organizations.get(id);
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  public getUserMembership(userId: string, orgId: string): OrganizationMembershipRecord | undefined {
    for (const m of this.memberships.values()) {
      if (m.userId === userId && m.organizationId === orgId) {
        return m;
      }
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // Transaction & Unit of Work Management
  // --------------------------------------------------------------------------

  private activeTransactionContext: Readonly<TenantContext> | null = null;

  private cloneMap<T>(source: Map<string, T>): Map<string, T> {
    const target = new Map<string, T>();
    for (const [k, v] of source.entries()) {
      target.set(k, typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
    }
    return target;
  }

  private restoreMap<T>(target: Map<string, T>, snapshot: Map<string, T>): void {
    target.clear();
    for (const [k, v] of snapshot.entries()) {
      target.set(k, v);
    }
  }

  /**
   * Captures an isolated snapshot of all entity tables and audit logs.
   */
  public createSnapshot(): DatabaseStateSnapshot {
    return {
      organizations: this.cloneMap(this.organizations),
      users: this.cloneMap(this.users),
      memberships: this.cloneMap(this.memberships),
      customers: this.cloneMap(this.customers),
      contracts: this.cloneMap(this.contracts),
      transactions: this.cloneMap(this.transactions),
      documents: this.cloneMap(this.documents),
      knowledge: this.cloneMap(this.knowledge),
      memory: this.cloneMap(this.memory),
      events: this.cloneMap(this.events),
      signals: this.cloneMap(this.signals),
      opportunities: this.cloneMap(this.opportunities),
      valueCaptured: this.cloneMap(this.valueCaptured),
      workflows: this.cloneMap(this.workflows),
      workflowRuns: this.cloneMap(this.workflowRuns),
      actions: this.cloneMap(this.actions),
      auditLogs:
        this.auditLogsRepo instanceof InMemoryAuditLogRepository
          ? this.auditLogsRepo.getSnapshot()
          : [],
    };
  }

  /**
   * Restores database state to a previously captured snapshot.
   */
  public restoreSnapshot(snapshot: DatabaseStateSnapshot): void {
    this.restoreMap(this.organizations, snapshot.organizations);
    this.restoreMap(this.users, snapshot.users);
    this.restoreMap(this.memberships, snapshot.memberships);
    this.restoreMap(this.customers, snapshot.customers);
    this.restoreMap(this.contracts, snapshot.contracts);
    this.restoreMap(this.transactions, snapshot.transactions);
    this.restoreMap(this.documents, snapshot.documents);
    this.restoreMap(this.knowledge, snapshot.knowledge);
    this.restoreMap(this.memory, snapshot.memory);
    this.restoreMap(this.events, snapshot.events);
    this.restoreMap(this.signals, snapshot.signals);
    this.restoreMap(this.opportunities, snapshot.opportunities);
    this.restoreMap(this.valueCaptured, snapshot.valueCaptured);
    this.restoreMap(this.workflows, snapshot.workflows);
    this.restoreMap(this.workflowRuns, snapshot.workflowRuns);
    this.restoreMap(this.actions, snapshot.actions);
    if (this.auditLogsRepo instanceof InMemoryAuditLogRepository) {
      this.auditLogsRepo.restoreSnapshot(snapshot.auditLogs);
    }
  }

  /**
   * Executes a business operation within an atomic transaction / Unit of Work.
   * 
   * Guarantees:
   * 1. Multi-repository atomicity: all mutations commit together or roll back on error.
   * 2. Audit atomicity: business audit logs roll back if the business operation fails.
   * 3. Tenant immutability: tenant context is locked for the duration of the transaction.
   * 4. Error preservation: original domain error instances and types are preserved on rollback.
   * 5. Nested participation: nested transactions participate in the ambient transaction
   *    and enforce matching tenant isolation.
   */
  public async runInTransaction<T>(
    ctx: TenantContext,
    work: (uow: IUnitOfWork) => Promise<T>
  ): Promise<T> {
    if (
      !ctx ||
      !ctx.organizationId ||
      typeof ctx.organizationId !== "string" ||
      ctx.organizationId.trim().length === 0
    ) {
      throw new ValidationError("TenantContext with a valid organizationId is required for transaction execution");
    }

    // Nested transaction handling (Propagation: REQUIRED)
    if (this.activeTransactionContext) {
      if (this.activeTransactionContext.organizationId !== ctx.organizationId) {
        throw new CrossTenantViolationError(ctx.organizationId, this.activeTransactionContext.organizationId);
      }

      const nestedUow = new InMemoryUnitOfWork(
        this.activeTransactionContext,
        this.customersRepo,
        this.contractsRepo,
        this.transactionsRepo,
        this.signalsRepo,
        this.opportunitiesRepo,
        this.valueCapturedRepo,
        this.memoryRepo,
        this.actionsRepo,
        this.documentsRepo,
        this.knowledgeRepo,
        this.workflowsRepo,
        this.workflowRunsRepo,
        this.auditLogsRepo,
        this
      );

      return work(nestedUow);
    }

    // New top-level transaction boundary
    const snapshot = this.createSnapshot();
    const uow = new InMemoryUnitOfWork(
      ctx,
      this.customersRepo,
      this.contractsRepo,
      this.transactionsRepo,
      this.signalsRepo,
      this.opportunitiesRepo,
      this.valueCapturedRepo,
      this.memoryRepo,
      this.actionsRepo,
      this.documentsRepo,
      this.knowledgeRepo,
      this.workflowsRepo,
      this.workflowRunsRepo,
      this.auditLogsRepo,
      this
    );

    this.activeTransactionContext = uow.context;

    try {
      const result = await work(uow);
      return result;
    } catch (error) {
      this.restoreSnapshot(snapshot);
      throw error;
    } finally {
      this.activeTransactionContext = null;
    }
  }
}

export const db = new DatabaseStore();
