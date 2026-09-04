import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  ConflictError,
  CrossTenantViolationError,
  NotFoundError,
  TenantContext,
  ValidationError,
} from "../../../core/errors";
import { Validator } from "../../../core/validation";
import {
  ActionRecord,
  AuditLogRecord,
  ContractRecord,
  CustomerRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  OrganizationalMemoryRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  SignalRecord,
  TransactionRecord,
  UpdateActionInput,
  UpdateContractInput,
  UpdateCustomerInput,
  UpdateDocumentInput,
  UpdateKnowledgeItemInput,
  UpdateOrganizationalMemoryInput,
  UpdateSignalInput,
  UpdateTransactionInput,
  UpdateValueCapturedInput,
  UpdateValueOpportunityInput,
  UpdateWorkflowInput,
  UpdateWorkflowRunInput,
  UserRecord,
  ValueCapturedRecord,
  ValueOpportunityRecord,
  WorkflowRecord,
  WorkflowRunRecord,
} from "../../schema";
import {
  FinancialTotalsByCurrency,
  FinancialTotalsResult,
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
  PaginatedResult,
  QuerySpecification,
} from "../../repository";
import {
  applyQuerySpecificationPaginated,
  matchesSpecification,
} from "../../querySpecification";
import { IUnitOfWork, InMemoryUnitOfWork } from "../../unitOfWork";
import {
  PostgresQueryError,
  PostgresWireConnection,
  quotePostgresLiteral,
} from "./PostgresWireClient";

export const STAGE4_POSTGRES_MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS apex_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apex_organizations (
  id TEXT PRIMARY KEY,
  slug_normalized TEXT NOT NULL UNIQUE,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_organizations_record_id CHECK (record->>'id' = id)
);

CREATE TABLE IF NOT EXISTS apex_users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_users_record_id CHECK (record->>'id' = id)
);

CREATE TABLE IF NOT EXISTS apex_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES apex_organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES apex_users(id) ON DELETE RESTRICT,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT apex_memberships_unique_user_org UNIQUE (organization_id, user_id),
  CONSTRAINT apex_memberships_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_memberships_record_org CHECK (record->>'organizationId' = organization_id),
  CONSTRAINT apex_memberships_record_user CHECK (record->>'userId' = user_id)
);

CREATE TABLE IF NOT EXISTS apex_domain_records (
  entity_type TEXT NOT NULL,
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES apex_organizations(id) ON DELETE RESTRICT,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, id),
  CONSTRAINT apex_domain_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_domain_record_org CHECK (record->>'organizationId' = organization_id)
);

CREATE INDEX IF NOT EXISTS apex_domain_records_tenant_type_idx
  ON apex_domain_records (organization_id, entity_type, id);
CREATE INDEX IF NOT EXISTS apex_domain_records_record_gin_idx
  ON apex_domain_records USING GIN (record jsonb_path_ops);

CREATE TABLE IF NOT EXISTS apex_audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL,
  CONSTRAINT apex_audit_record_id CHECK (record->>'id' = id),
  CONSTRAINT apex_audit_record_org CHECK (record->>'organizationId' = organization_id)
);

