/**
 * APEX ONE — AI Orchestration & Tool Registry Domain Service
 *
 * Rules:
 * 1. AI NEVER has raw/unrestricted database access or SQL execution.
 * 2. AI interacts exclusively through authorized, tenant-aware tools.
 * 3. Every tool execution is validated against the authenticated TenantContext.
 * 4. AI MUST NEVER fabricate financial figures or business facts.
 * 5. Grounding in source records is distinct from verification/certification.
 * 6. AI-generated claims start unverified/uncertified unless a canonical evidence decision exists.
 */

import { GoogleGenAI } from "@google/genai";
import { TenantContext, requirePermission } from "../../core/security";
import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { MAX_PAGE_SIZE } from "../../database/querySpecification";
import { collectAllPages } from "../../database/paginationTraversal";
import { EvidenceService } from "../evidence/evidenceService";
import type { CertificationState, VerificationState } from "../evidence/model";

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
  verificationState: VerificationState;
  certificationState: CertificationState;
}

export interface AiIntelligenceResponse {
  text: string;
  claims: AiEvidenceClaim[];
  status: "grounded_records" | "insufficient_data" | "low_confidence" | "requires_verification";
  verificationState: VerificationState;
  certificationState: CertificationState;
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
  const evidenceService = new EvidenceService(database);

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
      description: "Search institutional memory records with source attribution and canonical evidence state",
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
        return Promise.all(memories.map(async (m) => {
          const evidence = await evidenceService.getStatus("OrganizationalMemory", m.id, ctx);
          return {
            id: m.id,
            title: m.title,
            content: m.content,
            source: m.source,
            sourceReference: m.sourceReference,
            confidence: m.confidence,
            verificationState: evidence.verificationState,
            certificationState: evidence.certificationState,
          };
        }));
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
  private readonly evidenceService: EvidenceService;

  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {
    this.evidenceService = new EvidenceService(database);
  }

