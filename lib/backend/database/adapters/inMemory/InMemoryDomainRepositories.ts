/**
 * APEX ONE — Concrete In-Memory Domain Repository Adapters
 *
 * Stage 3 canonical repository implementation. Generic filtering, search,
 * deterministic sorting, and cursor pagination are implemented once in
 * InMemoryTenantRepository/querySpecification. Concrete repositories retain
 * only domain-specific relationships, aggregates, lifecycle rules, and named
 * convenience queries.
 */

import { InMemoryTenantRepository } from "./InMemoryTenantRepository";
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
} from "../../schema";
import {
  ICustomerRepository,
  IContractRepository,
  ITransactionRepository,
  FinancialTotalsResult,
  FinancialTotalsByCurrency,
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
  type PaginatedResult,
  type QuerySpecification,
} from "../../repository";
import {
  applyQuerySpecificationPaginated,
  matchesSpecification,
} from "../../querySpecification";
import { TenantContext } from "../../../core/errors";
import { Validator } from "../../../core/validation";
import {
  RelationshipValidator,
  IEntityLookupStore,
} from "../../relationshipValidator";

function recordDeleteAudit(
  entityLookupStore: IEntityLookupStore | undefined,
  ctx: TenantContext,
  resource: string,
  resourceId: string
): void {
  if (!entityLookupStore?.recordAuditLog) return;
  entityLookupStore.recordAuditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    action: `${resource.toLowerCase()}:delete`,
    resource,
    resourceId,
    requestId: ctx.requestId,
    status: "success",
    timestamp: new Date().toISOString(),
  });
}