CREATE INDEX IF NOT EXISTS apex_audit_logs_tenant_time_idx
  ON apex_audit_logs (organization_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS apex_audit_logs_record_gin_idx
  ON apex_audit_logs USING GIN (record jsonb_path_ops);
;

export const PHASE2_AUTH_IDENTITY_MIGRATION_004 = `
CREATE UNIQUE INDEX IF NOT EXISTS apex_users_username_normalized_unique_idx
  ON apex_users ((LOWER(BTRIM(record->>'username'))))
  WHERE NULLIF(BTRIM(record->>'username'), '') IS NOT NULL;
`;

interface TransactionState {
  organizationId: string;
  connection: PostgresWireConnection;
}

export class PostgresConnectionManager {
  private readonly transactions = new AsyncLocalStorage<TransactionState>();
  private bootstrapPromise?: Promise<void>;

  constructor(public readonly connectionString: string) {
    if (!connectionString) throw new ValidationError("DATABASE_URL is required for PostgreSQL persistence");
  }

  public currentConnection(): PostgresWireConnection | undefined {
    return this.transactions.getStore()?.connection;
  }

  public async bootstrap(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapInternal().catch((error) => {
        this.bootstrapPromise = undefined;
        throw error;
      });
    }
    return this.bootstrapPromise;
  }

  private async bootstrapInternal(): Promise<void> {
    const connection = await PostgresWireConnection.connect(this.connectionString);
    try {
      await connection.query("BEGIN");
      await connection.query(STAGE4_POSTGRES_MIGRATION_001);
      await connection.query(
        `INSERT INTO apex_schema_migrations(version) VALUES ('001_stage4_core') ON CONFLICT (version) DO NOTHING`
      );
      await connection.query(PHASE2_AUTH_IDENTITY_MIGRATION_004);
      await connection.query(
        `INSERT INTO apex_schema_migrations(version) VALUES ('004_phase2_auth_identity') ON CONFLICT (version) DO NOTHING`
      );
      await connection.query("COMMIT");
    } catch (error) {
      try { await connection.query("ROLLBACK"); } catch { /* preserve original migration error */ }
      throw error;
    } finally {
      await connection.close();
    }
  }

  public async withConnection<T>(work: (connection: PostgresWireConnection) => Promise<T>): Promise<T> {
    const active = this.currentConnection();
    if (active) return work(active);

    await this.bootstrap();
    const connection = await PostgresWireConnection.connect(this.connectionString);
    try {
      return await work(connection);
    } finally {
      await connection.close();
    }
  }

  public async runInTransaction<T>(
    ctx: TenantContext,
    work: (connection: PostgresWireConnection) => Promise<T>
  ): Promise<T> {
    const active = this.transactions.getStore();
    if (active) {
      if (active.organizationId !== ctx.organizationId) {
        throw new CrossTenantViolationError(ctx.organizationId, active.organizationId);
      }
      return work(active.connection);
    }

    await this.bootstrap();
    const connection = await PostgresWireConnection.connect(this.connectionString);
    await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");

    try {
      const result = await this.transactions.run(
        { organizationId: ctx.organizationId, connection },
        () => work(connection)
      );
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      try { await connection.query("ROLLBACK"); } catch { /* preserve original domain error */ }
      throw error;
    } finally {
      await connection.close();
    }
  }

  public async clearAllForTesting(): Promise<void> {
    await this.withConnection(async (connection) => {
      await connection.query(`
        TRUNCATE TABLE apex_audit_logs, apex_domain_records, apex_memberships, apex_users, apex_organizations
        RESTART IDENTITY CASCADE
      `);
    });
  }
}

function parseRecord<T>(row: Record<string, string | null> | undefined): T | undefined {
  const raw = row?.record;
  if (!raw) return undefined;
  return JSON.parse(raw) as T;
}

function sqlJson(value: unknown): string {
  return `${quotePostgresLiteral(JSON.stringify(value))}::jsonb`;
}

function mapPostgresConflict(error: unknown, resource: string): never {
  if (error instanceof PostgresQueryError && error.code === "23505") {
    throw new ConflictError(`${resource} violates a uniqueness constraint`, {
      resource,
      constraint: error.constraint,
    });
  }
  throw error;
}

const IMMUTABLE_UPDATE_FIELDS = new Set([
  "id",
  "organizationId",
  "createdAt",
  "detectedAt",
  "startedAt",
  "updatedAt",
]);

export class PostgresTenantRepository<
  T extends { id: string; organizationId: string },
  TUpdate = Partial<Omit<T, "id" | "organizationId" | "createdAt">>
