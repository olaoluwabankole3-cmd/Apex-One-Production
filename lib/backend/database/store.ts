/**
 * APEX ONE — Multi-Tenant Backend Database Store
 *
 * Development/tests use the deterministic in-memory adapter. Production is
 * composed explicitly through the Stage 4F infrastructure root and must select
 * PostgreSQL; DatabaseStore itself no longer owns a process-global default.
 */

import { AsyncLocalStorage } from "node:async_hooks";
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
import type {
  CertificationRecord,
  ProvenanceRecord,
  VerificationRecord,
} from "../domains/evidence/model";
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
import type {
  ICertificationRepository,
  IProvenanceRepository,
  IVerificationRepository,
} from "./evidenceRepository";
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
import {
  InMemoryCertificationRepository,
  InMemoryProvenanceRepository,
  InMemoryVerificationRepository,
} from "./adapters/inMemory/InMemoryEvidenceRepositories";
import { PostgresIntegrityPersistence } from "./adapters/postgres/PostgresIntegrityPersistence";
import {
  PostgresCertificationRepository,
  PostgresProvenanceRepository,
  PostgresVerificationRepository,
} from "./adapters/postgres/PostgresEvidenceRepositories";
import { IDataProvider, ProductionDataProvider } from "./demoDataProvider";
import {
  TenantContext,
  ConflictError,
  CrossTenantViolationError,
  ValidationError,
} from "../core/errors";
import { IUnitOfWork, IUnitOfWorkProvider, InMemoryUnitOfWork } from "./unitOfWork";
import { isProductionInfrastructureEnvironment } from "../infrastructure/runtime";

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
  provenance: Map<string, ProvenanceRecord>;
  verifications: Map<string, VerificationRecord>;
  certifications: Map<string, CertificationRecord>;
  auditLogs: AuditLogRecord[];
}

export interface DatabaseStoreOptions {
  adapter?: "memory" | "postgres";
  databaseUrl?: string;
}

interface InMemoryTransactionState {
  context: Readonly<TenantContext>;
  active: boolean;
}

export class DatabaseStore implements IUnitOfWorkProvider {
  // Compatibility collections remain available for deterministic test fixtures.
  // They are intentionally NOT authoritative when postgresPersistence is set.
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
  public provenance: Map<string, ProvenanceRecord> = new Map();
  public verifications: Map<string, VerificationRecord> = new Map();
  public certifications: Map<string, CertificationRecord> = new Map();

  public customersRepo: ICustomerRepository;
  public contractsRepo: IContractRepository;
  public transactionsRepo: ITransactionRepository;
  public signalsRepo: ISignalRepository;
  public opportunitiesRepo: IValueOpportunityRepository;
  public valueCapturedRepo: IValueCapturedRepository;
  public memoryRepo: IOrganizationalMemoryRepository;
  public actionsRepo: IActionRepository;
  public documentsRepo: IDocumentRepository;
  public knowledgeRepo: IKnowledgeRepository;
  public workflowsRepo: IWorkflowRepository;
  public workflowRunsRepo: IWorkflowRunRepository;
  public provenanceRepo: IProvenanceRepository;
  public verificationsRepo: IVerificationRepository;
  public certificationsRepo: ICertificationRepository;
  public auditLogsRepo: IAuditLogRepository;

  private readonly postgresPersistence?: PostgresIntegrityPersistence;
  private readonly inMemoryTransactionState = new AsyncLocalStorage<InMemoryTransactionState>();
  private inMemoryTransactionTail: Promise<void> = Promise.resolve();

  constructor(
    dataProvider: IDataProvider = new ProductionDataProvider(),
    options: DatabaseStoreOptions = {}
  ) {
    const adapter = options.adapter || "memory";
    const productionRuntime =
      process.env.TEST_ENV !== "true" && isProductionInfrastructureEnvironment(process.env);

    if (productionRuntime && adapter !== "postgres") {
      throw new ValidationError(
        "Production DatabaseStore must be created through the explicit PostgreSQL provider factory"
      );
    }

    if (adapter === "postgres") {
      const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new ValidationError("DATABASE_URL is required when the PostgreSQL database adapter is selected");
      }
      const pg = new PostgresIntegrityPersistence(databaseUrl);
      this.postgresPersistence = pg;
      this.customersRepo = pg.customersRepo;
      this.contractsRepo = pg.contractsRepo;
      this.transactionsRepo = pg.transactionsRepo;
      this.signalsRepo = pg.signalsRepo;
      this.opportunitiesRepo = pg.opportunitiesRepo;
      this.valueCapturedRepo = pg.valueCapturedRepo;
      this.memoryRepo = pg.memoryRepo;
      this.actionsRepo = pg.actionsRepo;
      this.documentsRepo = pg.documentsRepo;
      this.knowledgeRepo = pg.knowledgeRepo;
      this.workflowsRepo = pg.workflowsRepo;
      this.workflowRunsRepo = pg.workflowRunsRepo;
      this.provenanceRepo = new PostgresProvenanceRepository(pg.manager);
      this.verificationsRepo = new PostgresVerificationRepository(pg.manager);
      this.certificationsRepo = new PostgresCertificationRepository(pg.manager);
      this.auditLogsRepo = pg.auditLogsRepo;
      return;
    }