export class InMemoryCustomerRepository
  extends InMemoryTenantRepository<CustomerRecord, UpdateCustomerInput>
  implements ICustomerRepository
{
  constructor(
    collectionName: string,
    store: Map<string, CustomerRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public async findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined> {
    return this.findOne(ctx, { where: { contactEmail: { eq: email } } });
  }

  public async findAtRisk(ctx: TenantContext): Promise<PaginatedResult<CustomerRecord>> {
    return this.findMany(ctx, { where: { status: { eq: "at-risk" } } });
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateCustomerCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Customer", id);
    return deleted;
  }
}

export class InMemoryContractRepository
  extends InMemoryTenantRepository<ContractRecord, UpdateContractInput>
  implements IContractRepository
{
  constructor(
    collectionName: string,
    store: Map<string, ContractRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<ContractRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<ContractRecord> {
    RelationshipValidator.validateCustomerBelongsToTenant(
      data.customerId,
      ctx,
      this.entityLookupStore,
      { optional: false, resourceContext: "Contract" }
    );
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateContractInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ContractRecord> {
    if (updates.customerId !== undefined) {
      RelationshipValidator.validateCustomerBelongsToTenant(
        updates.customerId,
        ctx,
        this.entityLookupStore,
        { optional: false, resourceContext: "Contract" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateContractCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Contract", id);
    return deleted;
  }

  public async findByCustomer(
    customerId: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<ContractRecord>> {
    return this.findMany(ctx, { where: { customerId: { eq: customerId } } });
  }

  public async findExpiringSoon(
    daysThreshold: number,
    ctx: TenantContext
  ): Promise<PaginatedResult<ContractRecord>> {
    return this.findMany(ctx, {
      where: {
        AND: [
          { renewalDaysRemaining: { lte: daysThreshold } },
          { status: { eq: "active" } },
        ],
      },
    });
  }
}

export class InMemoryTransactionRepository
  extends InMemoryTenantRepository<TransactionRecord, UpdateTransactionInput>
  implements ITransactionRepository
{
  constructor(
    collectionName: string,
    store: Map<string, TransactionRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<TransactionRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<TransactionRecord> {
    RelationshipValidator.validateCustomerBelongsToTenant(
      data.customerId,
      ctx,
      this.entityLookupStore,
      { optional: false, resourceContext: "Transaction" }
    );
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateTransactionInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<TransactionRecord> {
    if (updates.customerId !== undefined) {
      RelationshipValidator.validateCustomerBelongsToTenant(
        updates.customerId,
        ctx,
        this.entityLookupStore,
        { optional: false, resourceContext: "Transaction" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateTransactionCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Transaction", id);
    return deleted;
  }

  public async findByCustomer(
    customerId: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<TransactionRecord>> {
    return this.findMany(ctx, { where: { customerId: { eq: customerId } } });
  }

  public async calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult> {
    const records = this.tenantItems(ctx);
    const byCurrency: Record<string, FinancialTotalsByCurrency> = {};

    for (const rec of records) {
      const canonicalCurrency = Validator.normalizeCurrency(rec.currency);
      if (!canonicalCurrency) continue;

      if (!byCurrency[canonicalCurrency]) {
        byCurrency[canonicalCurrency] = {
          totalRevenue: 0,
          totalCosts: 0,
          net: 0,
          transactionCount: 0,
        };
      }

      if (rec.status === "cleared") {
        byCurrency[canonicalCurrency].transactionCount += 1;
        if (rec.type === "revenue") {
          byCurrency[canonicalCurrency].totalRevenue += rec.amount;
        } else if (rec.type === "cost") {
          byCurrency[canonicalCurrency].totalCosts += rec.amount;
        }
        byCurrency[canonicalCurrency].net =
          byCurrency[canonicalCurrency].totalRevenue -
          byCurrency[canonicalCurrency].totalCosts;
      }
    }

    const activeCurrencies = Object.keys(byCurrency);
    if (activeCurrencies.length === 1) {
      const currency = activeCurrencies[0];
      return {
        byCurrency,
        isMixedCurrency: false,
        currency,
        totalRevenue: byCurrency[currency].totalRevenue,
        totalCosts: byCurrency[currency].totalCosts,
      };
    }
    if (activeCurrencies.length === 0) {
      return {
        byCurrency: {},
        isMixedCurrency: false,
        currency: null,
        totalRevenue: 0,
        totalCosts: 0,
      };
    }
    return {
      byCurrency,
      isMixedCurrency: true,
      currency: null,
      totalRevenue: null,
      totalCosts: null,
    };
  }
}

export class InMemorySignalRepository
  extends InMemoryTenantRepository<SignalRecord, UpdateSignalInput>
  implements ISignalRepository
{
  constructor(
    collectionName: string,
    store: Map<string, SignalRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateSignalCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Signal", id);
    return deleted;
  }

  public async findActiveByCategory(
    category: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<SignalRecord>> {
    return this.findMany(ctx, {
      where: {
        AND: [
          { status: { eq: "active" } },
          { category: { eq: category as SignalRecord["category"] } },
        ],
      },
    });
  }
}

export class InMemoryValueOpportunityRepository
  extends InMemoryTenantRepository<ValueOpportunityRecord, UpdateValueOpportunityInput>
  implements IValueOpportunityRepository
{
  constructor(
    collectionName: string,
    store: Map<string, ValueOpportunityRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<ValueOpportunityRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<ValueOpportunityRecord> {
    RelationshipValidator.validatePolymorphicSourceEntity(
      data.sourceEntityType,
      data.sourceEntityId,
      ctx,
      this.entityLookupStore
    );
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateValueOpportunityInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ValueOpportunityRecord> {
    if (updates.sourceEntityType !== undefined || updates.sourceEntityId !== undefined) {
      const existing = await this.findById(id, ctx, resourceName);
      RelationshipValidator.validatePolymorphicSourceEntity(
        updates.sourceEntityType ?? existing.sourceEntityType,
        updates.sourceEntityId ?? existing.sourceEntityId,
        ctx,
        this.entityLookupStore
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateOpportunityCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "ValueOpportunity", id);
    return deleted;
  }

  public async findByCategory(
    category: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<ValueOpportunityRecord>> {
    return this.findMany(ctx, {
      where: { category: { eq: category as ValueOpportunityRecord["category"] } },
    });
  }

  public async findByStatus(
    status: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<ValueOpportunityRecord>> {
    return this.findMany(ctx, {
      where: { status: { eq: status as ValueOpportunityRecord["status"] } },
    });
  }
}

export class InMemoryValueCapturedRepository
  extends InMemoryTenantRepository<ValueCapturedRecord, UpdateValueCapturedInput>
  implements IValueCapturedRepository
{
  constructor(
    collectionName: string,
    store: Map<string, ValueCapturedRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<ValueCapturedRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<ValueCapturedRecord> {
    RelationshipValidator.validateOpportunityBelongsToTenant(
      data.opportunityId,
      ctx,
      this.entityLookupStore,
      { optional: true, resourceContext: "ValueCaptured" }
    );
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateValueCapturedInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ValueCapturedRecord> {
    if (
      updates.opportunityId !== undefined &&
      updates.opportunityId !== null &&
      updates.opportunityId !== ""
    ) {
      RelationshipValidator.validateOpportunityBelongsToTenant(
        updates.opportunityId,
        ctx,
        this.entityLookupStore,
        { optional: true, resourceContext: "ValueCaptured" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async calculateTotalCaptured(ctx: TenantContext): Promise<number> {
    return this.tenantItems(ctx).reduce(
      (sum, item) => sum + item.capturedValue,
      0
    );
  }
}

export class InMemoryOrganizationalMemoryRepository
  extends InMemoryTenantRepository<OrganizationalMemoryRecord, UpdateOrganizationalMemoryInput>
  implements IOrganizationalMemoryRepository
{
  public async searchKeywords(
    keywords: string[],
    ctx: TenantContext
  ): Promise<PaginatedResult<OrganizationalMemoryRecord>> {
    const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (normalized.length === 0) return this.findMany(ctx);

    return this.findMany(ctx, {
      where: {
        OR: normalized.flatMap((keyword) => [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
          { source: { contains: keyword } },
        ]),
      },
    });
  }
}

export class InMemoryActionRepository
  extends InMemoryTenantRepository<ActionRecord, UpdateActionInput>
  implements IActionRepository
{
  public async findByStatus(
    status: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<ActionRecord>> {
    return this.findMany(ctx, {
      where: { status: { eq: status as ActionRecord["status"] } },
    });
  }
}

export class InMemoryDocumentRepository
  extends InMemoryTenantRepository<DocumentRecord, UpdateDocumentInput>
  implements IDocumentRepository
{
  constructor(
    collectionName: string,
    store: Map<string, DocumentRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<DocumentRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<DocumentRecord> {
    RelationshipValidator.validateCustomerBelongsToTenant(
      data.customerId,
      ctx,
      this.entityLookupStore,
      { optional: true, resourceContext: "Document" }
    );
    if (data.uploadedBy) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(
        data.uploadedBy,
        ctx,
        this.entityLookupStore,
        { optional: true, resourceContext: "Document.uploadedBy" }
      );
    }
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateDocumentInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<DocumentRecord> {
    if (
      updates.customerId !== undefined &&
      updates.customerId !== null &&
      updates.customerId !== ""
    ) {
      RelationshipValidator.validateCustomerBelongsToTenant(
        updates.customerId,
        ctx,
        this.entityLookupStore,
        { optional: true, resourceContext: "Document" }
      );
    }
    if (
      updates.uploadedBy !== undefined &&
      updates.uploadedBy !== null &&
      updates.uploadedBy !== ""
    ) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(
        updates.uploadedBy,
        ctx,
        this.entityLookupStore,
        { optional: true, resourceContext: "Document.uploadedBy" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByCategory(
    category: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<DocumentRecord>> {
    return this.findMany(ctx, {
      where: { category: { eq: category as DocumentRecord["category"] } },
    });
  }

  public async findByCustomer(
    customerId: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<DocumentRecord>> {
    return this.findMany(ctx, { where: { customerId: { eq: customerId } } });
  }

  public async findByStatus(
    status: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<DocumentRecord>> {
    return this.findMany(ctx, {
      where: { status: { eq: status as DocumentRecord["status"] } },
    });
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateDocumentCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Document", id);
    return deleted;
  }
}

export class InMemoryKnowledgeRepository
  extends InMemoryTenantRepository<KnowledgeItemRecord, UpdateKnowledgeItemInput>
  implements IKnowledgeRepository
{
  constructor(
    _collectionName: string,
    store: Map<string, KnowledgeItemRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super("KnowledgeItem", store, onAuditViolation);
  }

  public override async create(
    data: Omit<KnowledgeItemRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<KnowledgeItemRecord> {
    RelationshipValidator.validateDocumentBelongsToTenant(
      data.sourceDocId,
      ctx,
      this.entityLookupStore,
      { optional: true, resourceContext: "KnowledgeItem" }
    );
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateKnowledgeItemInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<KnowledgeItemRecord> {
    if (
      updates.sourceDocId !== undefined &&
      updates.sourceDocId !== null &&
      updates.sourceDocId !== ""
    ) {
      RelationshipValidator.validateDocumentBelongsToTenant(
        updates.sourceDocId,
        ctx,
        this.entityLookupStore,
        { optional: true, resourceContext: "KnowledgeItem" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByCategory(
    category: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<KnowledgeItemRecord>> {
    return this.findMany(ctx, {
      where: { category: { eq: category as KnowledgeItemRecord["category"] } },
    });
  }

  public async findByTags(
    tags: string[],
    ctx: TenantContext
  ): Promise<PaginatedResult<KnowledgeItemRecord>> {
    return this.findMany(ctx, {
      where: { tags: { arrayContainsAny: tags } },
    });
  }

  public async searchContent(
    query: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<KnowledgeItemRecord>> {
    return this.findMany(ctx, {
      search: {
        fields: ["title", "content", "summary"],
        term: query,
      },
    });
  }
}

export class InMemoryWorkflowRepository
  extends InMemoryTenantRepository<WorkflowRecord, UpdateWorkflowInput>
  implements IWorkflowRepository
{
  constructor(
    collectionName: string,
    store: Map<string, WorkflowRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateWorkflowCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted) recordDeleteAudit(this.entityLookupStore, ctx, "Workflow", id);
    return deleted;
  }

  public async findActive(ctx: TenantContext): Promise<PaginatedResult<WorkflowRecord>> {
    return this.findMany(ctx, { where: { status: { eq: "active" } } });
  }
}

export class InMemoryWorkflowRunRepository
  extends InMemoryTenantRepository<WorkflowRunRecord, UpdateWorkflowRunInput>
  implements IWorkflowRunRepository
{
  constructor(
    collectionName: string,
    store: Map<string, WorkflowRunRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<WorkflowRunRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<WorkflowRunRecord> {
    RelationshipValidator.validateWorkflowBelongsToTenant(
      data.workflowId,
      ctx,
      this.entityLookupStore,
      { optional: false, resourceContext: "WorkflowRun" }
    );
    if (data.triggeredBy) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(
        data.triggeredBy,
        ctx,
        this.entityLookupStore,
        { optional: false, resourceContext: "WorkflowRun.triggeredBy" }
      );
    }
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: UpdateWorkflowRunInput,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<WorkflowRunRecord> {
    if (updates.workflowId !== undefined) {
      RelationshipValidator.validateWorkflowBelongsToTenant(
        updates.workflowId,
        ctx,
        this.entityLookupStore,
        { optional: false, resourceContext: "WorkflowRun" }
      );
    }
    if (updates.triggeredBy !== undefined) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(
        updates.triggeredBy,
        ctx,
        this.entityLookupStore,
        { optional: false, resourceContext: "WorkflowRun.triggeredBy" }
      );
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByWorkflow(
    workflowId: string,
    ctx: TenantContext
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    return this.findMany(ctx, { where: { workflowId: { eq: workflowId } } });
  }

  public async findActiveRuns(
    ctx: TenantContext
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    return this.findMany(ctx, {
      where: {
        OR: [
          { status: { eq: "running" } },
          { status: { eq: "waiting_approval" } },
        ],
      },
    });
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLogRecord[] = [];

  public async record(
    log:
      | Omit<AuditLogRecord, "id">
      | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord> {
    const fullLog: AuditLogRecord = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date().toISOString(),
    };
    this.logs.unshift(fullLog);
    return fullLog;
  }

  private tenantLogs(ctx: TenantContext): AuditLogRecord[] {
    return this.logs.filter((log) => log.organizationId === ctx.organizationId);
  }

  public async findMany(
    ctx: TenantContext,
    query?: QuerySpecification<AuditLogRecord>
  ): Promise<PaginatedResult<AuditLogRecord>> {
    return applyQuerySpecificationPaginated(
      this.tenantLogs(ctx),
      query,
      ctx.organizationId,
      "AuditLog"
    );
  }

  public async findOne(
    ctx: TenantContext,
    query?: QuerySpecification<AuditLogRecord>
  ): Promise<AuditLogRecord | undefined> {
    const page = await this.findMany(ctx, {
      ...(query || {}),
      limit: 1,
      cursor: null,
    });
    return page.items[0];
  }

  public async count(
    ctx: TenantContext,
    query?: QuerySpecification<AuditLogRecord>
  ): Promise<number> {
    const nonPaginatedSpec = query
      ? { where: query.where, search: query.search }
      : undefined;
    return this.tenantLogs(ctx).filter((log) =>
      matchesSpecification(log, nonPaginatedSpec)
    ).length;
  }

  public clear(): void {
    this.logs = [];
  }

  public getSnapshot(): AuditLogRecord[] {
    return [...this.logs];
  }

  public restoreSnapshot(snapshot: AuditLogRecord[]): void {
    this.logs = [...snapshot];
  }
}