> implements ITenantScopedRepository<T, TUpdate> {
  constructor(
    protected readonly entityType: string,
    protected readonly manager: PostgresConnectionManager
  ) {}

  protected async tenantRecords(ctx: TenantContext): Promise<T[]> {
    return this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `SELECT record::text AS record FROM apex_domain_records
         WHERE entity_type = ${quotePostgresLiteral(this.entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}`
      );
      return result.rows.map((row) => parseRecord<T>(row)!).filter(Boolean);
    });
  }

  protected async tenantRecordExists(entityType: string, id: string, ctx: TenantContext): Promise<boolean> {
    return this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `SELECT 1 AS found FROM apex_domain_records
         WHERE entity_type = ${quotePostgresLiteral(entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}
           AND id = ${quotePostgresLiteral(id)} LIMIT 1`
      );
      return result.rows.length === 1;
    });
  }

  protected async requireTenantRecord(entityType: string, id: unknown, ctx: TenantContext, resource: string): Promise<void> {
    if (typeof id !== "string" || id.trim().length === 0) throw new ValidationError(`${resource} identifier is required`);
    if (!(await this.tenantRecordExists(entityType, id.trim(), ctx))) throw new NotFoundError(resource);
  }

  protected async countDependencies(
    entityType: string,
    ctx: TenantContext,
    predicate: (record: any) => boolean
  ): Promise<number> {
    const records = await this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `SELECT record::text AS record FROM apex_domain_records
         WHERE entity_type = ${quotePostgresLiteral(entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}`
      );
      return result.rows.map((row) => parseRecord<any>(row)).filter(Boolean);
    });
    return records.filter(predicate).length;
  }

  protected async rejectDependency(
    resource: string,
    resourceId: string,
    dependency: string,
    count: number
  ): Promise<void> {
    if (count > 0) {
      throw new ConflictError(
        `Cannot delete ${resource} because dependent ${dependency} records exist (${count} found)`,
        { resource, resourceId, dependency, count }
      );
    }
  }

  public async findById(id: string, ctx: TenantContext, resourceName: string = this.entityType): Promise<T> {
    return this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `SELECT record::text AS record FROM apex_domain_records
         WHERE entity_type = ${quotePostgresLiteral(this.entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}
           AND id = ${quotePostgresLiteral(id)} LIMIT 1`
      );
      const record = parseRecord<T>(result.rows[0]);
      if (!record) throw new NotFoundError(resourceName);
      return record;
    });
  }

  public async findMany(ctx: TenantContext, query?: QuerySpecification<T>): Promise<PaginatedResult<T>> {
    const records = await this.tenantRecords(ctx);
    return applyQuerySpecificationPaginated(records, query, ctx.organizationId, this.entityType);
  }

  public async findOne(ctx: TenantContext, query?: QuerySpecification<T>): Promise<T | undefined> {
    const page = await this.findMany(ctx, { ...(query || {}), limit: 1, cursor: null });
    return page.items[0];
  }

  public async count(ctx: TenantContext, query?: QuerySpecification<T>): Promise<number> {
    const spec = query ? { where: query.where, search: query.search } : undefined;
    const records = await this.tenantRecords(ctx);
    return records.filter((record) => matchesSpecification(record, spec)).length;
  }

  protected async beforeCreate(_data: Omit<T, "organizationId">, _ctx: TenantContext): Promise<void> {}
  protected async beforeUpdate(_existing: T, _updates: TUpdate, _ctx: TenantContext): Promise<void> {}
  protected async beforeDelete(_existing: T, _ctx: TenantContext): Promise<void> {}

  public async create(data: Omit<T, "organizationId">, ctx: TenantContext): Promise<T> {
    await this.beforeCreate(data, ctx);
    const id = (data as any).id || randomUUID();
    const item = { ...data, id, organizationId: ctx.organizationId } as T;

    try {
      await this.manager.withConnection(async (connection) => {
        await connection.query(
          `INSERT INTO apex_domain_records(entity_type, id, organization_id, record)
           VALUES (${quotePostgresLiteral(this.entityType)}, ${quotePostgresLiteral(id)}, ${quotePostgresLiteral(ctx.organizationId)}, ${sqlJson(item)})`
        );
      });
    } catch (error) {
      mapPostgresConflict(error, this.entityType);
    }
    return item;
  }

  public async update(
    id: string,
    updates: TUpdate,
    ctx: TenantContext,
    resourceName: string = this.entityType
  ): Promise<T> {
    const existing = await this.findById(id, ctx, resourceName);
    await this.beforeUpdate(existing, updates, ctx);

    const safe: Record<string, unknown> = { ...(updates as Record<string, unknown>) };
    for (const field of IMMUTABLE_UPDATE_FIELDS) delete safe[field];
    const updated = {
      ...existing,
      ...safe,
      ...(Object.prototype.hasOwnProperty.call(existing, "updatedAt") ? { updatedAt: new Date().toISOString() } : {}),
    } as T;

    await this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `UPDATE apex_domain_records SET record = ${sqlJson(updated)}, updated_at = NOW()
         WHERE entity_type = ${quotePostgresLiteral(this.entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}
           AND id = ${quotePostgresLiteral(id)} RETURNING id`
      );
      if (result.rows.length !== 1) throw new NotFoundError(resourceName);
    });
    return updated;
  }

  public async delete(id: string, ctx: TenantContext, resourceName: string = this.entityType): Promise<boolean> {
    const existing = await this.findById(id, ctx, resourceName);
    await this.beforeDelete(existing, ctx);
    return this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `DELETE FROM apex_domain_records
         WHERE entity_type = ${quotePostgresLiteral(this.entityType)}
           AND organization_id = ${quotePostgresLiteral(ctx.organizationId)}
           AND id = ${quotePostgresLiteral(id)} RETURNING id`
      );
      return result.rows.length === 1;
    });
  }
}

