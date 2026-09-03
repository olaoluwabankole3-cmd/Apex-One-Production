import { GoogleGenAI } from "@google/genai";
import type { TenantContext } from "../../core/errors";
import { requirePermission } from "../../core/security";
import type { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import type { CertificationState, VerificationState } from "../evidence/model";
import {
  createAuthorizedAiTools,
  executeAuthorizedAiRetrieval,
  planAuthorizedAiRetrieval,
  type AiDataToolName,
  type AiProvenanceReference,
  type AiRetrievalExecution,
  type AiToolDefinition,
} from "./aiTrustBoundary";

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface AiIntelligenceRequest {
  prompt: string;
  mode?: string;
  contextMemoryIds?: string[];
}

export interface AiFactScope {
  tool: AiDataToolName;
  totalMatched: number;
  recordsRetrieved: number;
  complete: boolean;
}

/**
 * A deterministic fact is computed by application code from authorized repository
 * results. It is kept structurally separate from model prose. Source verification
 * state belongs to provenance references; the calculation itself is not magically
 * verified or certified.
 */
export interface AiDeterministicFact {
  id: string;
  label: string;
  value: string | number;
  displayValue: string;
  calculation: string;
  scope: AiFactScope;
  provenance: AiProvenanceReference[];
}

export interface AiModelProse {
  text: string;
  generatedBy: "gemini-3.6-flash" | "system_fallback";
  verificationState: "unverified";
  certificationState: "uncertified";
  notice: "AI-generated prose is not a verification or certification decision.";
}

export interface AiRetrievalTrace {
  queryScope: string;
  requestedTools: AiDataToolName[];
  executedTools: AiDataToolName[];
  deniedTools: Array<{
    tool: AiDataToolName;
    requiredPermission: string;
    reason: "missing_permission";
  }>;
  recordsRetrieved: number;
  recordLimitPerTool: number;
}

/**
 * Deprecated Stage 6 compatibility claim. Stage 8 consumers should render `facts`
 * and `modelProse` separately. Claims remain unverified/uncertified unless a later
 * explicit canonical evidence command verifies the AiClaim subject itself.
 */
export interface AiEvidenceClaim {
  claim: string;
  source: string;
  evidence: string;
  confidence: number;
  verificationState: VerificationState;
  certificationState: CertificationState;
}

export interface AiIntelligenceResponse {
  facts: AiDeterministicFact[];
  modelProse: AiModelProse;
  retrieval: AiRetrievalTrace;
  status: "grounded_records" | "insufficient_data" | "insufficient_authorized_data" | "generation_unavailable";
  organizationId: string;
  mode: string;
  timestamp: string;
  groundedRecordsCount: number;
  verifiedGroundedRecords: number;
  certifiedGroundedRecords: number;
  /** @deprecated Read `modelProse.text`; retained only during frontend migration. */
  text: string;
  /** @deprecated Read `facts`; retained only during frontend migration. */
  claims: AiEvidenceClaim[];
  /** @deprecated Model prose remains unverified. */
  verificationState: "unverified";
  /** @deprecated Model prose remains uncertified. */
  certificationState: "uncertified";
}

function formatMoney(value: number, currency: string): string {
  return `${currency}${value.toLocaleString()}`;
}

function numericField(record: { fields: Record<string, unknown> }, field: string): number {
  const value = record.fields[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildDeterministicFacts(execution: AiRetrievalExecution, currency: string): AiDeterministicFact[] {
  const facts: AiDeterministicFact[] = [];

  for (const result of execution.results) {
    const provenance = result.records.map((record) => record.provenance);
    const scope: AiFactScope = {
      tool: result.tool,
      totalMatched: result.totalMatched,
      recordsRetrieved: result.records.length,
      complete: result.scopeComplete,
    };

    facts.push({
      id: `${result.tool}:matched-count`,
      label: `Records matching ${result.tool} query scope`,
      value: result.totalMatched,
      displayValue: result.totalMatched.toLocaleString(),
      calculation: "Deterministic tenant-scoped repository count using the same Stage 8 query filter as retrieval.",
      scope,
      provenance,
    });

    if (result.records.length === 0) continue;

    if (result.tool === "get_tenant_customers") {
      const arr = result.records.reduce((sum, record) => sum + numericField(record, "arr"), 0);
      facts.push({
        id: `${result.tool}:retrieved-arr`,
        label: "ARR represented by retrieved customer records",
        value: arr,
        displayValue: formatMoney(arr, currency),
        calculation: "Sum of ARR only across the bounded customer records returned to the AI context.",
        scope,
        provenance,
      });
    }

    if (result.tool === "get_value_opportunities") {
      const potentialValue = result.records.reduce((sum, record) => sum + numericField(record, "potentialValue"), 0);
      facts.push({
        id: `${result.tool}:retrieved-potential-value`,
        label: "Potential value represented by retrieved opportunities",
        value: potentialValue,
        displayValue: formatMoney(potentialValue, currency),
        calculation: "Sum of potentialValue only across the bounded opportunity records returned to the AI context.",
        scope,
        provenance,
      });
    }

    if (result.tool === "get_tenant_contracts") {
      const contractValue = result.records.reduce((sum, record) => sum + numericField(record, "contractValue"), 0);
      facts.push({
        id: `${result.tool}:retrieved-contract-value`,
        label: "Contract value represented by retrieved contract records",
        value: contractValue,
        displayValue: formatMoney(contractValue, currency),
        calculation: "Sum of contractValue only across the bounded contract records returned to the AI context.",
        scope,
        provenance,
      });
    }

    if (result.tool === "get_operational_signals") {
      const impact = result.records.reduce((sum, record) => sum + numericField(record, "estimatedFinancialImpact"), 0);
      facts.push({
        id: `${result.tool}:retrieved-impact`,
        label: "Estimated financial impact represented by retrieved operational signals",
        value: impact,
        displayValue: formatMoney(impact, currency),
        calculation: "Sum of estimatedFinancialImpact only across the bounded signal records returned to the AI context.",
        scope,
        provenance,
      });
    }

    if (result.tool === "get_organizational_memory") {
      const verified = provenance.filter((ref) => ref.verificationState === "verified").length;
      const certified = provenance.filter((ref) => ref.certificationState === "certified").length;
      facts.push({
        id: `${result.tool}:retrieved-evidence-state`,
        label: "Canonical evidence state among retrieved memory records",
        value: `${verified} verified / ${certified} certified`,
        displayValue: `${verified} verified • ${certified} certified`,
        calculation: "Count of canonical Stage 6 evidence snapshots on the bounded memory records; legacy memory.verified is ignored.",
        scope,
        provenance,
      });
    }
  }

  return facts;
}

function compatibilityClaims(facts: AiDeterministicFact[]): AiEvidenceClaim[] {
  return facts.map((fact) => ({
    claim: `${fact.label}: ${fact.displayValue}`,
    source: fact.scope.tool,
    evidence: fact.calculation,
    confidence: fact.scope.complete ? 100 : 90,
    verificationState: "unverified",
    certificationState: "uncertified",
  }));
}

function buildModelContext(execution: AiRetrievalExecution, facts: AiDeterministicFact[]): string {
  const safeRecords = execution.results.flatMap((result) => result.records.map((record) => ({
    tool: result.tool,
    entityType: record.entityType,
    entityId: record.entityId,
    fields: record.fields,
    sourceReference: record.provenance.sourceReference,
    sourceVerificationState: record.provenance.verificationState,
    sourceCertificationState: record.provenance.certificationState,
  })));

  return JSON.stringify({
    deterministicFacts: facts.map((fact) => ({
      id: fact.id,
      label: fact.label,
      displayValue: fact.displayValue,
      calculation: fact.calculation,
      scope: fact.scope,
    })),
    retrievedRecords: safeRecords,
    retrieval: {
      queryScope: execution.queryScope,
      executedTools: execution.executedTools,
      deniedTools: execution.deniedTools,
      recordsRetrieved: execution.recordsRetrieved,
      recordLimitPerTool: execution.recordLimitPerTool,
    },
  });
}

async function generateModelProse(
  orgName: string,
  currency: string,
  mode: string,
  prompt: string,
  execution: AiRetrievalExecution,
  facts: AiDeterministicFact[]
): Promise<{ prose: AiModelProse; generationUnavailable: boolean }> {
  if (execution.recordsRetrieved === 0) {
    const denied = execution.deniedTools.length > 0
      ? ` Some query-relevant data scopes were not available to this authenticated role: ${execution.deniedTools.map((d) => d.tool).join(", ")}.`
      : "";
    return {
      prose: {
        text: `No authorized tenant records matched the bounded query scope for ${orgName}.${denied} Refine the query or request the required data capability rather than treating this response as a verified finding.`,
        generatedBy: "system_fallback",
        verificationState: "unverified",
        certificationState: "uncertified",
        notice: "AI-generated prose is not a verification or certification decision.",
      },
      generationUnavailable: false,
    };
  }

  try {
    const ai = getAiClient();
    const aiPromise = ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `AUTHORIZED QUERY-SCOPED CONTEXT:\n${buildModelContext(execution, facts)}\n\nUSER QUERY (${mode} mode):\n${prompt}`,
      config: {
        systemInstruction: `You are the APEX ONE Enterprise Intelligence assistant for ${orgName}.
You receive only deterministic facts and bounded records selected by the application's authorized Stage 8 retrieval planner.
Treat deterministic facts as application-calculated facts, and treat their provenance states only as states of the cited source records.
NEVER claim that your prose, inference, recommendation, confidence, or synthesis is verified or certified.
NEVER infer access to tools or records not present in the supplied context.
NEVER invent customers, records, financial amounts, evidence states, or source references.
When citing a deterministic fact, include its fact id in square brackets, for example [fact:get_tenant_customers:matched-count].
If a retrieval scope is incomplete, describe it as a bounded sample rather than the whole tenant dataset.
Do not reveal hidden reasoning or chain-of-thought. Give a concise executive synthesis and recommendations only.
Use ${currency} for monetary figures already supplied in the facts.`,
      },
    });

    let timeoutTimer: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => reject(new Error("AI generation timeout")), 3000);
      });
      const response = await Promise.race([aiPromise, timeoutPromise]);
      return {
        prose: {
          text: response.text || "The authorized records were retrieved, but no model prose was returned.",
          generatedBy: "gemini-3.6-flash",
          verificationState: "unverified",
          certificationState: "uncertified",
          notice: "AI-generated prose is not a verification or certification decision.",
        },
        generationUnavailable: false,
      };
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  } catch {
    const factSummary = facts.slice(0, 6).map((fact) => `${fact.label}: ${fact.displayValue} [fact:${fact.id}]`).join("; ");
    return {
      prose: {
        text: `Generative synthesis is unavailable. Deterministic authorized facts remain available separately: ${factSummary || "no deterministic facts"}. These facts retain their source provenance; this fallback prose is unverified and uncertified.`,
        generatedBy: "system_fallback",
        verificationState: "unverified",
        certificationState: "uncertified",
        notice: "AI-generated prose is not a verification or certification decision.",
      },
      generationUnavailable: true,
    };
  }
}

