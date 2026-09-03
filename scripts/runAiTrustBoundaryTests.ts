process.env.TEST_ENV = "true";
delete process.env.GEMINI_API_KEY;

import { readFileSync } from "node:fs";
import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  CustomerRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  OrganizationalMemoryRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { EvidenceService } from "../lib/backend/domains/evidence/evidenceService";
import { AiOrchestratorService } from "../lib/backend/domains/ai/aiOrchestratorService";
import {
  AI_MAX_CONTEXT_RECORDS,
  AI_MAX_TOOL_CALLS,
  AI_TOOL_RECORD_LIMIT,
  executeAuthorizedAiRetrieval,
  planAuthorizedAiRetrieval,
  type AiRetrievalPlan,
} from "../lib/backend/domains/ai/aiTrustBoundary";

interface CheckResult { name: string; passed: boolean; error?: string }
const results: CheckResult[] = [];

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function now(): string { return new Date().toISOString(); }

function context(permissions: TenantContext["permissions"]): TenantContext {
  return {
    organizationId: "org-stage8",
    userId: "user-stage8",
    userEmail: "stage8@example.test",
    userRole: "CEO",
    permissions,
    requestId: `stage8-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  };
}

const fullCtx = context([
  "ai:execute",
  "org:read",
  "org:write",
  "org:admin",
  "customer:read",
  "financial:read",
  "value:read",
  "knowledge:read",
  "document:read",
  "workflow:read",
]);

const aiOnlyCtx = context(["ai:execute", "org:read"]);

function organization(): OrganizationRecord {
  const timestamp = now();
  return {
    id: "org-stage8",
    name: "Stage 8 Holdings",
    displayName: "Stage 8 Holdings",
    slug: "stage-8-holdings",
    industry: "technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function user(): UserRecord {
  return {
    id: "user-stage8",
    email: "stage8@example.test",
    name: "Stage 8 Tester",
    title: "Trust Boundary Tester",
    status: "active",
    createdAt: now(),
  };
}

function membership(): OrganizationMembershipRecord {
  return {
    id: "membership-stage8",
    organizationId: "org-stage8",
    userId: "user-stage8",
    role: "CEO",
    department: "Executive",
    joinedAt: now(),
  };
}

function customer(index: number): Omit<CustomerRecord, "organizationId"> {
  const timestamp = now();
  return {
    id: `customer-stage8-${String(index).padStart(2, "0")}`,
    name: `Stage 8 Customer ${index}`,
    subsidiary: "Stage 8",
    tier: "Enterprise",
    status: "active",
    healthScore: 80 + (index % 10),
    arr: 10_000 + index,
    owner: "Stage 8 Owner",
    contactName: `Contact ${index}`,
    contactRole: "CFO",
    contactEmail: `contact-${index}@example.test`,
    tags: ["stage8"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function memory(id: string, legacyVerified: boolean): Omit<OrganizationalMemoryRecord, "organizationId"> {
  return {
    id,
    type: "policy",
    title: `Stage 8 policy ${id}`,
    content: `Bounded evidence content for ${id}`,
    source: "Stage 8 test fixture",
    sourceReference: `fixture://${id}`,
    confidence: 99,
    effectiveAt: now(),
    verified: legacyVerified,
    createdAt: now(),
  };
}

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectRejects(fn: () => Promise<unknown>) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert(rejected, "Expected operation to reject");
}