export class PostgresCustomerRepository extends PostgresTenantRepository<CustomerRecord, UpdateCustomerInput> implements ICustomerRepository {
  constructor(manager: PostgresConnectionManager) { super("Customer", manager); }
  findByEmail(email: string, ctx: TenantContext) { return this.findOne(ctx, { where: { contactEmail: { eq: email } } }); }
  findAtRisk(ctx: TenantContext) { return this.findMany(ctx, { where: { status: { eq: "at-risk" } } }); }
  protected override async beforeDelete(existing: CustomerRecord, ctx: TenantContext): Promise<void> {
    await this.rejectDependency("Customer", existing.id, "Contract", await this.countDependencies("Contract", ctx, (record) => record.customerId === existing.id));
    await this.rejectDependency("Customer", existing.id, "Transaction", await this.countDependencies("Transaction", ctx, (record) => record.customerId === existing.id));
    await this.rejectDependency("Customer", existing.id, "Document", await this.countDependencies("Document", ctx, (record) => record.customerId === existing.id));
    await this.rejectDependency("Customer", existing.id, "ValueOpportunity", await this.countDependencies("ValueOpportunity", ctx, (record) => record.sourceEntityType === "Customer" && record.sourceEntityId === existing.id));
  }
}

export class PostgresContractRepository extends PostgresTenantRepository<ContractRecord, UpdateContractInput> implements IContractRepository {
  constructor(manager: PostgresConnectionManager) { super("Contract", manager); }
  protected override async beforeCreate(data: Omit<ContractRecord, "organizationId">, ctx: TenantContext) { await this.requireTenantRecord("Customer", data.customerId, ctx, "Customer"); }
  protected override async beforeUpdate(_existing: ContractRecord, updates: UpdateContractInput, ctx: TenantContext) { if (updates.customerId !== undefined) await this.requireTenantRecord("Customer", updates.customerId, ctx, "Customer"); }
  protected override async beforeDelete(existing: ContractRecord, ctx: TenantContext) { await this.rejectDependency("Contract", existing.id, "ValueOpportunity", await this.countDependencies("ValueOpportunity", ctx, (record) => record.sourceEntityType === "Contract" && record.sourceEntityId === existing.id)); }
  findByCustomer(customerId: string, ctx: TenantContext) { return this.findMany(ctx, { where: { customerId: { eq: customerId } } }); }
  findExpiringSoon(daysThreshold: number, ctx: TenantContext) { return this.findMany(ctx, { where: { AND: [{ renewalDaysRemaining: { lte: daysThreshold } }, { status: { eq: "active" } }] } }); }
}

export class PostgresTransactionRepository extends PostgresTenantRepository<TransactionRecord, UpdateTransactionInput> implements ITransactionRepository {
  constructor(manager: PostgresConnectionManager) { super("Transaction", manager); }
  protected override async beforeCreate(data: Omit<TransactionRecord, "organizationId">, ctx: TenantContext) { await this.requireTenantRecord("Customer", data.customerId, ctx, "Customer"); }
  protected override async beforeUpdate(_existing: TransactionRecord, updates: UpdateTransactionInput, ctx: TenantContext) { if (updates.customerId !== undefined) await this.requireTenantRecord("Customer", updates.customerId, ctx, "Customer"); }
  protected override async beforeDelete(existing: TransactionRecord, ctx: TenantContext) { await this.rejectDependency("Transaction", existing.id, "ValueOpportunity", await this.countDependencies("ValueOpportunity", ctx, (record) => record.sourceEntityType === "Transaction" && record.sourceEntityId === existing.id)); }
  findByCustomer(customerId: string, ctx: TenantContext) { return this.findMany(ctx, { where: { customerId: { eq: customerId } } }); }
  public async calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult> {
    const records = await this.tenantRecords(ctx);
    const byCurrency: Record<string, FinancialTotalsByCurrency> = {};
    for (const record of records) {
      const currency = Validator.normalizeCurrency(record.currency);
      if (!currency) continue;
      byCurrency[currency] ||= { totalRevenue: 0, totalCosts: 0, net: 0, transactionCount: 0 };
      if (record.status !== "cleared") continue;
      byCurrency[currency].transactionCount += 1;
      if (record.type === "revenue") byCurrency[currency].totalRevenue += record.amount;
      if (record.type === "cost") byCurrency[currency].totalCosts += record.amount;
      byCurrency[currency].net = byCurrency[currency].totalRevenue - byCurrency[currency].totalCosts;
    }
    const currencies = Object.keys(byCurrency);
    if (currencies.length === 1) {
      const currency = currencies[0];
      return { byCurrency, isMixedCurrency: false, currency, totalRevenue: byCurrency[currency].totalRevenue, totalCosts: byCurrency[currency].totalCosts };
    }
    if (currencies.length === 0) return { byCurrency: {}, isMixedCurrency: false, currency: null, totalRevenue: 0, totalCosts: 0 };
    return { byCurrency, isMixedCurrency: true, currency: null, totalRevenue: null, totalCosts: null };
  }
}

