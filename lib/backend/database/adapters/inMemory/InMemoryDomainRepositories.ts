/**
 * APEX ONE — Concrete In-Memory Domain Repository Adapters
 * 
 * ARCHITECTURAL NOTICE:
 * These in-memory adapters implement the formal domain repository interfaces.
 * They serve as temporary mocks/in-memory data stores for prototyping and unit tests.
 * All implementations enforce tenant boundaries strictly.
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
} from "../../repository";
import { TenantContext } from "../../../core/errors";
import { Validator } from "../../../core/validation";
import {
  RelationshipValidator,
  IEntityLookupStore,
} from "../../relationshipValidator";

export class InMemoryCustomerRepository
  extends InMemoryTenantRepository<CustomerRecord>
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
    const list = await this.findMany(ctx, (c) => c.contactEmail.toLowerCase() === email.toLowerCase());
    return list[0];
  }

  public async findAtRisk(ctx: TenantContext): Promise<CustomerRecord[]> {
    return this.findMany(ctx, (c) => c.status === "at-risk" || c.healthScore < 70);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateCustomerCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "customer:delete",
        resource: "Customer",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }
}

export class InMemoryContractRepository
  extends InMemoryTenantRepository<ContractRecord>
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
    RelationshipValidator.validateCustomerBelongsToTenant(data.customerId, ctx, this.entityLookupStore, {
      optional: false,
      resourceContext: "Contract",
    });
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<ContractRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ContractRecord> {
    if (updates.customerId !== undefined) {
      RelationshipValidator.validateCustomerBelongsToTenant(updates.customerId, ctx, this.entityLookupStore, {
        optional: false,
        resourceContext: "Contract",
      });
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
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "contract:delete",
        resource: "Contract",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }

  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<ContractRecord[]> {
    return this.findMany(ctx, (c) => c.customerId === customerId);
  }

  public async findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<ContractRecord[]> {
    return this.findMany(ctx, (c) => c.renewalDaysRemaining <= daysThreshold && c.status === "active");
  }
}

export class InMemoryTransactionRepository
  extends InMemoryTenantRepository<TransactionRecord>
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
    RelationshipValidator.validateCustomerBelongsToTenant(data.customerId, ctx, this.entityLookupStore, {
      optional: false,
      resourceContext: "Transaction",
    });
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<TransactionRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<TransactionRecord> {
    if (updates.customerId !== undefined) {
      RelationshipValidator.validateCustomerBelongsToTenant(updates.customerId, ctx, this.entityLookupStore, {
        optional: false,
        resourceContext: "Transaction",
      });
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
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "transaction:delete",
        resource: "Transaction",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }

  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<TransactionRecord[]> {
    return this.findMany(ctx, (t) => t.customerId === customerId);
  }

  public async calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult> {
    const records = await this.findMany(ctx);
    const byCurrency: Record<string, FinancialTotalsByCurrency> = {};

    for (const rec of records) {
      const canonicalCurrency = Validator.normalizeCurrency(rec.currency);
      if (!canonicalCurrency) {
        // Skip unaggregatable / invalid / missing currencies without silently converting or corrupting totals
        continue;
      }

      if (!byCurrency[canonicalCurrency]) {
        byCurrency[canonicalCurrency] = {
          totalRevenue: 0,
          totalCosts: 0,
          net: 0,
          transactionCount: 0,
        };
      }

      // Only cleared status counts toward realized revenue and costs
      if (rec.status === "cleared") {
        byCurrency[canonicalCurrency].transactionCount += 1;
        if (rec.type === "revenue") {
          byCurrency[canonicalCurrency].totalRevenue += rec.amount;
        } else if (rec.type === "cost") {
          byCurrency[canonicalCurrency].totalCosts += rec.amount;
        }
        byCurrency[canonicalCurrency].net =
          byCurrency[canonicalCurrency].totalRevenue - byCurrency[canonicalCurrency].totalCosts;
      }
    }

    const activeCurrencies = Object.keys(byCurrency);

    if (activeCurrencies.length === 1) {
      const singleCurrency = activeCurrencies[0];
      return {
        byCurrency,
        isMixedCurrency: false,
        currency: singleCurrency,
        totalRevenue: byCurrency[singleCurrency].totalRevenue,
        totalCosts: byCurrency[singleCurrency].totalCosts,
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

    // Mixed currencies: never sum amounts across different currencies!
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
  extends InMemoryTenantRepository<SignalRecord>
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
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "signal:delete",
        resource: "Signal",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }

  public async findActiveByCategory(category: string, ctx: TenantContext): Promise<SignalRecord[]> {
    return this.findMany(ctx, (s) => s.status === "active" && (category === "all" || s.category === category));
  }
}

export class InMemoryValueOpportunityRepository
  extends InMemoryTenantRepository<ValueOpportunityRecord>
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
    updates: Partial<ValueOpportunityRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ValueOpportunityRecord> {
    if (updates.sourceEntityType !== undefined || updates.sourceEntityId !== undefined) {
      const existing = await this.findById(id, ctx, resourceName);
      const effectiveType =
        updates.sourceEntityType !== undefined ? updates.sourceEntityType : existing.sourceEntityType;
      const effectiveId =
        updates.sourceEntityId !== undefined ? updates.sourceEntityId : existing.sourceEntityId;
      RelationshipValidator.validatePolymorphicSourceEntity(
        effectiveType,
        effectiveId,
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
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "valueopportunity:delete",
        resource: "ValueOpportunity",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }

  public async findByCategory(category: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]> {
    return this.findMany(ctx, (o) => category === "all" || o.category === category);
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]> {
    return this.findMany(ctx, (o) => status === "all" || o.status === status);
  }
}

export class InMemoryValueCapturedRepository
  extends InMemoryTenantRepository<ValueCapturedRecord>
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
    RelationshipValidator.validateOpportunityBelongsToTenant(data.opportunityId, ctx, this.entityLookupStore, {
      optional: true,
      resourceContext: "ValueCaptured",
    });
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<ValueCapturedRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<ValueCapturedRecord> {
    if (updates.opportunityId !== undefined && updates.opportunityId !== null && updates.opportunityId !== "") {
      RelationshipValidator.validateOpportunityBelongsToTenant(updates.opportunityId, ctx, this.entityLookupStore, {
        optional: true,
        resourceContext: "ValueCaptured",
      });
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async calculateTotalCaptured(ctx: TenantContext): Promise<number> {
    const list = await this.findMany(ctx);
    return list.reduce((sum, item) => sum + item.capturedValue, 0);
  }
}

export class InMemoryOrganizationalMemoryRepository
  extends InMemoryTenantRepository<OrganizationalMemoryRecord>
  implements IOrganizationalMemoryRepository
{
  constructor(
    collectionName: string,
    store: Map<string, OrganizationalMemoryRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public async searchKeywords(keywords: string[], ctx: TenantContext): Promise<OrganizationalMemoryRecord[]> {
    const lowerKeys = keywords.map((k) => k.toLowerCase());
    return this.findMany(ctx, (m) => {
      const target = `${m.title} ${m.content} ${m.source}`.toLowerCase();
      return lowerKeys.some((k) => target.includes(k));
    });
  }
}

export class InMemoryActionRepository
  extends InMemoryTenantRepository<ActionRecord>
  implements IActionRepository
{
  constructor(
    collectionName: string,
    store: Map<string, ActionRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<ActionRecord[]> {
    return this.findMany(ctx, (a) => status === "all" || a.status === status);
  }
}

export class InMemoryDocumentRepository
  extends InMemoryTenantRepository<DocumentRecord>
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
    RelationshipValidator.validateCustomerBelongsToTenant(data.customerId, ctx, this.entityLookupStore, {
      optional: true,
      resourceContext: "Document",
    });
    if (data.uploadedBy) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(data.uploadedBy, ctx, this.entityLookupStore, {
        optional: true,
        resourceContext: "Document.uploadedBy",
      });
    }
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<DocumentRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<DocumentRecord> {
    if (updates.customerId !== undefined && updates.customerId !== null && updates.customerId !== "") {
      RelationshipValidator.validateCustomerBelongsToTenant(updates.customerId, ctx, this.entityLookupStore, {
        optional: true,
        resourceContext: "Document",
      });
    }
    if (updates.uploadedBy !== undefined && updates.uploadedBy !== null && updates.uploadedBy !== "") {
      RelationshipValidator.validateUserMembershipBelongsToTenant(updates.uploadedBy, ctx, this.entityLookupStore, {
        optional: true,
        resourceContext: "Document.uploadedBy",
      });
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByCategory(category: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => category === "all" || d.category === category);
  }

  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => d.customerId === customerId);
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => status === "all" || d.status === status);
  }

  public override async delete(
    id: string,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<boolean> {
    await this.findById(id, ctx, resourceName);
    RelationshipValidator.validateDocumentCanBeDeleted(id, ctx, this.entityLookupStore);
    const deleted = this.store.delete(id);
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "document:delete",
        resource: "Document",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }
}

export class InMemoryKnowledgeRepository
  extends InMemoryTenantRepository<KnowledgeItemRecord>
  implements IKnowledgeRepository
{
  constructor(
    collectionName: string,
    store: Map<string, KnowledgeItemRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  public override async create(
    data: Omit<KnowledgeItemRecord, "organizationId">,
    ctx: TenantContext
  ): Promise<KnowledgeItemRecord> {
    RelationshipValidator.validateDocumentBelongsToTenant(data.sourceDocId, ctx, this.entityLookupStore, {
      optional: true,
      resourceContext: "KnowledgeItem",
    });
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<KnowledgeItemRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<KnowledgeItemRecord> {
    if (updates.sourceDocId !== undefined && updates.sourceDocId !== null && updates.sourceDocId !== "") {
      RelationshipValidator.validateDocumentBelongsToTenant(updates.sourceDocId, ctx, this.entityLookupStore, {
        optional: true,
        resourceContext: "KnowledgeItem",
      });
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByCategory(category: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, (k) => category === "all" || k.category === category);
  }

  public async findByTags(tags: string[], ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, (k) => tags.some((t) => k.tags.includes(t)));
  }

  public async searchContent(query: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    const q = query.toLowerCase().trim();
    return this.findMany(ctx, (k) => {
      return (
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        (k.summary && k.summary.toLowerCase().includes(q)) ||
        k.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }
}

export class InMemoryWorkflowRepository
  extends InMemoryTenantRepository<WorkflowRecord>
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
    if (deleted && this.entityLookupStore?.recordAuditLog) {
      this.entityLookupStore.recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        actorEmail: ctx.userEmail,
        action: "workflow:delete",
        resource: "Workflow",
        resourceId: id,
        requestId: ctx.requestId,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
    return deleted;
  }

  public async findActive(ctx: TenantContext): Promise<WorkflowRecord[]> {
    return this.findMany(ctx, (w) => w.status === "active");
  }
}

export class InMemoryWorkflowRunRepository
  extends InMemoryTenantRepository<WorkflowRunRecord>
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
    RelationshipValidator.validateWorkflowBelongsToTenant(data.workflowId, ctx, this.entityLookupStore, {
      optional: false,
      resourceContext: "WorkflowRun",
    });
    if (data.triggeredBy) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(data.triggeredBy, ctx, this.entityLookupStore, {
        optional: false,
        resourceContext: "WorkflowRun.triggeredBy",
      });
    }
    return super.create(data, ctx);
  }

  public override async update(
    id: string,
    updates: Partial<WorkflowRunRecord>,
    ctx: TenantContext,
    resourceName: string = this.collectionName
  ): Promise<WorkflowRunRecord> {
    if (updates.workflowId !== undefined) {
      RelationshipValidator.validateWorkflowBelongsToTenant(updates.workflowId, ctx, this.entityLookupStore, {
        optional: false,
        resourceContext: "WorkflowRun",
      });
    }
    if (updates.triggeredBy !== undefined) {
      RelationshipValidator.validateUserMembershipBelongsToTenant(updates.triggeredBy, ctx, this.entityLookupStore, {
        optional: false,
        resourceContext: "WorkflowRun.triggeredBy",
      });
    }
    return super.update(id, updates, ctx, resourceName);
  }

  public async findByWorkflow(workflowId: string, ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    return this.findMany(ctx, (r) => r.workflowId === workflowId);
  }

  public async findActiveRuns(ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    return this.findMany(ctx, (r) => r.status === "running" || r.status === "waiting_approval");
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLogRecord[] = [];

  public async record(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord> {
    const fullLog: AuditLogRecord = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date().toISOString(),
    };
    this.logs.unshift(fullLog);
    return fullLog;
  }

  public async findMany(ctx: TenantContext, limit: number = 50): Promise<AuditLogRecord[]> {
    return this.logs
      .filter((log) => log.organizationId === ctx.organizationId)
      .slice(0, limit);
  }

  public clear(): void {
    this.logs = [];
  }
}

