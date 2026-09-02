import {
  ConflictError,
  NotFoundError,
  TenantContext,
  ValidationError,
} from "../../../core/errors";
import {
  ActionRecord,
  AuditLogRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UpdateActionInput,
  UpdateDocumentInput,
  UpdateKnowledgeItemInput,
  UpdateValueOpportunityInput,
  UpdateWorkflowInput,
  UpdateWorkflowRunInput,
  UserRecord,
  ValueOpportunityRecord,
  WorkflowRecord,
  WorkflowRunRecord,
} from "../../schema";
import {
  IActionRepository,
  IAuditLogRepository,
  IContractRepository,
  ICustomerRepository,
  IDocumentRepository,
  IKnowledgeRepository,
  IOrganizationalMemoryRepository,
  ISignalRepository,
  ITransactionRepository,
  ITenantScopedRepository,
  IValueCapturedRepository,
  IValueOpportunityRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "../../repository";
import { IUnitOfWork, InMemoryUnitOfWork } from "../../unitOfWork";
import {
  assertForwardStateTransition,
  assertNextIntegerValue,
  assertNoImmutableFieldMutation,
} from "../../repositoryIntegrity";
import {
  PostgresConnectionManager,
  PostgresPersistence,
} from "./PostgresPersistence";
import {
  PostgresQueryError,
  PostgresWireConnection,
  quotePostgresLiteral,
} from "./PostgresWireClient";

const ACTION_STATUS_TRANSITIONS: Record<ActionRecord["status"], ActionRecord["status"][]> = {
  Ready: ["Approved"],
  Approved: ["In Progress"],
  "In Progress": ["Completed"],
  Completed: ["Measured"],
  Measured: [],
};

const DOCUMENT_STATUS_TRANSITIONS: Record<DocumentRecord["status"], DocumentRecord["status"][]> = {
  uploading: ["processing", "failed", "archived"],
  processing: ["indexed", "failed", "archived"],
  indexed: ["archived"],
  failed: ["processing", "archived"],
  archived: [],
};

const OPPORTUNITY_STATUS_TRANSITIONS: Record<ValueOpportunityRecord["status"], ValueOpportunityRecord["status"][]> = {
  Identified: ["Validated"],
  Validated: ["Approved"],
  Approved: ["Executing"],
  Executing: ["Captured"],
  Captured: [],
};

const WORKFLOW_RUN_STATUS_TRANSITIONS: Record<WorkflowRunRecord["status"], WorkflowRunRecord["status"][]> = {
  pending: ["running", "failed", "cancelled"],
  running: ["waiting_approval", "completed", "failed", "cancelled"],
  waiting_approval: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const TERMINAL_WORKFLOW_RUN_STATUSES = new Set<WorkflowRunRecord["status"]>([
  "completed",
  "failed",
  "cancelled",
]);

const EXTRA_IMMUTABLE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Document: ["fileType", "size", "uploadedBy", "storageKey"],
  KnowledgeItem: ["author"],
  WorkflowRun: ["workflowId", "workflowVersion", "triggeredBy", "triggerType"],
};

function hasDefinedUpdate(updates: Record<string, unknown>): boolean {
  return Object.values(updates).some((value) => value !== undefined);
}

function parseRecord<T>(row: Record<string, string | null> | undefined): T | undefined {
  const raw = row?.record;
  return raw ? (JSON.parse(raw) as T) : undefined;
}

function mapConcurrencyConflict(error: unknown): never {
  if (
    error instanceof PostgresQueryError &&
    (error.code === "40001" || error.code === "40P01")
  ) {
    throw new ConflictError("Concurrent transaction conflict; retry the operation", {
      retryable: true,
      databaseCode: error.code,
    });
  }
  throw error;
}

async function withIntegrityTransaction<T>(
  manager: PostgresConnectionManager,
  ctx: TenantContext,
  work: (connection: PostgresWireConnection) => Promise<T>
): Promise<T> {
  const nested = manager.currentConnection() !== undefined;
  try {
    return await manager.runInTransaction(ctx, async (connection) => {
      if (!nested) {
        await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      }
      return work(connection);
    });
  } catch (error) {
    mapConcurrencyConflict(error);
  }
}

async function lockTenantRecord<T extends { id: string; organizationId: string }>(
  connection: PostgresWireConnection,
  entityType: string,
  id: string,
  ctx: TenantContext,
  resourceName: string
): Promise<T> {
  const result = await connection.query(
    `SELECT record::text AS record FROM apex_domain_records
     WHERE entity_type = ${quotePostgresLiteral(entityType)}
       AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}
       AND id = ${quotePostgresLiteral(id)}
     FOR UPDATE`
  );
  const record = parseRecord<T>(result.rows[0]);
  if (!record) throw new NotFoundError(resourceName);
  return record;
}

function assertLifecycleUpdate(
  entityType: string,
  existing: Record<string, any>,
  updates: Record<string, any>
): void {
  assertNoImmutableFieldMutation(
    updates,
    entityType,
    EXTRA_IMMUTABLE_FIELDS[entityType] || []
  );

  if (entityType === "Action") {
    const action = existing as ActionRecord;
    const next = updates as UpdateActionInput;
    if (action.status === "Measured" && hasDefinedUpdate(updates)) {
      throw new ConflictError("Measured Action records are terminal and immutable");
    }
    assertForwardStateTransition("Action", action.status, next.status, ACTION_STATUS_TRANSITIONS);
    return;
  }

  if (entityType === "Document") {
    const document = existing as DocumentRecord;
    const next = updates as UpdateDocumentInput;
    if (document.status === "archived" && hasDefinedUpdate(updates)) {
      throw new ConflictError("Archived Document records are terminal and immutable");
    }
    assertForwardStateTransition("Document", document.status, next.status, DOCUMENT_STATUS_TRANSITIONS);
    return;
  }

  if (entityType === "ValueOpportunity") {
    const opportunity = existing as ValueOpportunityRecord;
    const next = updates as UpdateValueOpportunityInput;
    if (opportunity.status === "Captured" && hasDefinedUpdate(updates)) {
      throw new ConflictError("Captured ValueOpportunity records are terminal and immutable");
    }
    assertForwardStateTransition(
      "ValueOpportunity",
      opportunity.status,
      next.status,
      OPPORTUNITY_STATUS_TRANSITIONS
    );
    return;
  }

  if (entityType === "KnowledgeItem") {
    const item = existing as KnowledgeItemRecord;
    assertNextIntegerValue(
      "KnowledgeItem",
      "version",
      item.version,
      (updates as UpdateKnowledgeItemInput).version
    );
    return;
  }

  if (entityType === "Workflow") {
    const workflow = existing as WorkflowRecord;
    const next = updates as UpdateWorkflowInput;
    assertNextIntegerValue("Workflow", "version", workflow.version, next.version);
    assertNextIntegerValue("Workflow", "runsCount", workflow.runsCount, next.runsCount);
    return;
  }

  if (entityType === "WorkflowRun") {
    const run = existing as WorkflowRunRecord;
    const next = updates as UpdateWorkflowRunInput;
    if (TERMINAL_WORKFLOW_RUN_STATUSES.has(run.status) && hasDefinedUpdate(updates)) {
      throw new ConflictError("Terminal WorkflowRun records are immutable");
    }
    assertForwardStateTransition(
      "WorkflowRun",
      run.status,
      next.status,
      WORKFLOW_RUN_STATUS_TRANSITIONS
    );
    const nextStatus = next.status ?? run.status;
    if (next.completedAt !== undefined && !TERMINAL_WORKFLOW_RUN_STATUSES.has(nextStatus)) {
      throw new ValidationError("WorkflowRun completedAt can only be set for a terminal status");
    }
    if (
      next.status !== undefined &&
      TERMINAL_WORKFLOW_RUN_STATUSES.has(next.status) &&
      !run.completedAt &&
      next.completedAt === undefined
    ) {
      throw new ValidationError("Terminal WorkflowRun transitions must set completedAt");
    }
  }
}

function wrapTenantRepository<T extends object>(
  delegate: T,
  entityType: string,
  manager: PostgresConnectionManager
): T {
  const repository = delegate as unknown as ITenantScopedRepository<any, any>;

  return new Proxy(delegate, {
    get(target, property, receiver) {
      if (property === "create") {
        return async (data: any, ctx: TenantContext) =>
          withIntegrityTransaction(manager, ctx, async () => repository.create(data, ctx));
      }

      if (property === "update") {
        return async (
          id: string,
          updates: Record<string, unknown>,
          ctx: TenantContext,
          resourceName: string = entityType
        ) =>
          withIntegrityTransaction(manager, ctx, async (connection) => {
            const current = await lockTenantRecord<any>(
              connection,
              entityType,
              id,
              ctx,
              resourceName
            );
            assertLifecycleUpdate(entityType, current, updates);
            return repository.update(id, updates, ctx, resourceName);
          });
      }

      if (property === "delete") {
        return async (
          id: string,
          ctx: TenantContext,
          resourceName: string = entityType
        ) =>
          withIntegrityTransaction(manager, ctx, async (connection) => {
            await lockTenantRecord<any>(connection, entityType, id, ctx, resourceName);
            return repository.delete(id, ctx, resourceName);
          });
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export class PostgresIntegrityPersistence {
  public readonly manager: PostgresConnectionManager;
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

  private readonly persistence: PostgresPersistence;

  constructor(connectionString: string) {
    this.persistence = new PostgresPersistence(connectionString);
    this.manager = this.persistence.manager;
    this.customersRepo = wrapTenantRepository(this.persistence.customersRepo, "Customer", this.manager);
    this.contractsRepo = wrapTenantRepository(this.persistence.contractsRepo, "Contract", this.manager);
    this.transactionsRepo = wrapTenantRepository(this.persistence.transactionsRepo, "Transaction", this.manager);
    this.signalsRepo = wrapTenantRepository(this.persistence.signalsRepo, "Signal", this.manager);
    this.opportunitiesRepo = wrapTenantRepository(this.persistence.opportunitiesRepo, "ValueOpportunity", this.manager);
    this.valueCapturedRepo = wrapTenantRepository(this.persistence.valueCapturedRepo, "ValueCaptured", this.manager);
    this.memoryRepo = wrapTenantRepository(this.persistence.memoryRepo, "OrganizationalMemory", this.manager);
    this.actionsRepo = wrapTenantRepository(this.persistence.actionsRepo, "Action", this.manager);
    this.documentsRepo = wrapTenantRepository(this.persistence.documentsRepo, "Document", this.manager);
    this.knowledgeRepo = wrapTenantRepository(this.persistence.knowledgeRepo, "KnowledgeItem", this.manager);
    this.workflowsRepo = wrapTenantRepository(this.persistence.workflowsRepo, "Workflow", this.manager);
    this.workflowRunsRepo = wrapTenantRepository(this.persistence.workflowRunsRepo, "WorkflowRun", this.manager);
    this.auditLogsRepo = this.persistence.auditLogsRepo;
  }

  public bootstrap(): Promise<void> {
    return this.persistence.bootstrap();
  }

  public clearAllForTesting(): Promise<void> {
    return this.persistence.clearAllForTesting();
  }

  public async createOrganization(record: OrganizationRecord): Promise<OrganizationRecord> {
    return this.persistence.createOrganization({ ...record, slug: record.slug.trim() });
  }

  public async createUser(record: UserRecord): Promise<UserRecord> {
    return this.persistence.createUser({ ...record, email: record.email.trim() });
  }

  public createMembership(record: OrganizationMembershipRecord): Promise<OrganizationMembershipRecord> {
    return this.persistence.createMembership(record);
  }

  public getOrganizationById(id: string): Promise<OrganizationRecord | undefined> {
    return this.persistence.getOrganizationById(id);
  }

  public getUserByEmail(email: string): Promise<UserRecord | undefined> {
    return this.persistence.getUserByEmail(email);
  }

  public getUserById(id: string): Promise<UserRecord | undefined> {
    return this.persistence.getUserById(id);
  }

  public getMembership(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMembershipRecord | undefined> {
    return this.persistence.getMembership(userId, organizationId);
  }

  public getMembershipsForUser(userId: string): Promise<OrganizationMembershipRecord[]> {
    return this.persistence.getMembershipsForUser(userId);
  }

  public updatePasswordCredentials(
    userId: string,
    organizationId: string,
    passwordHash: string,
    passwordSalt: string
  ): Promise<UserRecord | undefined> {
    return this.persistence.updatePasswordCredentials(
      userId,
      organizationId,
      passwordHash,
      passwordSalt
    );
  }

  private buildUnitOfWork(ctx: TenantContext): IUnitOfWork {
    return new InMemoryUnitOfWork(
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
      { recordAuditLog: (log: Omit<AuditLogRecord, "id">) => this.auditLogsRepo.record(log) }
    );
  }

  public async runInTransaction<T>(
    ctx: TenantContext,
    work: (uow: IUnitOfWork) => Promise<T>
  ): Promise<T> {
    const nested = this.manager.currentConnection() !== undefined;
    try {
      return await this.manager.runInTransaction(ctx, async (connection) => {
        if (!nested) {
          await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        }
        return work(this.buildUnitOfWork(ctx));
      });
    } catch (error) {
      mapConcurrencyConflict(error);
    }
  }
}