export class PostgresSignalRepository extends PostgresTenantRepository<SignalRecord, UpdateSignalInput> implements ISignalRepository {
  constructor(manager: PostgresConnectionManager) { super("Signal", manager); }
  protected override async beforeDelete(existing: SignalRecord, ctx: TenantContext) { await this.rejectDependency("Signal", existing.id, "ValueOpportunity", await this.countDependencies("ValueOpportunity", ctx, (record) => record.sourceEntityType === "Signal" && record.sourceEntityId === existing.id)); }
  findActiveByCategory(category: string, ctx: TenantContext) { return this.findMany(ctx, { where: { AND: [{ status: { eq: "active" } }, { category: { eq: category as SignalRecord["category"] } }] } }); }
}

const ALLOWED_SOURCE_TYPES = new Set(["Contract", "Customer", "Signal", "Transaction", "Operation"]);

export class PostgresValueOpportunityRepository extends PostgresTenantRepository<ValueOpportunityRecord, UpdateValueOpportunityInput> implements IValueOpportunityRepository {
  constructor(manager: PostgresConnectionManager) { super("ValueOpportunity", manager); }
  private async validateSource(type: unknown, id: unknown, ctx: TenantContext): Promise<void> {
    if (type !== undefined && type !== null && type !== "" && (typeof type !== "string" || !ALLOWED_SOURCE_TYPES.has(type))) throw new ValidationError(`Invalid sourceEntityType '${String(type)}'`);
    if (id === undefined || id === null || id === "") return;
    if (typeof type !== "string" || !type) throw new ValidationError("Field 'sourceEntityType' is required when 'sourceEntityId' is specified");
    if (type === "Operation") return;
    await this.requireTenantRecord(type, id, ctx, type);
  }
  protected override async beforeCreate(data: Omit<ValueOpportunityRecord, "organizationId">, ctx: TenantContext) { await this.validateSource(data.sourceEntityType, data.sourceEntityId, ctx); }
  protected override async beforeUpdate(existing: ValueOpportunityRecord, updates: UpdateValueOpportunityInput, ctx: TenantContext) { if (updates.sourceEntityType !== undefined || updates.sourceEntityId !== undefined) await this.validateSource(updates.sourceEntityType ?? existing.sourceEntityType, updates.sourceEntityId ?? existing.sourceEntityId, ctx); }
  protected override async beforeDelete(existing: ValueOpportunityRecord, ctx: TenantContext) { await this.rejectDependency("ValueOpportunity", existing.id, "ValueCaptured", await this.countDependencies("ValueCaptured", ctx, (record) => record.opportunityId === existing.id)); }
  findByCategory(category: string, ctx: TenantContext) { return this.findMany(ctx, { where: { category: { eq: category as ValueOpportunityRecord["category"] } } }); }
  findByStatus(status: string, ctx: TenantContext) { return this.findMany(ctx, { where: { status: { eq: status as ValueOpportunityRecord["status"] } } }); }
}

export class PostgresValueCapturedRepository extends PostgresTenantRepository<ValueCapturedRecord, UpdateValueCapturedInput> implements IValueCapturedRepository {
  constructor(manager: PostgresConnectionManager) { super("ValueCaptured", manager); }
  protected override async beforeCreate(data: Omit<ValueCapturedRecord, "organizationId">, ctx: TenantContext) { if (data.opportunityId) await this.requireTenantRecord("ValueOpportunity", data.opportunityId, ctx, "ValueOpportunity"); }
  protected override async beforeUpdate(_existing: ValueCapturedRecord, updates: UpdateValueCapturedInput, ctx: TenantContext) { if (updates.opportunityId) await this.requireTenantRecord("ValueOpportunity", updates.opportunityId, ctx, "ValueOpportunity"); }
  public async calculateTotalCaptured(ctx: TenantContext): Promise<number> { return (await this.tenantRecords(ctx)).reduce((sum, item) => sum + item.capturedValue, 0); }
}

export class PostgresOrganizationalMemoryRepository extends PostgresTenantRepository<OrganizationalMemoryRecord, UpdateOrganizationalMemoryInput> implements IOrganizationalMemoryRepository {
  constructor(manager: PostgresConnectionManager) { super("OrganizationalMemory", manager); }
  searchKeywords(keywords: string[], ctx: TenantContext) {
    const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (normalized.length === 0) return this.findMany(ctx);
    return this.findMany(ctx, { where: { OR: normalized.flatMap((keyword) => [{ title: { contains: keyword } }, { content: { contains: keyword } }, { source: { contains: keyword } }]) } as any });
  }
}

