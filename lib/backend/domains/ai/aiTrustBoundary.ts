import type { PermissionCapability, TenantContext } from "../../core/errors";
import { requirePermission } from "../../core/security";
import type { DatabaseStore } from "../../database/store";
import type { QuerySpecification } from "../../database/querySpecification";
import { EvidenceService } from "../evidence/evidenceService";
import type {
  CertificationState,
  EvidenceSubjectType,
  VerificationState,
} from "../evidence/model";

/**
 * Stage 8 AI trust boundary.
 *
 * The model never selects or executes these tools. A deterministic planner
 * chooses a bounded set from the authenticated query/mode, and every handler
 * independently re-checks the underlying data permission before reading.
 */
export const AI_TOOL_RECORD_LIMIT = 25;
export const AI_MAX_TOOL_CALLS = 3;
export const AI_MAX_CONTEXT_RECORDS = AI_TOOL_RECORD_LIMIT * AI_MAX_TOOL_CALLS;

export type AiDataToolName =
  | "get_tenant_customers"
  | "get_value_opportunities"
  | "get_organizational_memory"
  | "get_tenant_documents"
  | "get_tenant_contracts"
  | "get_operational_signals";

export interface AiTrustQuery {
  prompt: string;
  mode?: string;
  contextMemoryIds?: string[];
}

export interface AiToolCallPlan {
  tool: AiDataToolName;
  limit: number;
  searchTerm?: string;
  ids?: string[];
  filters?: Record<string, string>;
}

export interface AiDeniedTool {
  tool: AiDataToolName;
  requiredPermission: PermissionCapability;
  reason: "missing_permission";
}

export interface AiRetrievalPlan {
  requestedTools: AiDataToolName[];
  calls: AiToolCallPlan[];
  deniedTools: AiDeniedTool[];
  queryScope: string;
  maxToolCalls: number;
  maxRecordsPerTool: number;
}

export interface AiProvenanceReference {
  entityType: EvidenceSubjectType;
  entityId: string;
  sourceReference: string;
  verificationState: VerificationState;
  certificationState: CertificationState;
}

export type AiSafeFieldValue = string | number | boolean | null | string[];

export interface AiRetrievedRecord {
  entityType: EvidenceSubjectType;
  entityId: string;
  fields: Record<string, AiSafeFieldValue>;
  provenance: AiProvenanceReference;
}

export interface AiToolExecutionResult {
  tool: AiDataToolName;
  requiredPermission: PermissionCapability;
  totalMatched: number;
  records: AiRetrievedRecord[];
  scopeComplete: boolean;
}

export interface AiRetrievalExecution {
  results: AiToolExecutionResult[];
  requestedTools: AiDataToolName[];
  executedTools: AiDataToolName[];
  deniedTools: AiDeniedTool[];
  recordsRetrieved: number;
  queryScope: string;
  recordLimitPerTool: number;
}

export interface AiToolDefinition {
  name: AiDataToolName;
  description: string;
  requiredPermission: PermissionCapability;
  handler: (call: AiToolCallPlan, ctx: TenantContext) => Promise<AiToolExecutionResult>;
}

const TOOL_PERMISSIONS: Record<AiDataToolName, PermissionCapability> = {
  get_tenant_customers: "customer:read",
  get_value_opportunities: "value:read",
  get_organizational_memory: "knowledge:read",
  get_tenant_documents: "document:read",
  get_tenant_contracts: "financial:read",
  get_operational_signals: "workflow:read",
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "give", "how", "i", "in",
  "is", "it", "me", "of", "on", "or", "our", "show", "tell", "that", "the", "their", "this", "to",
  "what", "which", "who", "with", "about", "please", "provide", "analyze", "analyse", "review", "across",
  "enterprise", "organization", "organisation", "company", "business",
]);