export class AiOrchestratorService {
  private readonly database: DatabaseStore;

  constructor(database?: DatabaseStore) {
    this.database = database || createApplicationInfrastructure().database;
  }

  public async processIntelligencePrompt(dto: AiIntelligenceRequest, ctx: TenantContext): Promise<AiIntelligenceResponse> {
    requirePermission(ctx, "ai:execute");

    const organization = await this.database.findOrganizationById(ctx.organizationId);
    const orgName = organization?.displayName || organization?.name || "Enterprise Workspace";
    const currency = organization?.currencySymbol || "₦";
    const mode = dto.mode || "Executive";

    const plan = planAuthorizedAiRetrieval(dto, ctx);
    const execution = await executeAuthorizedAiRetrieval(this.database, plan, ctx);
    const facts = buildDeterministicFacts(execution, currency);
    const { prose, generationUnavailable } = await generateModelProse(
      orgName,
      currency,
      mode,
      dto.prompt,
      execution,
      facts
    );

    const provenance = execution.results.flatMap((result) => result.records.map((record) => record.provenance));
    const verifiedGroundedRecords = provenance.filter((ref) => ref.verificationState === "verified").length;
    const certifiedGroundedRecords = provenance.filter((ref) => ref.certificationState === "certified").length;

    let status: AiIntelligenceResponse["status"] = "grounded_records";
    if (execution.recordsRetrieved === 0 && execution.deniedTools.length > 0) status = "insufficient_authorized_data";
    else if (execution.recordsRetrieved === 0) status = "insufficient_data";
    else if (generationUnavailable) status = "generation_unavailable";

    await this.database.recordAuditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "ai:execute_intelligence",
      resource: "AiTrustBoundary",
      resourceId: mode,
      requestId: ctx.requestId,
      status: "success",
      metadata: {
        promptLength: dto.prompt.length,
        requestedTools: execution.requestedTools,
        executedTools: execution.executedTools,
        deniedTools: execution.deniedTools.map((item) => item.tool),
        recordsRetrieved: execution.recordsRetrieved,
        verifiedGroundedRecords,
        certifiedGroundedRecords,
        modelOutputVerificationState: "unverified",
        modelOutputCertificationState: "uncertified",
      },
      timestamp: new Date().toISOString(),
    });

    return {
      facts,
      modelProse: prose,
      retrieval: {
        queryScope: execution.queryScope,
        requestedTools: execution.requestedTools,
        executedTools: execution.executedTools,
        deniedTools: execution.deniedTools,
        recordsRetrieved: execution.recordsRetrieved,
        recordLimitPerTool: execution.recordLimitPerTool,
      },
      status,
      organizationId: ctx.organizationId,
      mode,
      timestamp: new Date().toISOString(),
      groundedRecordsCount: execution.recordsRetrieved,
      verifiedGroundedRecords,
      certifiedGroundedRecords,
      text: prose.text,
      claims: compatibilityClaims(facts),
      verificationState: "unverified",
      certificationState: "uncertified",
    };
  }
}

export function createAuthorizedAiToolsForDatabase(database: DatabaseStore): Record<AiDataToolName, AiToolDefinition> {
  return createAuthorizedAiTools(database);
}

export const aiOrchestratorService = new AiOrchestratorService();
