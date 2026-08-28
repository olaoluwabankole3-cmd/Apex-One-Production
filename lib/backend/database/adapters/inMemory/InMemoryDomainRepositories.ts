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
  CollectionQuery,
  CUSTOMER_SORT_FIELDS,
  CustomerSortField,
  CustomerQueryFilter,
  CONTRACT_SORT_FIELDS,
  ContractSortField,
  ContractQueryFilter,
  TRANSACTION_SORT_FIELDS,
  TransactionSortField,
  TransactionQueryFilter,
  SIGNAL_SORT_FIELDS,
  SignalSortField,
  SignalQueryFilter,
  VALUE_OPPORTUNITY_SORT_FIELDS,
  ValueOpportunitySortField,
  ValueOpportunityQueryFilter,
  VALUE_CAPTURED_SORT_FIELDS,
  ValueCapturedSortField,
  ValueCapturedQueryFilter,
  ORGANIZATIONAL_MEMORY_SORT_FIELDS,
  OrganizationalMemorySortField,
  OrganizationalMemoryQueryFilter,
  ACTION_SORT_FIELDS,
  ActionSortField,
  ActionQueryFilter,
  DOCUMENT_SORT_FIELDS,
  DocumentSortField,
  DocumentQueryFilter,
  KNOWLEDGE_SORT_FIELDS,
  KnowledgeSortField,
  KnowledgeQueryFilter,
  WORKFLOW_SORT_FIELDS,
  WorkflowSortField,
  WorkflowQueryFilter,
  WORKFLOW_RUN_SORT_FIELDS,
  WorkflowRunSortField,
  WorkflowRunQueryFilter,
  AUDIT_LOG_SORT_FIELDS,
  AuditLogSortField,
  AuditLogQueryFilter,
  normalizeQueryLimit,
  normalizeQueryOffset,
  validateSortOptions,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../../repository";
import { TenantContext } from "../../../core/errors";
import { Validator } from "../../../core/validation";
import {
  RelationshipValidator,
  IEntityLookupStore,
} from "../../relationshipValidator";