function hasPermission(ctx: TenantContext, capability: PermissionCapability): boolean {
  return ctx.isSuperAdmin === true || ctx.permissions.includes(capability);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeContextIds(ids?: string[]): string[] {
  if (!ids) return [];
  return unique(ids.map((id) => id.trim()).filter(Boolean)).slice(0, AI_TOOL_RECORD_LIMIT);
}

function extractSearchTerm(prompt: string): string | undefined {
  const quoted = prompt.match(/["“']([^"”']{2,80})["”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  // Only turn a compact, specific query into a repository search term.
  // Broad questions stay domain-scoped rather than becoming accidental full-text misses.
  if (words.length > 0 && words.length <= 3) return words.join(" ").slice(0, 80);
  return undefined;
}

function requestedToolsForQuery(query: AiTrustQuery): AiDataToolName[] {
  const text = `${query.mode || ""} ${query.prompt}`.toLowerCase();
  const tools: AiDataToolName[] = [];

  if (normalizeContextIds(query.contextMemoryIds).length > 0) tools.push("get_organizational_memory");

  const keywordGroups: Array<[AiDataToolName, RegExp]> = [
    ["get_tenant_customers", /\b(customer|customers|account|accounts|client|clients|arr|retention|churn|health)\b/],
    ["get_tenant_contracts", /\b(contract|contracts|sla|renewal|renewals|pricing|indexation|agreement|agreements)\b/],
    ["get_value_opportunities", /\b(opportunity|opportunities|value|leakage|recovery|expansion|captur|revenue)\b/],
    ["get_organizational_memory", /\b(memory|memories|decision|decisions|policy|policies|history|historical|institutional)\b/],
    ["get_tenant_documents", /\b(document|documents|file|files|report|reports|board paper|invoice|audit report)\b/],
    ["get_operational_signals", /\b(operation|operations|operational|capacity|signal|signals|incident|incidents|compliance|risk)\b/],
  ];

  for (const [tool, pattern] of keywordGroups) {
    if (pattern.test(text)) tools.push(tool);
  }

  if (tools.length === 0) {
    switch ((query.mode || "Executive").toLowerCase()) {
      case "revenue":
        tools.push("get_tenant_customers", "get_tenant_contracts", "get_value_opportunities");
        break;
      case "customers":
        tools.push("get_tenant_customers");
        break;
      case "operations":
      case "capacity":
        tools.push("get_operational_signals");
        break;
      case "leakage":
        tools.push("get_value_opportunities", "get_tenant_contracts", "get_operational_signals");
        break;
      case "opportunities":
        tools.push("get_value_opportunities");
        break;
      case "strategy":
        tools.push("get_organizational_memory", "get_value_opportunities");
        break;
      default:
        tools.push("get_tenant_customers", "get_value_opportunities", "get_operational_signals");
    }
  }

  return unique(tools).slice(0, AI_MAX_TOOL_CALLS);
}

function filtersForTool(tool: AiDataToolName, prompt: string): Record<string, string> | undefined {
  const lower = prompt.toLowerCase();

  if (tool === "get_tenant_customers") {
    if (/\bat[- ]risk\b/.test(lower)) return { status: "at-risk" };
    if (/\bonboarding\b/.test(lower)) return { status: "onboarding" };
    if (/\bdormant\b/.test(lower)) return { status: "dormant" };
    if (/\bactive\b/.test(lower)) return { status: "active" };
  }

  if (tool === "get_tenant_contracts") {
    if (/\bexpir/.test(lower)) return { status: "expiring_soon" };
    if (/\bexpired\b/.test(lower)) return { status: "expired" };
    if (/\brenewed\b/.test(lower)) return { status: "renewed" };
    if (/\bactive\b/.test(lower)) return { status: "active" };
  }

  if (tool === "get_value_opportunities") {
    for (const status of ["Identified", "Validated", "Approved", "Executing", "Captured"] as const) {
      if (lower.includes(status.toLowerCase())) return { status };
    }
  }

  if (tool === "get_operational_signals") {
    for (const category of ["revenue", "customer", "operation", "capacity", "compliance"] as const) {
      if (lower.includes(category)) return { category };
    }
    if (/\bactive\b/.test(lower)) return { status: "active" };
  }

  return undefined;
}

export function planAuthorizedAiRetrieval(query: AiTrustQuery, ctx: TenantContext): AiRetrievalPlan {
  requirePermission(ctx, "ai:execute");

  const requestedTools = requestedToolsForQuery(query);
  const contextIds = normalizeContextIds(query.contextMemoryIds);
  const searchTerm = extractSearchTerm(query.prompt);
  const calls: AiToolCallPlan[] = [];
  const deniedTools: AiDeniedTool[] = [];

  for (const tool of requestedTools) {
    const requiredPermission = TOOL_PERMISSIONS[tool];
    if (!hasPermission(ctx, requiredPermission)) {
      deniedTools.push({ tool, requiredPermission, reason: "missing_permission" });
      continue;
    }

    calls.push({
      tool,
      limit: AI_TOOL_RECORD_LIMIT,
      ...(searchTerm ? { searchTerm } : {}),
      ...(tool === "get_organizational_memory" && contextIds.length > 0 ? { ids: contextIds } : {}),
      ...(filtersForTool(tool, query.prompt) ? { filters: filtersForTool(tool, query.prompt) } : {}),
    });
  }

  return {
    requestedTools,
    calls: calls.slice(0, AI_MAX_TOOL_CALLS),
    deniedTools,
    queryScope: query.prompt.trim().slice(0, 240),
    maxToolCalls: AI_MAX_TOOL_CALLS,
    maxRecordsPerTool: AI_TOOL_RECORD_LIMIT,
  };
}

async function evidenceRef(
  evidence: EvidenceService,
  entityType: EvidenceSubjectType,
  entityId: string,
  sourceReference: string,
  ctx: TenantContext
): Promise<AiProvenanceReference> {
  const state = await evidence.getStatus(entityType, entityId, ctx);
  return {
    entityType,
    entityId,
    sourceReference,
    verificationState: state.verificationState,
    certificationState: state.certificationState,
  };
}

function baseQuery<T>(call: AiToolCallPlan): QuerySpecification<T> {
  return { limit: Math.min(Math.max(1, call.limit), AI_TOOL_RECORD_LIMIT) };
}

export function createAuthorizedAiTools(database: DatabaseStore): Record<AiDataToolName, AiToolDefinition> {
  const evidence = new EvidenceService(database);

  return {
    get_tenant_customers: {
      name: "get_tenant_customers",
      description: "Bounded customer records relevant to the authenticated query scope",
      requiredPermission: "customer:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "customer:read");
        const where = call.filters?.status ? { status: call.filters.status as any } : undefined;
        const query: QuerySpecification<any> = {
          ...baseQuery<any>(call),
          ...(where ? { where } : {}),
          ...(call.searchTerm ? { search: { fields: ["name", "industry", "owner"], term: call.searchTerm } } : {}),
        };
        const countQuery = { ...(where ? { where } : {}), ...(query.search ? { search: query.search } : {}) };
        const [page, totalMatched] = await Promise.all([
          database.customersRepo.findMany(ctx, query),
          database.customersRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "Customer" as const,
          entityId: record.id,
          fields: {
            name: record.name,
            arr: record.arr,
            status: record.status,
            healthScore: record.healthScore,
            tier: record.tier,
            industry: record.industry || null,
          },
          provenance: await evidenceRef(evidence, "Customer", record.id, `apex://Customer/${record.id}`, ctx),
        })));
        return { tool: call.tool, requiredPermission: "customer:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },

    get_value_opportunities: {
      name: "get_value_opportunities",
      description: "Bounded value opportunities relevant to the authenticated query scope",
      requiredPermission: "value:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "value:read");
        const where = call.filters?.status ? { status: call.filters.status as any } : undefined;
        const query: QuerySpecification<any> = {
          ...baseQuery<any>(call),
          ...(where ? { where } : {}),
          ...(call.searchTerm ? { search: { fields: ["title", "category", "recommendedAction", "expectedOutcome"], term: call.searchTerm } } : {}),
        };
        const countQuery = { ...(where ? { where } : {}), ...(query.search ? { search: query.search } : {}) };
        const [page, totalMatched] = await Promise.all([
          database.opportunitiesRepo.findMany(ctx, query),
          database.opportunitiesRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "ValueOpportunity" as const,
          entityId: record.id,
          fields: {
            title: record.title,
            category: record.category,
            potentialValue: record.potentialValue,
            status: record.status,
            strategicImportance: record.strategicImportance,
          },
          provenance: await evidenceRef(evidence, "ValueOpportunity", record.id, `apex://ValueOpportunity/${record.id}`, ctx),
        })));
        return { tool: call.tool, requiredPermission: "value:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },

    get_organizational_memory: {
      name: "get_organizational_memory",
      description: "Bounded institutional-memory records with canonical evidence state",
      requiredPermission: "knowledge:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "knowledge:read");
        const ids = normalizeContextIds(call.ids);
        const where = ids.length > 0 ? { id: { in: ids } } : undefined;
        const query: QuerySpecification<any> = {
          ...baseQuery<any>({ ...call, limit: ids.length > 0 ? Math.min(ids.length, AI_TOOL_RECORD_LIMIT) : call.limit }),
          ...(where ? { where } : {}),
          ...(!where && call.searchTerm ? { search: { fields: ["title", "content", "source", "sourceReference"], term: call.searchTerm } } : {}),
        };
        const countQuery = { ...(where ? { where } : {}), ...(query.search ? { search: query.search } : {}) };
        const [page, totalMatched] = await Promise.all([
          database.memoryRepo.findMany(ctx, query),
          database.memoryRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "OrganizationalMemory" as const,
          entityId: record.id,
          fields: {
            type: record.type,
            title: record.title,
            content: record.content.slice(0, 800),
            source: record.source,
            sourceReference: record.sourceReference,
            confidence: record.confidence,
          },
          provenance: await evidenceRef(
            evidence,
            "OrganizationalMemory",
            record.id,
            record.sourceReference || `apex://OrganizationalMemory/${record.id}`,
            ctx
          ),
        })));
        return { tool: call.tool, requiredPermission: "knowledge:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },

    get_tenant_documents: {
      name: "get_tenant_documents",
      description: "Bounded indexed document metadata and safe extracted summaries",
      requiredPermission: "document:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "document:read");
        const query: QuerySpecification<any> = {
          ...baseQuery<any>(call),
          ...(call.searchTerm ? { search: { fields: ["name", "category", "aiSummary", "tags"], term: call.searchTerm } } : {}),
        };
        const countQuery = query.search ? { search: query.search } : {};
        const [page, totalMatched] = await Promise.all([
          database.documentsRepo.findMany(ctx, query),
          database.documentsRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "Document" as const,
          entityId: record.id,
          fields: {
            name: record.name,
            category: record.category,
            status: record.status,
            summary: record.aiSummary?.slice(0, 800) || null,
            extractedFieldCount: record.extractedFields.length,
            tags: record.tags.slice(0, 10),
          },
          provenance: await evidenceRef(evidence, "Document", record.id, `apex://Document/${record.id}`, ctx),
        })));
        return { tool: call.tool, requiredPermission: "document:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },

    get_tenant_contracts: {
      name: "get_tenant_contracts",
      description: "Bounded contract metadata relevant to an authorized financial query",
      requiredPermission: "financial:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "financial:read");
        const where = call.filters?.status ? { status: call.filters.status as any } : undefined;
        const query: QuerySpecification<any> = {
          ...baseQuery<any>(call),
          ...(where ? { where } : {}),
          ...(call.searchTerm ? { search: { fields: ["title", "status"], term: call.searchTerm } } : {}),
        };
        const countQuery = { ...(where ? { where } : {}), ...(query.search ? { search: query.search } : {}) };
        const [page, totalMatched] = await Promise.all([
          database.contractsRepo.findMany(ctx, query),
          database.contractsRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "Contract" as const,
          entityId: record.id,
          fields: {
            title: record.title,
            contractValue: record.contractValue,
            status: record.status,
            slaCompliance: record.slaCompliance,
            volatilityIndexationClause: record.volatilityIndexationClause,
            renewalDaysRemaining: record.renewalDaysRemaining,
          },
          provenance: await evidenceRef(evidence, "Contract", record.id, `apex://Contract/${record.id}`, ctx),
        })));
        return { tool: call.tool, requiredPermission: "financial:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },

    get_operational_signals: {
      name: "get_operational_signals",
      description: "Bounded operational signals relevant to an authorized workflow/operations query",
      requiredPermission: "workflow:read",
      handler: async (call, ctx) => {
        requirePermission(ctx, "workflow:read");
        const where: Record<string, any> = {};
        if (call.filters?.category) where.category = call.filters.category;
        if (call.filters?.status) where.status = call.filters.status;
        const hasWhere = Object.keys(where).length > 0;
        const query: QuerySpecification<any> = {
          ...baseQuery<any>(call),
          ...(hasWhere ? { where } : {}),
          ...(call.searchTerm ? { search: { fields: ["title", "description", "evidence", "category"], term: call.searchTerm } } : {}),
        };
        const countQuery = { ...(hasWhere ? { where } : {}), ...(query.search ? { search: query.search } : {}) };
        const [page, totalMatched] = await Promise.all([
          database.signalsRepo.findMany(ctx, query),
          database.signalsRepo.count(ctx, countQuery),
        ]);
        const records = await Promise.all(page.items.map(async (record) => ({
          entityType: "Signal" as const,
          entityId: record.id,
          fields: {
            category: record.category,
            severity: record.severity,
            title: record.title,
            description: record.description.slice(0, 600),
            estimatedFinancialImpact: record.estimatedFinancialImpact,
            status: record.status,
          },
          provenance: await evidenceRef(evidence, "Signal", record.id, `apex://Signal/${record.id}`, ctx),
        })));
        return { tool: call.tool, requiredPermission: "workflow:read", totalMatched, records, scopeComplete: totalMatched <= records.length };
      },
    },
  };
}

export async function executeAuthorizedAiRetrieval(
  database: DatabaseStore,
  plan: AiRetrievalPlan,
  ctx: TenantContext
): Promise<AiRetrievalExecution> {
  requirePermission(ctx, "ai:execute");
  const registry = createAuthorizedAiTools(database);
  const results: AiToolExecutionResult[] = [];

  for (const call of plan.calls.slice(0, AI_MAX_TOOL_CALLS)) {
    if (call.limit > AI_TOOL_RECORD_LIMIT) {
      throw new Error(`AI tool record limit exceeded for ${call.tool}`);
    }
    const definition = registry[call.tool];
    // Defense in depth: planner authorization is never trusted as sufficient.
    requirePermission(ctx, definition.requiredPermission);
    results.push(await definition.handler(call, ctx));
  }

  const recordsRetrieved = results.reduce((sum, result) => sum + result.records.length, 0);
  if (recordsRetrieved > AI_MAX_CONTEXT_RECORDS) {
    throw new Error("AI retrieval exceeded the Stage 8 bounded context limit");
  }

  return {
    results,
    requestedTools: plan.requestedTools,
    executedTools: results.map((result) => result.tool),
    deniedTools: plan.deniedTools,
    recordsRetrieved,
    queryScope: plan.queryScope,
    recordLimitPerTool: AI_TOOL_RECORD_LIMIT,
  };
}