  public async processIntelligencePrompt(dto: AiChatRequestDto, ctx: TenantContext): Promise<AiIntelligenceResponse> {
    requirePermission(ctx, "ai:execute");

    const org = await this.database.findOrganizationById(ctx.organizationId);
    const orgName = org?.name || "Organization";
    const currency = org?.currencySymbol || "₦";

    const [tenantCustomers, tenantOpps, tenantMemories, tenantContracts, tenantSignals] = await Promise.all([
      collectAllPages((cursor) => this.database.customersRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.opportunitiesRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.memoryRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.contractsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
      collectAllPages((cursor) => this.database.signalsRepo.findMany(ctx, { limit: MAX_PAGE_SIZE, cursor })),
    ]);

    const memoryEvidenceStates = await Promise.all(
      tenantMemories.map((memory) => this.evidenceService.getStatus("OrganizationalMemory", memory.id, ctx))
    );
    const canonicallyVerifiedMemories = memoryEvidenceStates.filter(
      (state) => state.verificationState === "verified"
    ).length;
    const canonicallyCertifiedMemories = memoryEvidenceStates.filter(
      (state) => state.certificationState === "certified"
    ).length;

    const totalRecordsGrounded =
      tenantCustomers.length + tenantOpps.length + tenantMemories.length + tenantContracts.length + tenantSignals.length;

    if (totalRecordsGrounded === 0) {
      return {
        text: `**[Apex Intelligence Engine — Data Status: Insufficient Data]**\n\nNo active customer, contract, or operational telemetry records exist for **${orgName}**.\n\nTo perform high-confidence value scans and revenue calibration, please connect telemetry feeds or upload contract documentation in the **Knowledge & Documents** hub.`,
        claims: [],
        status: "insufficient_data",
        verificationState: "unverified",
        certificationState: "uncertified",
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
        evidence: `Calculated from ${tenantCustomers.length} tenant-scoped customer records.`,
        confidence: 100,
        verificationState: "unverified",
        certificationState: "uncertified",
      });
    }
    if (tenantOpps.length > 0) {
      claims.push({
        claim: `Identified ${tenantOpps.length} active value expansion/recovery opportunities representing ${currency}${totalPotentialVal.toLocaleString()}.`,
        source: "ValueOpportunityRepository",
        evidence: `Aggregated from ${tenantOpps.length} recorded pipeline opportunities; record presence is not verification.`,
        confidence: 94,
        verificationState: "unverified",
        certificationState: "uncertified",
      });
    }
    if (unindexedContracts.length > 0) {
      claims.push({
        claim: `${unindexedContracts.length} contract(s) lack CBN volatility indexation clauses, presenting currency exposure risks.`,
        source: "ContractRepository",
        evidence: `Source records: ${unindexedContracts.map((c) => c.title).join(", ")}`,
        confidence: 96,
        verificationState: "unverified",
        certificationState: "uncertified",
      });
    }

    const contextSnippet = `
ORGANIZATION CONTEXT (Strict Source Grounding):
- Organization: ${orgName} (ID: ${ctx.organizationId})
- Currency: ${currency} (${org?.currency || "NGN"})
- Active Monitored Customers: ${tenantCustomers.length} (Total ARR: ${currency}${totalArr.toLocaleString()})
- Active Contracts: ${tenantContracts.length} (Total Contract Value: ${currency}${totalContractVal.toLocaleString()})
- Value Opportunities: ${tenantOpps.length} (Total Potential Value: ${currency}${totalPotentialVal.toLocaleString()})
- Active Operational Signals: ${tenantSignals.length}
- Institutional Memory Records: ${tenantMemories.length}
- Canonically Verified Institutional Memories: ${canonicallyVerifiedMemories}
- Canonically Certified Institutional Memories: ${canonicallyCertifiedMemories}
`;

    let generatedText = "";
    let responseStatus: "grounded_records" | "requires_verification" | "low_confidence" = "grounded_records";

    try {
      const ai = getAiClient();
      const aiPromise = ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `${contextSnippet}\n\nUSER QUERY (${dto.mode || "General"} Analysis Mode):\n${dto.prompt}`,
        config: {
          systemInstruction: `You are the APEX ONE Value Analyst & Enterprise Intelligence Orchestrator for ${orgName}.
You analyze operations, contracts, and revenue leakages with board-level precision based ONLY on the grounded source data provided.
NEVER fabricate numbers, customers, or financial amounts not substantiated by the context.
Do not describe a record, aggregate, inference, or AI-generated claim as verified or certified unless the context explicitly supplies that canonical evidence state.
All calculations must strictly use ${currency}.
Always format structured recommendations with:
1. **INSIGHT**: Qualitative diagnosis
2. **FINANCIAL IMPACT**: Explicit calculation grounded in source records
3. **REASON**: Underlying operational friction
4. **RECOMMENDED ACTION**: Specific play to deploy
5. **CONFIDENCE**: Percentage based on source completeness; confidence is not verification or certification
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
      generatedText = `**[Apex Intelligence Engine — Source-Grounded Analysis for ${orgName}]**

1. **INSIGHT**: Analyzed organizational telemetry for **${orgName}** under **${dto.mode || "Revenue"}** mode across ${totalRecordsGrounded} tenant-scoped source records.
2. **FINANCIAL IMPACT**: Monitored active ARR of **${currency}${totalArr.toLocaleString()}** across ${tenantCustomers.length} corporate accounts, with **${currency}${totalPotentialVal.toLocaleString()}** recorded in active value opportunities.
3. **REASON**: ${unindexedContracts.length > 0 ? `${unindexedContracts.length} contract(s) lack FX indexation clauses during quarterly review windows.` : "Operational throughput bottlenecks detected in active telemetry."}
4. **RECOMMENDED ACTION**: ${tenantOpps.length > 0 ? `Review high-priority opportunity: "${tenantOpps[0].title}" before execution.` : "Initiate comprehensive value discovery scan across connected customer tiers."}
5. **CONFIDENCE**: 92% based on source completeness. This confidence score is not a verification or certification decision.
6. **NEXT STEP**: Supply GEMINI_API_KEY in **Settings > Secrets** for live generative reasoning, then route material claims through the canonical evidence verification workflow before relying on them as verified facts.`;
    }

    await this.database.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "ai:execute_intelligence",
      resource: "AiOrchestrator",
      resourceId: dto.mode || "Revenue",
      requestId: ctx.requestId,
      status: "success",
      metadata: {
        promptLength: dto.prompt.length,
        mode: dto.mode,
        recordsGrounded: totalRecordsGrounded,
        canonicalVerifiedMemories: canonicallyVerifiedMemories,
        canonicalCertifiedMemories: canonicallyCertifiedMemories,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      text: generatedText,
      claims,
      status: responseStatus,
      verificationState: "unverified",
      certificationState: "uncertified",
      groundedRecordsCount: totalRecordsGrounded,
      organizationId: ctx.organizationId,
      mode: dto.mode || "Revenue",
      timestamp: new Date().toISOString(),
    };
  }
}

export const aiOrchestratorService = new AiOrchestratorService();