export class PostgresActionRepository extends PostgresTenantRepository<ActionRecord, UpdateActionInput> implements IActionRepository {
  constructor(manager: PostgresConnectionManager) { super("Action", manager); }
  findByStatus(status: string, ctx: TenantContext) { return this.findMany(ctx, { where: { status: { eq: status as ActionRecord["status"] } } }); }
}

export class PostgresDocumentRepository extends PostgresTenantRepository<DocumentRecord, UpdateDocumentInput> implements IDocumentRepository {
  constructor(manager: PostgresConnectionManager) { super("Document", manager); }
  protected override async beforeCreate(data: Omit<DocumentRecord, "organizationId">, ctx: TenantContext) { if (data.customerId) await this.requireTenantRecord("Customer", data.customerId, ctx, "Customer"); }
  protected override async beforeUpdate(_existing: DocumentRecord, updates: UpdateDocumentInput, ctx: TenantContext) { if (updates.customerId) await this.requireTenantRecord("Customer", updates.customerId, ctx, "Customer"); }
  protected override async beforeDelete(existing: DocumentRecord, ctx: TenantContext) { await this.rejectDependency("Document", existing.id, "KnowledgeItem", await this.countDependencies("KnowledgeItem", ctx, (record) => record.sourceDocId === existing.id)); }
  findByCategory(category: string, ctx: TenantContext) { return this.findMany(ctx, { where: { category: { eq: category as DocumentRecord["category"] } } }); }
  findByCustomer(customerId: string, ctx: TenantContext) { return this.findMany(ctx, { where: { customerId: { eq: customerId } } }); }
  findByStatus(status: string, ctx: TenantContext) { return this.findMany(ctx, { where: { status: { eq: status as DocumentRecord["status"] } } }); }
}

export class PostgresKnowledgeRepository extends PostgresTenantRepository<KnowledgeItemRecord, UpdateKnowledgeItemInput> implements IKnowledgeRepository {
  constructor(manager: PostgresConnectionManager) { super("KnowledgeItem", manager); }
  protected override async beforeCreate(data: Omit<KnowledgeItemRecord, "organizationId">, ctx: TenantContext) { if (data.sourceDocId) await this.requireTenantRecord("Document", data.sourceDocId, ctx, "Document"); }
  protected override async beforeUpdate(_existing: KnowledgeItemRecord, updates: UpdateKnowledgeItemInput, ctx: TenantContext) { if (updates.sourceDocId) await this.requireTenantRecord("Document", updates.sourceDocId, ctx, "Document"); }
  findByCategory(category: string, ctx: TenantContext) { return this.findMany(ctx, { where: { category: { eq: category as KnowledgeItemRecord["category"] } } }); }
  findByTags(tags: string[], ctx: TenantContext) { return this.findMany(ctx, { where: { tags: { arrayContainsAny: tags } } }); }
  searchContent(query: string, ctx: TenantContext) { return this.findMany(ctx, { search: { fields: ["title", "content", "summary"], term: query } }); }
}

export class PostgresWorkflowRepository extends PostgresTenantRepository<WorkflowRecord, UpdateWorkflowInput> implements IWorkflowRepository {
  constructor(manager: PostgresConnectionManager) { super("Workflow", manager); }
  protected override async beforeDelete(existing: WorkflowRecord, ctx: TenantContext) { await this.rejectDependency("Workflow", existing.id, "WorkflowRun", await this.countDependencies("WorkflowRun", ctx, (record) => record.workflowId === existing.id)); }
  findActive(ctx: TenantContext) { return this.findMany(ctx, { where: { status: { eq: "active" } } }); }
}

export class PostgresWorkflowRunRepository extends PostgresTenantRepository<WorkflowRunRecord, UpdateWorkflowRunInput> implements IWorkflowRunRepository {
  constructor(manager: PostgresConnectionManager) { super("WorkflowRun", manager); }
  protected override async beforeCreate(data: Omit<WorkflowRunRecord, "organizationId">, ctx: TenantContext) { await this.requireTenantRecord("Workflow", data.workflowId, ctx, "Workflow"); }
  protected override async beforeUpdate(_existing: WorkflowRunRecord, updates: UpdateWorkflowRunInput, ctx: TenantContext) { if (updates.workflowId !== undefined) await this.requireTenantRecord("Workflow", updates.workflowId, ctx, "Workflow"); }
  findByWorkflow(workflowId: string, ctx: TenantContext) { return this.findMany(ctx, { where: { workflowId: { eq: workflowId } } }); }
  findActiveRuns(ctx: TenantContext) { return this.findMany(ctx, { where: { OR: [{ status: { eq: "running" } }, { status: { eq: "waiting_approval" } }] } }); }
}