export class InMemoryCustomerRepository
  extends InMemoryTenantRepository<CustomerRecord, UpdateCustomerInput, CustomerQueryFilter, CustomerSortField>
  implements ICustomerRepository
{
  protected override readonly allowedSortFields = CUSTOMER_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, CustomerRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: CustomerRecord[],
    filter?: CustomerQueryFilter
  ): CustomerRecord[] {
    if (!filter) return items;

    return items.filter((c) => {
      if (filter.tier && filter.tier !== "all" && c.tier !== filter.tier) return false;
      if (filter.status && filter.status !== "all" && c.status !== filter.status) return false;
      if (filter.contactEmail && c.contactEmail.toLowerCase() !== filter.contactEmail.toLowerCase()) return false;
      if (filter.industry && c.industry !== filter.industry) return false;
      if (filter.owner && c.owner !== filter.owner) return false;
      if (filter.subsidiary && c.subsidiary !== filter.subsidiary) return false;
      if (filter.minHealthScore !== undefined && c.healthScore < filter.minHealthScore) return false;
      if (filter.maxHealthScore !== undefined && c.healthScore > filter.maxHealthScore) return false;
      if (filter.minArr !== undefined && c.arr < filter.minArr) return false;
      if (filter.maxArr !== undefined && c.arr > filter.maxArr) return false;
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((t) => c.tags?.includes(t));
        if (!hasTag) return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.owner && c.owner.toLowerCase().includes(q)) ||
          (c.contactName && c.contactName.toLowerCase().includes(q)) ||
          (c.contactEmail && c.contactEmail.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }

  public async findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined> {
    const list = await this.findMany(ctx, { filter: { contactEmail: email }, limit: 1 });
    return list[0];
  }

  public async findAtRisk(ctx: TenantContext): Promise<CustomerRecord[]> {
    return this.findMany(ctx, { filter: { status: "at-risk" } });
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
  extends InMemoryTenantRepository<ContractRecord, UpdateContractInput, ContractQueryFilter, ContractSortField>
  implements IContractRepository
{
  protected override readonly allowedSortFields = CONTRACT_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, ContractRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: ContractRecord[],
    filter?: ContractQueryFilter
  ): ContractRecord[] {
    if (!filter) return items;

    return items.filter((c) => {
      if (filter.customerId && c.customerId !== filter.customerId) return false;
      if (filter.status && filter.status !== "all" && c.status !== filter.status) return false;
      if (filter.maxRenewalDays !== undefined && c.renewalDaysRemaining > filter.maxRenewalDays) return false;
      if (filter.minContractValue !== undefined && c.contractValue < filter.minContractValue) return false;
      if (filter.maxContractValue !== undefined && c.contractValue > filter.maxContractValue) return false;
      if (
        filter.volatilityIndexationClause !== undefined &&
        c.volatilityIndexationClause !== filter.volatilityIndexationClause
      ) {
        return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        if (!c.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
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
    updates: UpdateContractInput,
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
    return this.findMany(ctx, { filter: { customerId } });
  }

  public async findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<ContractRecord[]> {
    return this.findMany(ctx, { filter: { maxRenewalDays: daysThreshold, status: "active" } });
  }
}

export class InMemoryTransactionRepository
  extends InMemoryTenantRepository<TransactionRecord, UpdateTransactionInput, TransactionQueryFilter, TransactionSortField>
  implements ITransactionRepository
{
  protected override readonly allowedSortFields = TRANSACTION_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, TransactionRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: TransactionRecord[],
    filter?: TransactionQueryFilter
  ): TransactionRecord[] {
    if (!filter) return items;

    return items.filter((t) => {
      if (filter.customerId && t.customerId !== filter.customerId) return false;
      if (filter.type && filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.status && filter.status !== "all" && t.status !== filter.status) return false;
      if (filter.currency && t.currency.toUpperCase() !== filter.currency.toUpperCase()) return false;
      if (filter.category && t.category !== filter.category) return false;
      if (filter.minAmount !== undefined && t.amount < filter.minAmount) return false;
      if (filter.maxAmount !== undefined && t.amount > filter.maxAmount) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match = t.reference.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    updates: UpdateTransactionInput,
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
    return this.findMany(ctx, { filter: { customerId } });
  }

  public async calculateFinancialTotals(ctx: TenantContext): Promise<FinancialTotalsResult> {
    const records = await this.findMany(ctx, { limit: MAX_PAGE_SIZE });
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
  extends InMemoryTenantRepository<SignalRecord, UpdateSignalInput, SignalQueryFilter, SignalSortField>
  implements ISignalRepository
{
  protected override readonly allowedSortFields = SIGNAL_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, SignalRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: SignalRecord[],
    filter?: SignalQueryFilter
  ): SignalRecord[] {
    if (!filter) return items;

    return items.filter((s) => {
      if (filter.category && filter.category !== "all" && s.category !== filter.category) return false;
      if (filter.severity && filter.severity !== "all" && s.severity !== filter.severity) return false;
      if (filter.status && filter.status !== "all" && s.status !== filter.status) return false;
      if (filter.minImpact !== undefined && s.estimatedFinancialImpact < filter.minImpact) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match = s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    return this.findMany(ctx, {
      filter: { status: "active", category: category as SignalQueryFilter["category"] },
    });
  }
}

export class InMemoryValueOpportunityRepository
  extends InMemoryTenantRepository<
    ValueOpportunityRecord,
    UpdateValueOpportunityInput,
    ValueOpportunityQueryFilter,
    ValueOpportunitySortField
  >
  implements IValueOpportunityRepository
{
  protected override readonly allowedSortFields = VALUE_OPPORTUNITY_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, ValueOpportunityRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: ValueOpportunityRecord[],
    filter?: ValueOpportunityQueryFilter
  ): ValueOpportunityRecord[] {
    if (!filter) return items;

    return items.filter((o) => {
      if (filter.category && filter.category !== "all" && o.category !== filter.category) return false;
      if (filter.status && filter.status !== "all" && o.status !== filter.status) return false;
      if (filter.sourceEntityType && o.sourceEntityType !== filter.sourceEntityType) return false;
      if (filter.sourceEntityId && o.sourceEntityId !== filter.sourceEntityId) return false;
      if (filter.realizationSpeed && o.realizationSpeed !== filter.realizationSpeed) return false;
      if (filter.strategicImportance && o.strategicImportance !== filter.strategicImportance) return false;
      if (filter.minPotentialValue !== undefined && o.potentialValue < filter.minPotentialValue) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          o.title.toLowerCase().includes(q) ||
          o.recommendedAction.toLowerCase().includes(q) ||
          o.evidence.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    return this.findMany(ctx, { filter: { category: category as ValueOpportunityQueryFilter["category"] } });
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]> {
    return this.findMany(ctx, { filter: { status: status as ValueOpportunityQueryFilter["status"] } });
  }
}

export class InMemoryValueCapturedRepository
  extends InMemoryTenantRepository<
    ValueCapturedRecord,
    UpdateValueCapturedInput,
    ValueCapturedQueryFilter,
    ValueCapturedSortField
  >
  implements IValueCapturedRepository
{
  protected override readonly allowedSortFields = VALUE_CAPTURED_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, ValueCapturedRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: ValueCapturedRecord[],
    filter?: ValueCapturedQueryFilter
  ): ValueCapturedRecord[] {
    if (!filter) return items;

    return items.filter((c) => {
      if (filter.opportunityId && c.opportunityId !== filter.opportunityId) return false;
      if (filter.category && filter.category !== "all" && c.category !== filter.category) return false;
      if (filter.evidenceType && c.evidenceType !== filter.evidenceType) return false;
      if (filter.certifiedBy && c.certifiedBy !== filter.certifiedBy) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          c.opportunityTitle.toLowerCase().includes(q) ||
          c.evidenceDescription.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    updates: UpdateValueCapturedInput,
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
    const list = await this.findMany(ctx, { limit: MAX_PAGE_SIZE });
    return list.reduce((sum, item) => sum + item.capturedValue, 0);
  }
}

export class InMemoryOrganizationalMemoryRepository
  extends InMemoryTenantRepository<
    OrganizationalMemoryRecord,
    UpdateOrganizationalMemoryInput,
    OrganizationalMemoryQueryFilter,
    OrganizationalMemorySortField
  >
  implements IOrganizationalMemoryRepository
{
  protected override readonly allowedSortFields = ORGANIZATIONAL_MEMORY_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, OrganizationalMemoryRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: OrganizationalMemoryRecord[],
    filter?: OrganizationalMemoryQueryFilter
  ): OrganizationalMemoryRecord[] {
    if (!filter) return items;

    return items.filter((m) => {
      if (filter.type && filter.type !== "all" && m.type !== filter.type) return false;
      if (filter.source && m.source !== filter.source) return false;
      if (filter.verified !== undefined && m.verified !== filter.verified) return false;
      if (filter.keywords && filter.keywords.length > 0) {
        const target = `${m.title} ${m.content} ${m.source}`.toLowerCase();
        const matchesAny = filter.keywords.some((k) => target.includes(k.toLowerCase()));
        if (!matchesAny) return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const target = `${m.title} ${m.content} ${m.source}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }

  public async searchKeywords(keywords: string[], ctx: TenantContext): Promise<OrganizationalMemoryRecord[]> {
    return this.findMany(ctx, { filter: { keywords } });
  }
}

export class InMemoryActionRepository
  extends InMemoryTenantRepository<ActionRecord, UpdateActionInput, ActionQueryFilter, ActionSortField>
  implements IActionRepository
{
  protected override readonly allowedSortFields = ACTION_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, ActionRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: ActionRecord[],
    filter?: ActionQueryFilter
  ): ActionRecord[] {
    if (!filter) return items;

    return items.filter((a) => {
      if (filter.status && filter.status !== "all" && a.status !== filter.status) return false;
      if (filter.automationType && filter.automationType !== "all" && a.automationType !== filter.automationType) return false;
      if (filter.owner && a.owner !== filter.owner) return false;
      if (filter.requiresHumanApproval !== undefined && a.requiresHumanApproval !== filter.requiresHumanApproval) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          a.recommendation.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.decisionDetail.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<ActionRecord[]> {
    return this.findMany(ctx, { filter: { status: status as ActionQueryFilter["status"] } });
  }
}

export class InMemoryDocumentRepository
  extends InMemoryTenantRepository<DocumentRecord, UpdateDocumentInput, DocumentQueryFilter, DocumentSortField>
  implements IDocumentRepository
{
  protected override readonly allowedSortFields = DOCUMENT_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, DocumentRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: DocumentRecord[],
    filter?: DocumentQueryFilter
  ): DocumentRecord[] {
    if (!filter) return items;

    return items.filter((d) => {
      if (filter.customerId && d.customerId !== filter.customerId) return false;
      if (filter.category && filter.category !== "all" && d.category !== filter.category) return false;
      if (filter.status && filter.status !== "all" && d.status !== filter.status) return false;
      if (filter.fileType && filter.fileType !== "all" && d.fileType !== filter.fileType) return false;
      if (filter.uploadedBy && d.uploadedBy !== filter.uploadedBy) return false;
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((t) => d.tags?.includes(t));
        if (!hasTag) return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match = d.name.toLowerCase().includes(q) || (d.aiSummary && d.aiSummary.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
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
    updates: UpdateDocumentInput,
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
    return this.findMany(ctx, { filter: { category: category as DocumentQueryFilter["category"] } });
  }

  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, { filter: { customerId } });
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, { filter: { status: status as DocumentQueryFilter["status"] } });
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
  extends InMemoryTenantRepository<KnowledgeItemRecord, UpdateKnowledgeItemInput, KnowledgeQueryFilter, KnowledgeSortField>
  implements IKnowledgeRepository
{
  protected override readonly allowedSortFields = KNOWLEDGE_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, KnowledgeItemRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: KnowledgeItemRecord[],
    filter?: KnowledgeQueryFilter
  ): KnowledgeItemRecord[] {
    if (!filter) return items;

    return items.filter((k) => {
      if (filter.category && filter.category !== "all" && k.category !== filter.category) return false;
      if (filter.sourceDocId && k.sourceDocId !== filter.sourceDocId) return false;
      if (filter.author && k.author !== filter.author) return false;
      if (filter.isPublicPlatformKnowledge !== undefined && k.isPublicPlatformKnowledge !== filter.isPublicPlatformKnowledge) {
        return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((t) => k.tags?.includes(t));
        if (!hasTag) return false;
      }
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match =
          k.title.toLowerCase().includes(q) ||
          k.content.toLowerCase().includes(q) ||
          (k.summary && k.summary.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
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
    updates: UpdateKnowledgeItemInput,
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
    return this.findMany(ctx, { filter: { category: category as KnowledgeQueryFilter["category"] } });
  }

  public async findByTags(tags: string[], ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, { filter: { tags } });
  }

  public async searchContent(query: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, { filter: { search: query } });
  }
}

export class InMemoryWorkflowRepository
  extends InMemoryTenantRepository<WorkflowRecord, UpdateWorkflowInput, WorkflowQueryFilter, WorkflowSortField>
  implements IWorkflowRepository
{
  protected override readonly allowedSortFields = WORKFLOW_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, WorkflowRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: WorkflowRecord[],
    filter?: WorkflowQueryFilter
  ): WorkflowRecord[] {
    if (!filter) return items;

    return items.filter((w) => {
      if (filter.status && filter.status !== "all" && w.status !== filter.status) return false;
      if (filter.subsidiary && w.subsidiary !== filter.subsidiary) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase().trim();
        const match = w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
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
    return this.findMany(ctx, { filter: { status: "active" } });
  }
}

export class InMemoryWorkflowRunRepository
  extends InMemoryTenantRepository<
    WorkflowRunRecord,
    UpdateWorkflowRunInput,
    WorkflowRunQueryFilter,
    WorkflowRunSortField
  >
  implements IWorkflowRunRepository
{
  protected override readonly allowedSortFields = WORKFLOW_RUN_SORT_FIELDS;

  constructor(
    collectionName: string,
    store: Map<string, WorkflowRunRecord>,
    onAuditViolation?: (ctx: TenantContext, resourceId: string, attemptedOrg: string) => void,
    protected readonly entityLookupStore?: IEntityLookupStore
  ) {
    super(collectionName, store, onAuditViolation);
  }

  protected override applyStructuredFilter(
    items: WorkflowRunRecord[],
    filter?: WorkflowRunQueryFilter
  ): WorkflowRunRecord[] {
    if (!filter) return items;

    return items.filter((r) => {
      if (filter.workflowId && r.workflowId !== filter.workflowId) return false;
      if (filter.status && filter.status !== "all" && r.status !== filter.status) return false;
      if (filter.triggeredBy && r.triggeredBy !== filter.triggeredBy) return false;
      if (filter.triggerType && filter.triggerType !== "all" && r.triggerType !== filter.triggerType) return false;
      if (filter.activeOnly && r.status !== "running" && r.status !== "waiting_approval") return false;
      return true;
    });
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
    updates: UpdateWorkflowRunInput,
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
    return this.findMany(ctx, { filter: { workflowId } });
  }

  public async findActiveRuns(ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    return this.findMany(ctx, { filter: { activeOnly: true } });
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLogRecord[] = [];
  private readonly allowedSortFields = AUDIT_LOG_SORT_FIELDS;

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

  public async findMany(
    ctx: TenantContext,
    queryOrLimit?: CollectionQuery<AuditLogQueryFilter, AuditLogSortField> | number
  ): Promise<AuditLogRecord[]> {
    // 1. TENANT SAFETY: Strictly isolate by authenticated organizationId
    let filtered = this.logs.filter((log) => log.organizationId === ctx.organizationId);

    if (typeof queryOrLimit === "number") {
      const limit = normalizeQueryLimit(queryOrLimit);
      return filtered.slice(0, limit);
    }

    const query = queryOrLimit;
    const limit = normalizeQueryLimit(query?.limit);
    const offset = normalizeQueryOffset(query?.offset);

    // Apply structured filter
    if (query?.filter) {
      const f = query.filter;
      filtered = filtered.filter((log) => {
        if (f.actorId && log.actorId !== f.actorId) return false;
        if (f.actorEmail && log.actorEmail.toLowerCase() !== f.actorEmail.toLowerCase()) return false;
        if (f.action && log.action !== f.action) return false;
        if (f.resource && log.resource !== f.resource) return false;
        if (f.resourceId && log.resourceId !== f.resourceId) return false;
        if (f.requestId && log.requestId !== f.requestId) return false;
        if (f.status && f.status !== "all" && log.status !== f.status) return false;
        return true;
      });
    }

    // Apply sort
    if (query?.sort) {
      const validatedSort = validateSortOptions(query.sort, this.allowedSortFields);
      if (validatedSort) {
        const { field, direction = "asc" } = validatedSort;
        const modifier = direction === "desc" ? -1 : 1;
        filtered = [...filtered].sort((a, b) => {
          const valA = a[field] ?? "";
          const valB = b[field] ?? "";
          return String(valA).localeCompare(String(valB)) * modifier;
        });
      }
    }

    return filtered.slice(offset, offset + limit);
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