async function main() {
  const store = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  await store.createOrganizationRecord(organization());
  await store.createUserRecord(user());
  await store.createMembershipRecord(membership());

  for (let index = 1; index <= 30; index += 1) {
    await store.customersRepo.create(customer(index), fullCtx);
  }
  await store.memoryRepo.create(memory("mem-stage8-verified", false), fullCtx);
  await store.memoryRepo.create(memory("mem-stage8-legacy-true", true), fullCtx);
  await store.memoryRepo.create(memory("mem-stage8-other", false), fullCtx);

  const evidence = new EvidenceService(store);
  const provenance = await evidence.recordProvenance({
    subjectType: "OrganizationalMemory",
    subjectId: "mem-stage8-verified",
    relation: "origin",
    sources: [{ kind: "record", sourceType: "Stage8Fixture", sourceId: "fixture-verified" }],
    producerType: "human",
    method: "Stage 8 canonical verification fixture",
  }, fullCtx);
  await evidence.recordVerification({
    subjectType: "OrganizationalMemory",
    subjectId: "mem-stage8-verified",
    state: "pending",
    provenanceIds: [provenance.id],
    criteria: ["source_present"],
  }, fullCtx);
  await evidence.recordVerification({
    subjectType: "OrganizationalMemory",
    subjectId: "mem-stage8-verified",
    state: "verified",
    provenanceIds: [provenance.id],
    criteria: ["source_present", "human_review"],
  }, fullCtx);

  await check("1. Query planner selects customer data for a customer-scoped query", () => {
    const plan = planAuthorizedAiRetrieval({ prompt: "Show customer health", mode: "Customers" }, fullCtx);
    assert(plan.requestedTools.includes("get_tenant_customers"), "Customer tool not selected");
    assert(!plan.requestedTools.includes("get_tenant_contracts"), "Unrelated contract tool was selected");
  });

  await check("2. Planner never exceeds the deterministic tool-call cap", () => {
    const plan = planAuthorizedAiRetrieval({
      prompt: "Review customers contracts opportunities memory documents operations",
      mode: "Executive",
    }, fullCtx);
    assert(plan.requestedTools.length <= AI_MAX_TOOL_CALLS, "Requested tool count exceeded cap");
    assert(plan.calls.length <= AI_MAX_TOOL_CALLS, "Authorized tool count exceeded cap");
  });

  await check("3. ai:execute alone does not grant customer data access", () => {
    const plan = planAuthorizedAiRetrieval({ prompt: "Show customer health", mode: "Customers" }, aiOnlyCtx);
    assert(plan.calls.length === 0, "Unauthorized customer tool was executable");
    assert(plan.deniedTools.some((item) => item.tool === "get_tenant_customers" && item.requiredPermission === "customer:read"), "Missing customer denial trace");
  });

  await check("4. Tool executor independently rejects a tampered unauthorized plan", async () => {
    const tampered: AiRetrievalPlan = {
      requestedTools: ["get_tenant_customers"],
      calls: [{ tool: "get_tenant_customers", limit: 1 }],
      deniedTools: [],
      queryScope: "tampered",
      maxToolCalls: AI_MAX_TOOL_CALLS,
      maxRecordsPerTool: AI_TOOL_RECORD_LIMIT,
    };
    await expectRejects(() => executeAuthorizedAiRetrieval(store, tampered, aiOnlyCtx));
  });

  await check("5. Customer retrieval is bounded while count remains query-scoped", async () => {
    const plan = planAuthorizedAiRetrieval({ prompt: "Show customers", mode: "Customers" }, fullCtx);
    const execution = await executeAuthorizedAiRetrieval(store, plan, fullCtx);
    const customers = execution.results.find((item) => item.tool === "get_tenant_customers");
    assert(customers, "Customer result missing");
    assert(customers.totalMatched === 30, `Expected 30 matching customers, got ${customers.totalMatched}`);
    assert(customers.records.length === AI_TOOL_RECORD_LIMIT, "Customer retrieval did not respect bounded limit");
    assert(customers.scopeComplete === false, "Bounded customer scope incorrectly reported complete");
    assert(execution.recordsRetrieved <= AI_MAX_CONTEXT_RECORDS, "Context record cap exceeded");
  });

  await check("6. contextMemoryIds retrieve only the exact tenant-scoped memory IDs", async () => {
    const plan = planAuthorizedAiRetrieval({
      prompt: "Use this institutional memory",
      mode: "Strategy",
      contextMemoryIds: ["mem-stage8-verified"],
    }, fullCtx);
    const execution = await executeAuthorizedAiRetrieval(store, plan, fullCtx);
    const memoryResult = execution.results.find((item) => item.tool === "get_organizational_memory");
    assert(memoryResult, "Memory result missing");
    assert(memoryResult.records.length === 1, `Expected one exact memory record, got ${memoryResult.records.length}`);
    assert(memoryResult.records[0].entityId === "mem-stage8-verified", "Unexpected memory record retrieved");
  });

  await check("7. Canonical verification state survives retrieval provenance", async () => {
    const plan = planAuthorizedAiRetrieval({
      prompt: "Use this institutional memory",
      mode: "Strategy",
      contextMemoryIds: ["mem-stage8-verified"],
    }, fullCtx);
    const execution = await executeAuthorizedAiRetrieval(store, plan, fullCtx);
    const source = execution.results.flatMap((item) => item.records).find((item) => item.entityId === "mem-stage8-verified");
    assert(source?.provenance.verificationState === "verified", "Canonical verified state was not preserved");
    assert(source.provenance.sourceReference === "fixture://mem-stage8-verified", "Source reference was not preserved");
  });

  await check("8. Legacy memory.verified=true cannot auto-verify AI provenance", async () => {
    const plan = planAuthorizedAiRetrieval({
      prompt: "Use this institutional memory",
      mode: "Strategy",
      contextMemoryIds: ["mem-stage8-legacy-true"],
    }, fullCtx);
    const execution = await executeAuthorizedAiRetrieval(store, plan, fullCtx);
    const source = execution.results.flatMap((item) => item.records).find((item) => item.entityId === "mem-stage8-legacy-true");
    assert(source?.provenance.verificationState === "unverified", "Legacy boolean incorrectly became canonical verification");
  });

  await check("9. Model prose is structurally separate and always unverified/uncertified", async () => {
    const service = new AiOrchestratorService(store);
    const response = await service.processIntelligencePrompt({
      prompt: "Use this institutional memory",
      mode: "Strategy",
      contextMemoryIds: ["mem-stage8-verified"],
    }, fullCtx);
    assert(Array.isArray(response.facts), "Deterministic facts missing");
    assert(response.modelProse.verificationState === "unverified", "Model prose was auto-verified");
    assert(response.modelProse.certificationState === "uncertified", "Model prose was auto-certified");
    assert(response.verificationState === "unverified" && response.certificationState === "uncertified", "Compatibility state became authoritative");
  });

  await check("10. Deterministic facts preserve canonical source provenance", async () => {
    const service = new AiOrchestratorService(store);
    const response = await service.processIntelligencePrompt({
      prompt: "Use this institutional memory",
      mode: "Strategy",
      contextMemoryIds: ["mem-stage8-verified"],
    }, fullCtx);
    const source = response.facts.flatMap((fact) => fact.provenance).find((item) => item.entityId === "mem-stage8-verified");
    assert(source?.verificationState === "verified", "Fact source lost canonical verification state");
  });

  await check("11. Unauthorized query scopes are withheld from the model context", async () => {
    const service = new AiOrchestratorService(store);
    const response = await service.processIntelligencePrompt({ prompt: "Show customer health", mode: "Customers" }, aiOnlyCtx);
    assert(response.retrieval.executedTools.length === 0, "Unauthorized tool executed");
    assert(response.retrieval.deniedTools.some((item) => item.tool === "get_tenant_customers"), "Denied scope not exposed");
    assert(response.groundedRecordsCount === 0, "Unauthorized records reached model context");
    assert(response.status === "insufficient_authorized_data", "Authorization-limited status missing");
  });

  await check("12. AI trust-boundary source contains no collection traversal helper", () => {
    const source = readFileSync("lib/backend/domains/ai/aiTrustBoundary.ts", "utf8");
    assert(!source.includes("collectAllPages"), "AI trust boundary must not traverse complete collections");
    assert(source.includes("AI_TOOL_RECORD_LIMIT = 25"), "Bounded record limit missing");
    assert(source.includes("requirePermission(ctx, definition.requiredPermission)"), "Executor permission re-check missing");
  });

  await check("13. Model invocation cannot select arbitrary application tools", () => {
    const source = readFileSync("lib/backend/domains/ai/aiOrchestratorService.ts", "utf8");
    assert(source.includes("planAuthorizedAiRetrieval"), "Deterministic planner not used");
    assert(!/tools\s*:/.test(source), "Model invocation exposes callable tools");
    assert(!source.includes("collectAllPages"), "Orchestrator still performs full-collection traversal");
  });

  await check("14. Legacy Gemini route delegates to the canonical orchestrator", () => {
    const source = readFileSync("app/api/gemini/route.ts", "utf8");
    assert(source.includes("aiOrchestratorService.processIntelligencePrompt"), "Legacy route does not delegate to orchestrator");
    assert(!source.includes("GoogleGenAI"), "Legacy route still creates a direct model client");
    assert(!source.includes("createDatabaseStoreFromEnvironment"), "Legacy route still reads repositories directly");
    assert(!source.includes("customersRepo") && !source.includes("opportunitiesRepo"), "Legacy route retains direct data access");
  });

  await check("15. Canonical frontend client requires facts, modelProse, and retrieval", () => {
    const source = readFileSync("lib/data/repositories/aiRepository.ts", "utf8");
    assert(source.includes("askTrusted"), "Trusted AI repository method missing");
    assert(source.includes("result.modelProse"), "Frontend client does not require model prose boundary");
    assert(source.includes("result.facts") && source.includes("result.retrieval"), "Frontend client does not require facts/retrieval provenance");
  });

  await check("16. Live AI workspace renders source provenance separately from model prose", () => {
    const page = readFileSync("app/ai-workspace/page.tsx", "utf8");
    const workspace = readFileSync("components/ai-workspace/TrustedAiWorkspace.tsx", "utf8");
    assert(page.includes("TrustedAiWorkspace"), "Canonical AI page is not using the trusted workspace");
    assert(workspace.includes("Deterministic facts"), "Fact boundary not visible in frontend");
    assert(workspace.includes("AI-generated synthesis"), "Model prose boundary not visible in frontend");
    assert(workspace.includes("source.verificationState") && workspace.includes("source.certificationState"), "Source evidence state not preserved to UI");
    assert(workspace.includes("source.sourceReference"), "Source reference not preserved to UI");
    assert(workspace.includes("Retrieval & provenance trace"), "Retrieval trace missing from UI");
    assert(!workspace.includes("REASONING TRACE") && !workspace.includes("chain-of-thought"), "Frontend exposes a reasoning-trace concept");
  });

  const failed = results.filter((result) => !result.passed);
  console.log(`\nStage 8 AI trust boundary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

void main();