export class PostgresAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly manager: PostgresConnectionManager) {}

  public async record(log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })): Promise<AuditLogRecord> {
    const full: AuditLogRecord = {
      ...log,
      id: `audit-${Date.now()}-${randomUUID()}`,
      timestamp: log.timestamp || new Date().toISOString(),
    } as AuditLogRecord;
    try {
      await this.manager.withConnection((connection) => connection.query(
        `INSERT INTO apex_audit_logs(id, organization_id, occurred_at, record)
         VALUES (${quotePostgresLiteral(full.id)}, ${quotePostgresLiteral(full.organizationId)}, ${quotePostgresLiteral(full.timestamp)}::timestamptz, ${sqlJson(full)})`
      ));
    } catch (error) {
      mapPostgresConflict(error, "AuditLog");
    }
    return full;
  }

  private async tenantLogs(ctx: TenantContext): Promise<AuditLogRecord[]> {
    return this.manager.withConnection(async (connection) => {
      const result = await connection.query(
        `SELECT record::text AS record FROM apex_audit_logs
         WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
         ORDER BY occurred_at DESC, id DESC`
      );
      return result.rows.map((row) => parseRecord<AuditLogRecord>(row)!).filter(Boolean);
    });
  }

  public async findMany(ctx: TenantContext, query?: QuerySpecification<AuditLogRecord>): Promise<PaginatedResult<AuditLogRecord>> {
    return applyQuerySpecificationPaginated(await this.tenantLogs(ctx), query, ctx.organizationId, "AuditLog");
  }
  public async findOne(ctx: TenantContext, query?: QuerySpecification<AuditLogRecord>): Promise<AuditLogRecord | undefined> {
    const page = await this.findMany(ctx, { ...(query || {}), limit: 1, cursor: null });
    return page.items[0];
  }
  public async count(ctx: TenantContext, query?: QuerySpecification<AuditLogRecord>): Promise<number> {
    const spec = query ? { where: query.where, search: query.search } : undefined;
    return (await this.tenantLogs(ctx)).filter((record) => matchesSpecification(record, spec)).length;
  }
}

export class PostgresPersistence {
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

  constructor(connectionString: string) {
    this.manager = new PostgresConnectionManager(connectionString);
    this.customersRepo = new PostgresCustomerRepository(this.manager);
    this.contractsRepo = new PostgresContractRepository(this.manager);
    this.transactionsRepo = new PostgresTransactionRepository(this.manager);
    this.signalsRepo = new PostgresSignalRepository(this.manager);
    this.opportunitiesRepo = new PostgresValueOpportunityRepository(this.manager);
    this.valueCapturedRepo = new PostgresValueCapturedRepository(this.manager);
    this.memoryRepo = new PostgresOrganizationalMemoryRepository(this.manager);
    this.actionsRepo = new PostgresActionRepository(this.manager);
    this.documentsRepo = new PostgresDocumentRepository(this.manager);
    this.knowledgeRepo = new PostgresKnowledgeRepository(this.manager);
    this.workflowsRepo = new PostgresWorkflowRepository(this.manager);
    this.workflowRunsRepo = new PostgresWorkflowRunRepository(this.manager);
    this.auditLogsRepo = new PostgresAuditLogRepository(this.manager);
  }

  public bootstrap(): Promise<void> { return this.manager.bootstrap(); }
  public clearAllForTesting(): Promise<void> { return this.manager.clearAllForTesting(); }

  public async createOrganization(record: OrganizationRecord): Promise<OrganizationRecord> {
    try {
      await this.manager.withConnection((connection) => connection.query(
        `INSERT INTO apex_organizations(id, slug_normalized, record)
         VALUES (${quotePostgresLiteral(record.id)}, ${quotePostgresLiteral(record.slug.toLowerCase())}, ${sqlJson(record)})`
      ));
    } catch (error) { mapPostgresConflict(error, "Organization"); }
    return record;
  }

  public async createUser(record: UserRecord): Promise<UserRecord> {
    try {
      await this.manager.withConnection((connection) => connection.query(
        `INSERT INTO apex_users(id, email_normalized, record)
         VALUES (${quotePostgresLiteral(record.id)}, ${quotePostgresLiteral(record.email.toLowerCase())}, ${sqlJson(record)})`
      ));
    } catch (error) { mapPostgresConflict(error, "User"); }
    return record;
  }

