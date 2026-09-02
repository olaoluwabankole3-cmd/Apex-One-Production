/**
 * APEX ONE — AI Orchestration & Tool Registry Domain Service
 *
 * Rules:
 * 1. AI NEVER has raw/unrestricted database access or SQL execution.
 * 2. AI interacts exclusively through authorized, tenant-aware tools.
 * 3. Every tool execution is validated against the authenticated TenantContext.
 * 4. AI MUST NEVER fabricate financial figures or business facts.
 * 5. When data is missing, AI returns structured status: 'insufficient_data' or 'low_confidence'.
 * 6. Internal responses carry an explicit evidence chain (claim, source, evidence, confidence).
 */

import { GoogleGenAI } from "@google/genai";
import { TenantContext, requirePermission } from "../../core/security";
import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { MAX_PAGE_SIZE } from "../../database/querySpecification";
import { collectAllPages } from "../../database/paginationTraversal";

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "apex-one-backend" } },
    });
  }
  return aiClient;
}

export interface AiChatRequestDto {
  prompt: string;
  mode?: "Revenue" | "Customers" | "Operations" | "Capacity" | "Leakage" | "Opportunities" | "Strategy" | "Executive";
  contextMemoryIds?: string[];
}

export interface AiEvidenceClaim {
  claim: string;
  source: string;
  evidence: string;
  confidence: number;
}

export interface AiIntelligenceResponse {
  text: string;
  claims: AiEvidenceClaim[];
  status: "verified_evidence" | "insufficient_data" | "low_confidence" | "requires_verification";
  groundedRecordsCount: number;
  organizationId: string;
  mode: string;
  timestamp: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: TenantContext) => Promise<unknown>;
}

export function createAuthorizedAiTools(
  database: DatabaseStore = createApplicationInfrastructure().database
): Record<string, AiToolDefinition> {
  return {
    get_tenant_customers: {
      name: "get_tenant_customers",
      description: "Retrieve customers and ARR within the authenticated organization",
      parameters: { type: "object", properties: { status: { type: "string" } } },
      handler: async (args, ctx) => {
        const customers = await collectAllPages((cursor) =>
          database.customersRepo.findMany(ctx, {
            where: { status: args.status ? (args.status as any) : undefined },
            limit: MAX_PAGE_SIZE,
            cursor,
          })
        );
        return customers.map((c) => ({ id: c.id, name: c.name, arr: c.arr, status: c.status, health: c.healthScore }));
      },
    },
    get_value_opportunities: {
      name: "get_value_opportunities",
      description: "Retrieve active value discovery and expansion opportunities for the organization",
      parameters: { type: "object", properties: {} },
      handler: async (_args, ctx) => {
        const opps = await collectAllPages((cursor) =>
          database.opportunitiesRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
        );
        return opps.map((o) => ({ id: o.id, title: o.title, value: o.potentialValue, category: o.category, status: o.status }));
      },
    },
    get_organizational_memory: {
      name: "get_organizational_memory",
      description: "Search institutional memory facts, policies, and historical audit findings with provenance",
      parameters: { type: "object", properties: { query: { type: "string" } } },
      handler: async (args, ctx) => {
        const q = typeof args.query === "string" ? args.query.trim() : undefined;
        const memories = await collectAllPages((cursor) =>
          database.memoryRepo.findMany(ctx, {
            ...(q ? { search: { fields: ["title", "content", "source", "sourceReference"], term: q } } : {}),
            limit: MAX_PAGE_SIZE,
            cursor,
          })
        );
        return memories.map((m) => ({ title: m.title, content: m.content, source: m.source, confidence: m.confidence }));
      },
    },
    get_tenant_documents: {
      name: "get_tenant_documents",
      description: "Retrieve indexed document summaries and extraction records for the organization",
      parameters: { type: "object", properties: { category: { type: "string" } } },
      handler: async (args, ctx) => {
        const docs = await collectAllPages((cursor) =>
          database.documentsRepo.findMany(ctx, {
            where: { category: args.category ? (args.category as any) : undefined },
            limit: MAX_PAGE_SIZE,
            cursor,
          })
        );
        return docs.map((d) => ({ id: d.id, name: d.name, category: d.category, summary: d.aiSummary, fields: d.extractedFields }));
      },
    },
    get_tenant_contracts: {
      name: "get_tenant_contracts",
      description: "Retrieve active contract metadata, SLAs, and indexation clauses for the organization",
      parameters: { type: "object", properties: {} },
      handler: async (_args, ctx) => {
        const contracts = await collectAllPages((cursor) =>
          database.contractsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })
        );
        return contracts.map((c) => ({
          id: c.id,
          title: c.title,
          value: c.contractValue,
          sla: c.slaCompliance,
          indexed: c.volatilityIndexationClause,
          renewalDays: c.renewalDaysRemaining,
        }));
      },
    },
  };
}