    const handleViolation = (ctx: TenantContext, resourceId: string, attemptedOrg: string) => {
      void this.recordAuditLog({
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

    this.customersRepo = new InMemoryCustomerRepository("Customer", this.customers, handleViolation, this);
    this.contractsRepo = new InMemoryContractRepository("Contract", this.contracts, handleViolation, this);
    this.transactionsRepo = new InMemoryTransactionRepository("Transaction", this.transactions, handleViolation, this);
    this.signalsRepo = new InMemorySignalRepository("Signal", this.signals, handleViolation, this);
    this.opportunitiesRepo = new InMemoryValueOpportunityRepository("ValueOpportunity", this.opportunities, handleViolation, this);
    this.valueCapturedRepo = new InMemoryValueCapturedRepository("ValueCaptured", this.valueCaptured, handleViolation, this);
    this.memoryRepo = new InMemoryOrganizationalMemoryRepository("OrganizationalMemory", this.memory, handleViolation);
    this.actionsRepo = new InMemoryActionRepository("Action", this.actions, handleViolation);
    this.documentsRepo = new InMemoryDocumentRepository("Document", this.documents, handleViolation, this);
    this.knowledgeRepo = new InMemoryKnowledgeRepository("Knowledge", this.knowledge, handleViolation, this);
    this.workflowsRepo = new InMemoryWorkflowRepository("Workflow", this.workflows, handleViolation, this);
    this.workflowRunsRepo = new InMemoryWorkflowRunRepository("WorkflowRun", this.workflowRuns, handleViolation, this);
    this.provenanceRepo = new InMemoryProvenanceRepository("Provenance", this.provenance, handleViolation);
    this.verificationsRepo = new InMemoryVerificationRepository("Verification", this.verifications, handleViolation);
    this.certificationsRepo = new InMemoryCertificationRepository("Certification", this.certifications, handleViolation);
    this.auditLogsRepo = new InMemoryAuditLogRepository();

    dataProvider.seedInitialTenants(this);
  }

  public static createFreshStore(dataProvider?: IDataProvider): DatabaseStore {
    return new DatabaseStore(dataProvider, { adapter: "memory" });
  }

  public static createPostgresStore(databaseUrl: string): DatabaseStore {
    return new DatabaseStore(new ProductionDataProvider(), { adapter: "postgres", databaseUrl });
  }

  public isPostgresBacked(): boolean {
    return this.postgresPersistence !== undefined;
  }

  public async bootstrapPersistence(): Promise<void> {
    await this.postgresPersistence?.bootstrap();
  }

  public async clearPersistentStateForTesting(): Promise<void> {
    if (!this.postgresPersistence) throw new ValidationError("Persistent state cleanup requires PostgreSQL adapter");
    await this.postgresPersistence.clearAllForTesting();
  }

  public clearAll(): void {
    if (this.postgresPersistence) {
      throw new ValidationError("Synchronous clearAll is unavailable for PostgreSQL-backed stores");
    }
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
    this.provenance.clear();
    this.verifications.clear();
    this.certifications.clear();
    if (this.auditLogsRepo instanceof InMemoryAuditLogRepository) this.auditLogsRepo.clear();
  }

  public reset(dataProvider?: IDataProvider): void {
    this.clearAll();
    if (dataProvider) dataProvider.seedInitialTenants(this);
  }

  public recordAuditLog(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord> {
    return this.auditLogsRepo.record(log);
  }

  public getOrganizationById(id: string): OrganizationRecord | undefined {
    if (this.postgresPersistence) throw new ValidationError("Use findOrganizationById for PostgreSQL-backed identity state");
    return this.organizations.get(id);
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    if (this.postgresPersistence) throw new ValidationError("Use findUserByEmail for PostgreSQL-backed identity state");
    for (const user of this.users.values()) if (user.email.toLowerCase() === email.toLowerCase()) return user;
    return undefined;
  }

  public getUserByLoginIdentifier(identifier: string): UserRecord | undefined {
    if (this.postgresPersistence) {
      throw new ValidationError("Use findUserByLoginIdentifier for PostgreSQL-backed identity state");
    }
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return undefined;
    for (const user of this.users.values()) {
      if (user.email.trim().toLowerCase() === normalized) return user;
      if (user.username?.trim().toLowerCase() === normalized) return user;
    }
    return undefined;
  }

  public getUserMembership(userId: string, orgId: string): OrganizationMembershipRecord | undefined {
    if (this.postgresPersistence) throw new ValidationError("Use findUserMembership for PostgreSQL-backed identity state");
    for (const membership of this.memberships.values()) {
      if (membership.userId === userId && membership.organizationId === orgId) return membership;
    }
    return undefined;
  }

  public async findOrganizationById(id: string): Promise<OrganizationRecord | undefined> {
    return this.postgresPersistence ? this.postgresPersistence.getOrganizationById(id) : this.organizations.get(id);
  }

  public async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    if (this.postgresPersistence) return this.postgresPersistence.getUserByEmail(email);
    return this.getUserByEmail(email);
  }

  public async findUserByLoginIdentifier(identifier: string): Promise<UserRecord | undefined> {
    if (this.postgresPersistence) return this.postgresPersistence.getUserByLoginIdentifier(identifier);
    return this.getUserByLoginIdentifier(identifier);
  }

  public async findUserById(id: string): Promise<UserRecord | undefined> {
    return this.postgresPersistence ? this.postgresPersistence.getUserById(id) : this.users.get(id);
  }

  public async findUserMembership(userId: string, orgId: string): Promise<OrganizationMembershipRecord | undefined> {
    return this.postgresPersistence ? this.postgresPersistence.getMembership(userId, orgId) : this.getUserMembership(userId, orgId);
  }

  public async findMembershipsForUser(userId: string): Promise<OrganizationMembershipRecord[]> {
    if (this.postgresPersistence) return this.postgresPersistence.getMembershipsForUser(userId);
    return Array.from(this.memberships.values()).filter((membership) => membership.userId === userId);
  }

  public async updateUserPasswordCredentials(
    userId: string,
    organizationId: string,
    credentials: { passwordHash: string; passwordSalt: string }
  ): Promise<UserRecord | undefined> {
    if (this.postgresPersistence) {
      return this.postgresPersistence.updatePasswordCredentials(
        userId,
        organizationId,
        credentials.passwordHash,
        credentials.passwordSalt
      );
    }
    const membership = this.getUserMembership(userId, organizationId);
    if (!membership) return undefined;
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, ...credentials, passwordChangeRequired: false };
    this.users.set(userId, updated);
    return updated;
  }

  public async createOrganizationRecord(record: OrganizationRecord): Promise<OrganizationRecord> {
    if (this.postgresPersistence) return this.postgresPersistence.createOrganization(record);
    const normalizedSlug = record.slug.trim().toLowerCase();
    const duplicate =
      this.organizations.has(record.id) ||
      Array.from(this.organizations.values()).some(
        (organization) => organization.slug.trim().toLowerCase() === normalizedSlug
      );
    if (duplicate) {
      throw new ConflictError("Organization violates a uniqueness constraint", { resource: "Organization" });
    }
    this.organizations.set(record.id, record);
    return record;
  }

  public async createUserRecord(record: UserRecord): Promise<UserRecord> {
    const normalizedEmail = record.email.trim().toLowerCase();
    const normalizedUsername = record.username?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new ValidationError("User email is required");
    }
    if (record.username !== undefined && !normalizedUsername) {
      throw new ValidationError("Username must be non-empty when provided");
    }

    if (this.postgresPersistence) return this.postgresPersistence.createUser(record);

    const duplicate =
      this.users.has(record.id) ||
      Array.from(this.users.values()).some((user) => {
        if (user.email.trim().toLowerCase() === normalizedEmail) return true;
        return Boolean(
          normalizedUsername &&
            user.username?.trim().toLowerCase() === normalizedUsername
        );
      });
    if (duplicate) {
      throw new ConflictError("User violates a uniqueness constraint", { resource: "User" });
    }
    this.users.set(record.id, record);
    return record;
  }

