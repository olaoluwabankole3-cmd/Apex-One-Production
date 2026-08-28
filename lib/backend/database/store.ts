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
import { TenantContext } from "../core/errors";

export class DatabaseStore {
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
}

export const db = new DatabaseStore();