  public async createMembership(record: OrganizationMembershipRecord): Promise<OrganizationMembershipRecord> {
    try {
      await this.manager.withConnection((connection) => connection.query(
        `INSERT INTO apex_memberships(id, organization_id, user_id, record)
         VALUES (${quotePostgresLiteral(record.id)}, ${quotePostgresLiteral(record.organizationId)}, ${quotePostgresLiteral(record.userId)}, ${sqlJson(record)})`
      ));
    } catch (error) { mapPostgresConflict(error, "OrganizationMembership"); }
    return record;
  }

  public async getOrganizationById(id: string): Promise<OrganizationRecord | undefined> {
    return this.manager.withConnection(async (connection) => parseRecord<OrganizationRecord>((await connection.query(`SELECT record::text AS record FROM apex_organizations WHERE id = ${quotePostgresLiteral(id)} LIMIT 1`)).rows[0]));
  }
  public async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    return this.manager.withConnection(async (connection) => parseRecord<UserRecord>((await connection.query(`SELECT record::text AS record FROM apex_users WHERE email_normalized = ${quotePostgresLiteral(email.trim().toLowerCase())} LIMIT 1`)).rows[0]));
  }
  public async getUserByLoginIdentifier(identifier: string): Promise<UserRecord | undefined> {
    const normalized = identifier.trim().toLowerCase();
    return this.manager.withConnection(async (connection) =>
      parseRecord<UserRecord>(
        (
          await connection.query(
            `SELECT record::text AS record
             FROM apex_users
             WHERE email_normalized = ${quotePostgresLiteral(normalized)}
                OR LOWER(BTRIM(record->>'username')) = ${quotePostgresLiteral(normalized)}
             LIMIT 1`
          )
        ).rows[0]
      )
    );
  }
  public async getUserById(id: string): Promise<UserRecord | undefined> {
    return this.manager.withConnection(async (connection) => parseRecord<UserRecord>((await connection.query(`SELECT record::text AS record FROM apex_users WHERE id = ${quotePostgresLiteral(id)} LIMIT 1`)).rows[0]));
  }
  public async getMembership(userId: string, organizationId: string): Promise<OrganizationMembershipRecord | undefined> {
    return this.manager.withConnection(async (connection) => parseRecord<OrganizationMembershipRecord>((await connection.query(
      `SELECT record::text AS record FROM apex_memberships WHERE user_id = ${quotePostgresLiteral(userId)} AND organization_id = ${quotePostgresLiteral(organizationId)} LIMIT 1`
    )).rows[0]));
  }
  public async getMembershipsForUser(userId: string): Promise<OrganizationMembershipRecord[]> {
    return this.manager.withConnection(async (connection) => (await connection.query(
      `SELECT record::text AS record FROM apex_memberships WHERE user_id = ${quotePostgresLiteral(userId)} ORDER BY organization_id, id`
    )).rows.map((row) => parseRecord<OrganizationMembershipRecord>(row)!).filter(Boolean));
  }
  public async updatePasswordCredentials(userId: string, organizationId: string, passwordHash: string, passwordSalt: string): Promise<UserRecord | undefined> {
    const context = {
      organizationId,
      userId,
      userEmail: "system",
      userRole: "Operations",
      permissions: [],
      isSuperAdmin: false,
      requestId: `identity-${randomUUID()}`,
      timestamp: new Date().toISOString(),
    } as TenantContext;
    return this.manager.runInTransaction(context, async (connection) => {
      const membership = await connection.query(`SELECT 1 AS found FROM apex_memberships WHERE user_id = ${quotePostgresLiteral(userId)} AND organization_id = ${quotePostgresLiteral(organizationId)} LIMIT 1`);
      if (membership.rows.length === 0) return undefined;
      const current = parseRecord<UserRecord>((await connection.query(`SELECT record::text AS record FROM apex_users WHERE id = ${quotePostgresLiteral(userId)} LIMIT 1`)).rows[0]);
      if (!current) return undefined;
      const updated = { ...current, passwordHash, passwordSalt, passwordChangeRequired: false };
      await connection.query(`UPDATE apex_users SET record = ${sqlJson(updated)}, updated_at = NOW() WHERE id = ${quotePostgresLiteral(userId)}`);
      return updated;
    });
  }

  public async runInTransaction<T>(ctx: TenantContext, work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.manager.runInTransaction(ctx, async () => {
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
        { recordAuditLog: (log) => this.auditLogsRepo.record(log) }
      );
      return work(uow);
    });
  }
}