  public async createMembershipRecord(record: OrganizationMembershipRecord): Promise<OrganizationMembershipRecord> {
    if (this.postgresPersistence) return this.postgresPersistence.createMembership(record);
    const duplicate =
      this.memberships.has(record.id) ||
      Array.from(this.memberships.values()).some(
        (membership) =>
          membership.organizationId === record.organizationId && membership.userId === record.userId
      );
    if (duplicate) {
      throw new ConflictError("OrganizationMembership violates a uniqueness constraint", {
        resource: "OrganizationMembership",
      });
    }
    this.memberships.set(record.id, record);
    return record;
  }

  private cloneMap<T>(source: Map<string, T>): Map<string, T> {
    const target = new Map<string, T>();
    for (const [key, value] of source.entries()) {
      target.set(key, typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
    }
    return target;
  }

  private restoreMap<T>(target: Map<string, T>, snapshot: Map<string, T>): void {
    target.clear();
    for (const [key, value] of snapshot.entries()) target.set(key, value);
  }

  private async withInMemoryTransactionLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.inMemoryTransactionTail;
    let release!: () => void;
    this.inMemoryTransactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  public createSnapshot(): DatabaseStateSnapshot {
    if (this.postgresPersistence) throw new ValidationError("PostgreSQL transactions do not use in-memory snapshots");
    return {
      organizations: this.cloneMap(this.organizations), users: this.cloneMap(this.users), memberships: this.cloneMap(this.memberships),
      customers: this.cloneMap(this.customers), contracts: this.cloneMap(this.contracts), transactions: this.cloneMap(this.transactions),
      documents: this.cloneMap(this.documents), knowledge: this.cloneMap(this.knowledge), memory: this.cloneMap(this.memory), events: this.cloneMap(this.events),
      signals: this.cloneMap(this.signals), opportunities: this.cloneMap(this.opportunities), valueCaptured: this.cloneMap(this.valueCaptured),
      workflows: this.cloneMap(this.workflows), workflowRuns: this.cloneMap(this.workflowRuns), actions: this.cloneMap(this.actions),
      provenance: this.cloneMap(this.provenance), verifications: this.cloneMap(this.verifications), certifications: this.cloneMap(this.certifications),
      auditLogs: this.auditLogsRepo instanceof InMemoryAuditLogRepository ? this.auditLogsRepo.getSnapshot() : [],
    };
  }

  public restoreSnapshot(snapshot: DatabaseStateSnapshot): void {
    if (this.postgresPersistence) throw new ValidationError("PostgreSQL transactions do not use in-memory snapshots");
    this.restoreMap(this.organizations, snapshot.organizations); this.restoreMap(this.users, snapshot.users); this.restoreMap(this.memberships, snapshot.memberships);
    this.restoreMap(this.customers, snapshot.customers); this.restoreMap(this.contracts, snapshot.contracts); this.restoreMap(this.transactions, snapshot.transactions);
    this.restoreMap(this.documents, snapshot.documents); this.restoreMap(this.knowledge, snapshot.knowledge); this.restoreMap(this.memory, snapshot.memory);
    this.restoreMap(this.events, snapshot.events); this.restoreMap(this.signals, snapshot.signals); this.restoreMap(this.opportunities, snapshot.opportunities);
    this.restoreMap(this.valueCaptured, snapshot.valueCaptured); this.restoreMap(this.workflows, snapshot.workflows); this.restoreMap(this.workflowRuns, snapshot.workflowRuns);
    this.restoreMap(this.actions, snapshot.actions); this.restoreMap(this.provenance, snapshot.provenance); this.restoreMap(this.verifications, snapshot.verifications);
    this.restoreMap(this.certifications, snapshot.certifications);
    if (this.auditLogsRepo instanceof InMemoryAuditLogRepository) this.auditLogsRepo.restoreSnapshot(snapshot.auditLogs);
  }

  public async runInTransaction<T>(ctx: TenantContext, work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    if (!ctx?.organizationId || typeof ctx.organizationId !== "string" || ctx.organizationId.trim().length === 0) {
      throw new ValidationError("TenantContext with a valid organizationId is required for transaction execution");
    }

    if (this.postgresPersistence) return this.postgresPersistence.runInTransaction(ctx, work);

    const activeState = this.inMemoryTransactionState.getStore();
    if (activeState) {
      if (!activeState.active) {
        throw new ValidationError("In-memory transaction context is no longer active");
      }
      if (activeState.context.organizationId !== ctx.organizationId) {
        throw new CrossTenantViolationError(ctx.organizationId, activeState.context.organizationId);
      }
      const nestedUow = new InMemoryUnitOfWork(
        activeState.context, this.customersRepo, this.contractsRepo, this.transactionsRepo, this.signalsRepo,
        this.opportunitiesRepo, this.valueCapturedRepo, this.memoryRepo, this.actionsRepo, this.documentsRepo,
        this.knowledgeRepo, this.workflowsRepo, this.workflowRunsRepo, this.auditLogsRepo, this
      );
      return work(nestedUow);
    }

    return this.withInMemoryTransactionLock(async () => {
      const snapshot = this.createSnapshot();
      const uow = new InMemoryUnitOfWork(
        ctx, this.customersRepo, this.contractsRepo, this.transactionsRepo, this.signalsRepo,
        this.opportunitiesRepo, this.valueCapturedRepo, this.memoryRepo, this.actionsRepo, this.documentsRepo,
        this.knowledgeRepo, this.workflowsRepo, this.workflowRunsRepo, this.auditLogsRepo, this
      );
      const state: InMemoryTransactionState = { context: uow.context, active: true };

      return this.inMemoryTransactionState.run(state, async () => {
        try {
          return await work(uow);
        } catch (error) {
          this.restoreSnapshot(snapshot);
          throw error;
        } finally {
          state.active = false;
        }
      });
    });
  }
}