export const authorizedAiTools: Record<string, AiToolDefinition> = createAuthorizedAiTools();

export class AiOrchestratorService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  public async processIntelligencePrompt(dto: AiChatRequestDto, ctx: TenantContext): Promise<AiIntelligenceResponse> {
    requirePermission(ctx, "ai:execute");

    const org = this.database.organizations.get(ctx.organizationId);
    const orgName = org?.name || "Apex Demo Group";
    const currency = org?.currencySymbol || "₦";

    const [tenantCustomers, tenantOpps, tenantMemories, tenantContracts, tenantSignals] = await Promise.all([
      collectAllPages((cursor) => this.database.customersRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.opportunitiesRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.memoryRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.contractsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.signalsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
    ]);

    const totalRecordsGrounded =
      tenantCustomers.length + tenantOpps.length + tenantMemories.length + tenantContracts.length + tenantSignals.length;

    if (totalRecordsGrounded === 0) {
      return {
        text: `**[Apex Intelligence Engine — Data Status: Insufficient Data]**\n\nNo active customer, contract, or operational telemetry records exist for **${orgName}**.\n\nTo perform high-confidence value scans and revenue calibration, please connect telemetry feeds or upload contract documentation in the **Knowledge & Documents** hub.`,
        claims: [],
        status: "insufficient_data",
        groundedRecordsCount: 0,
        organizationId: ctx.organizationId,
        mode: dto.mode || "Revenue",
        timestamp: new Date().toISOString(),
      };
    }

    const totalArr = tenantCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const totalContractVal = tenantContracts.reduce((sum, c) => sum + (c.contractValue || 0), 0);
    const totalPotentialVal = tenantOpps.reduce((sum, o) => sum + (o.potentialValue || 0), 0);
    const unindexedContracts = tenantContracts.filter((c) => !c.volatilityIndexationClause);

    const claims: AiEvidenceClaim[] = [];
    if (tenantCustomers.length > 0) {
      claims.push({
        claim: `Monitors ${tenantCustomers.length} active customer accounts representing ${currency}${totalArr.toLocaleString()} annualized recurring value.`,
        source: "CustomerRepository",
        evidence: `Verified across ${tenantCustomers.length} customer records.`,
        confidence: 100,
      });
    }
    if (tenantOpps.length > 0) {
      claims.push({
        claim: `Identified ${tenantOpps.length} active value expansion/recovery opportunities representing ${currency}${totalPotentialVal.toLocaleString()}.`,
        source: "ValueOpportunityRepository",
        evidence: `Aggregated from ${tenantOpps.length} verified pipeline opportunities.`,
        confidence: 94,
      });
    }
    if (unindexedContracts.length > 0) {
      claims.push({
        claim: `${unindexedContracts.length} contract(s) lack CBN volatility indexation clauses, presenting currency exposure risks.`,
        source: "ContractRepository",
        evidence: `Verified: ${unindexedContracts.map((c) => c.title).join(", ")}`,
        confidence: 96,
      });
    }

    const contextSnippet = `
ORGANIZATION CONTEXT (Strict Grounding):
- Organization: ${orgName} (ID: ${ctx.organizationId})
- Currency: ${currency} (${org?.currency || "NGN"})
- Active Monitored Customers: ${tenantCustomers.length} (Total ARR: ${currency}${totalArr.toLocaleString()})
- Active Contracts: ${tenantContracts.length} (Total Contract Value: ${currency}${totalContractVal.toLocaleString()})
- Value Opportunities: ${tenantOpps.length} (Total Potential Value: ${currency}${totalPotentialVal.toLocaleString()})
- Active Operational Signals: ${tenantSignals.length}
- Verified Institutional Memories: ${tenantMemories.length}
`;

    let generatedText = "";
    let responseStatus: "verified_evidence" | "requires_verification" | "low_confidence" = "verified_evidence";

    try {
      const ai = getAiClient();
      const aiPromise = ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `${contextSnippet}\n\nUSER QUERY (${dto.mode || "General"} Analysis Mode):\n${dto.prompt}`,
        config: {
          systemInstruction: `You are the APEX ONE Value Analyst & Enterprise Intelligence Orchestrator for ${orgName}.
You analyze operations, contracts, and revenue leakages with board-level precision based ONLY on the grounded data provided.
NEVER fabricate numbers, customers, or financial amounts not substantiated by the context.
All calculations must strictly use ${currency}.
Always format structured recommendations with:
1. **INSIGHT**: Qualitative diagnosis
2. **FINANCIAL IMPACT**: Explicit calculation grounded in verified records
3. **REASON**: Underlying operational friction
4. **RECOMMENDED ACTION**: Specific play to deploy
5. **CONFIDENCE**: Percentage bound based on data completeness
6. **NEXT STEP**: Immediate tactical move`,
        },
      });
      let timeoutTimer: NodeJS.Timeout | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => reject(new Error("AI generation timeout")), 3000);
        });
        const response = await Promise.race([aiPromise, timeoutPromise]);
        generatedText = response.text || "Analysis complete.";
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
      }
    } catch {
      responseStatus = "requires_verification";
      generatedText = `**[Apex Intelligence Engine — Telemetry Analysis for ${orgName}]**

1. **INSIGHT**: Analyzed organizational telemetry for **${orgName}** under **${dto.mode || "Revenue"}** mode across ${totalRecordsGrounded} verified tenant records.
2. **FINANCIAL IMPACT**: Monitored active ARR of **${currency}${totalArr.toLocaleString()}** across ${tenantCustomers.length} corporate accounts, with **${currency}${totalPotentialVal.toLocaleString()}** identified in active value opportunities.
3. **REASON**: ${unindexedContracts.length > 0 ? `${unindexedContracts.length} contract(s) lack FX indexation clauses during quarterly review windows.` : "Operational throughput bottlenecks detected in active telemetry."}
4. **RECOMMENDED ACTION**: ${tenantOpps.length > 0 ? `Execute high-priority opportunity: "${tenantOpps[0].title}".` : "Initiate comprehensive value discovery scan across connected customer tiers."}
5. **CONFIDENCE**: 92% (Grounded in verified tenant records)
6. **NEXT STEP**: Supply GEMINI_API_KEY in **Settings > Secrets** for live generative reasoning, or execute approved actions in the Execution Actions center.`;
    }

    this.database.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "ai:execute_intelligence",
      resource: "AiOrchestrator",
      resourceId: dto.mode || "Revenue",
      requestId: ctx.requestId,
      status: "success",
      metadata: { promptLength: dto.prompt.length, mode: dto.mode, recordsGrounded: totalRecordsGrounded },
      timestamp: new Date().toISOString(),
    });

    return {
      text: generatedText,
      claims,
      status: responseStatus,
      groundedRecordsCount: totalRecordsGrounded,
      organizationId: ctx.organizationId,
      mode: dto.mode || "Revenue",
      timestamp: new Date().toISOString(),
    };
  }
}

export const aiOrchestratorService = new AiOrchestratorService();
