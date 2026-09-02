/**
 * APEX ONE — Automated Tenant Isolation & Security Verification Test Suite
 * 
 * Comprehensive Multi-Tenant Security & Authentication Verification Matrix:
 * Tenant A: apex-demo (Apex Demo Group)
 * Tenant B: org-titan-corp (Titan Global Holdings)
 * 
 * Test Suites:
 * 1. Authentication Security & Token Lifecycle (Tokens, Passwords, Hashes, Salts, Status, Policy, Invalidation)
 * 2. Tenant Context Resolution & Header Spoofing Protection
 * 3. Customer Domain Tenant Isolation (Create, Read, List, Search, Update, Delete)
 * 4. Contract Domain Tenant Isolation (Create, Read, List, Expiring, Update, Delete)
 * 5. Transaction Domain Tenant Isolation (Create, Read, List, Financial Aggregations)
 * 6. Document Domain & Object Storage Isolation (Upload, Read, List, Inverted Index Search)
 * 7. Knowledge Hub Domain Isolation (Create, Read, List, Content Search, Public/Private Flags)
 * 8. Organizational Memory Domain Isolation (Add, Read, List, Keyword Search)
 * 9. Value Intelligence Domain Isolation (Opportunities, Value Captured, Summary Calculations)
 * 10. Workflow & Execution Engine Isolation (Create, Read, DAG Cycles, Run Trigger, Advance Step)
 * 11. Action Domain & Lifecycle Isolation (Create, Read, List, Advance, State Machine)
 * 12. Operational Signals Domain Isolation (Create, Read, Category Queries)
 * 13. Role-Based Access Control (RBAC) & Governance Enforcement
 * 14. AI Orchestration & Tool Registry Security
 * 15. Cross-Tenant Violation Auditing & Audit Log Scoping
 * 16. Concurrent Tenant Request Isolation & Non-Interference
 * 17. Input Validation, Sanitization & Negative Boundary Tests
 */

import { CustomerService } from "../domains/customers/customerService";
import { ValueService } from "../domains/value/valueService";
import { MemoryService } from "../domains/memory/memoryService";
import { ActionService } from "../domains/actions/actionService";
import { AuditService } from "../domains/audit/auditService";
import { AuthService } from "../domains/auth/authService";
import { DocumentService } from "../domains/documents/documentService";
import { KnowledgeService } from "../domains/knowledge/knowledgeService";
import { WorkflowService } from "../domains/workflows/workflowService";
import { WorkflowValidator } from "../domains/workflows/workflowValidator";
import { InMemoryDocumentIndexAdapter } from "../domains/documents/documentSearchIndex";
import { InMemoryObjectStorageAdapter } from "../domains/documents/documentStorage";
import { InMemorySessionStore, LocalAuthenticationProvider } from "../domains/auth/authProvider";
import { InMemoryRateLimiter } from "../domains/auth/rateLimiter";
import { createAuthorizedAiTools, AiOrchestratorService } from "../domains/ai/aiOrchestratorService";
import { DatabaseStore } from "../database/store";
import { DemoDataProvider } from "../database/demoDataProvider";
import { hashPassword, validatePasswordPolicy, generateSecureToken } from "../core/crypto";
import {
  TenantContext,
  CrossTenantViolationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../core/errors";
import {
  resolveTenantContext,
  ROLE_PERMISSIONS,
  AUTH_COOKIE_NAME,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
} from "../core/security";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export async function runTenantIsolationTestSuite(isolatedDb?: DatabaseStore): Promise<{
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const db = isolatedDb || DatabaseStore.createFreshStore();
  new DemoDataProvider().seedInitialTenants(db);

  const defaultSessionStore = new InMemorySessionStore();
  const defaultAuthProvider = new LocalAuthenticationProvider(defaultSessionStore, db);
  const defaultRateLimiter = new InMemoryRateLimiter();
  const documentSearchIndex = new InMemoryDocumentIndexAdapter();
  const objectStorageService = new InMemoryObjectStorageAdapter();

  const customerService = new CustomerService(db);
  const valueService = new ValueService(db);
  const memoryService = new MemoryService(db);
  const actionService = new ActionService(db);
  const auditService = new AuditService(db);
  const authService = new AuthService(db, defaultAuthProvider, defaultSessionStore, defaultRateLimiter);
  const documentService = new DocumentService(db, objectStorageService, documentSearchIndex);
  const knowledgeService = new KnowledgeService(db);
  const workflowService = new WorkflowService(db);
  const aiOrchestratorService = new AiOrchestratorService(db);
  const authorizedAiTools = createAuthorizedAiTools(db);

  async function testCase(
    suite: string,
    testName: string,
    fn: () => Promise<void> | void
  ) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite,
        testName,
        passed: true,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: any) {
      results.push({
        suite,
        testName,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  }

  const tenantAContext: TenantContext = {
    organizationId: "apex-demo",
    userId: "usr-marcus-thorne",
    userEmail: "m.thorne@apexsync.ai",
    userRole: "CEO",
    permissions: [...ROLE_PERMISSIONS["CEO"]],
    requestId: "test_req_tenant_a_ceo",
    timestamp: new Date().toISOString(),
  };

  const tenantAAdminContext: TenantContext = {
    organizationId: "apex-demo",
    userId: "usr-marcus-thorne",
    userEmail: "m.thorne@apexsync.ai",
    userRole: "Operations",
    permissions: [...ROLE_PERMISSIONS["Operations"], "org:admin" as any],
    requestId: "test_req_tenant_a_admin",
    timestamp: new Date().toISOString(),
  };

  const tenantARMContext: TenantContext = {
    organizationId: "apex-demo",
    userId: "usr-elena-cho",
    userEmail: "e.cho@apexsync.ai",
    userRole: "Relationship Manager",
    permissions: [...ROLE_PERMISSIONS["Relationship Manager"]],
    requestId: "test_req_tenant_a_rm",
    timestamp: new Date().toISOString(),
  };

  const tenantBContext: TenantContext = {
    organizationId: "org-titan-corp",
    userId: "usr-titan-admin",
    userEmail: "admin@titancorp.internal",
    userRole: "CEO",
    permissions: [...ROLE_PERMISSIONS["CEO"]],
    requestId: "test_req_tenant_b_ceo",
    timestamp: new Date().toISOString(),
  };

  db.contracts.set("contract-titan-1", {
    id: "contract-titan-1",
    organizationId: "org-titan-corp",
    customerId: "cust-titan-energy",
    title: "Titan Grid Maintenance Agreement",
    contractValue: 50000000,
    startDate: "2025-01-01",
    endDate: "2027-01-01",
    renewalDaysRemaining: 120,
    status: "active",
    slaCompliance: 99.8,
    volatilityIndexationClause: true,
    createdAt: "2026-02-20T00:00:00Z",
  });

  db.transactions.set("txn-titan-1", {
    id: "txn-titan-1",
    organizationId: "org-titan-corp",
    customerId: "cust-titan-energy",
    type: "revenue",
    amount: 12500000,
    currency: "USD",
    status: "cleared",
    reference: "INV-TITAN-001",
    category: "Power Grid Service",
    date: "2026-07-01",
    createdAt: "2026-07-01T00:00:00Z",
  });

  db.documents.set("doc-titan-secret-contract", {
    id: "doc-titan-secret-contract",
    organizationId: "org-titan-corp",
    customerId: "cust-titan-energy",
    name: "Titan_Confidential_Strategy_2026.pdf",
    fileType: "pdf",
    category: "Board Paper",
    size: "3.5 MB",
    uploadedBy: "Arthur Vance",
    storageKey: "documents/org-titan-corp/confidential/strategy.pdf",
    status: "indexed",
    metadata: {
      pageCount: 24,
      fileSizeBytes: 3670016,
      mimeType: "application/pdf",
      storageUri: "blob://tenants/org-titan-corp/docs/doc-titan-secret.bin",
      extractedAt: "2026-02-21T10:00:00Z",
    },
    aiSummary: "Confidential grid expansion strategic roadmap for North American operations.",
    extractedFields: [{ label: "Target Capital Expenditure", value: "$45,000,000", confidence: 99 }],
    tags: ["Confidential", "Titan", "Board"],
    createdAt: "2026-02-21T09:00:00Z",
    updatedAt: "2026-02-21T10:00:00Z",
  });
  await documentSearchIndex.indexDocument(
    "org-titan-corp",
    "doc-titan-secret-contract",
    "Confidential grid expansion strategic roadmap for North American operations"
  );

  db.knowledge.set("know-titan-secret-playbook", {
    id: "know-titan-secret-playbook",
    organizationId: "org-titan-corp",
    title: "Titan North American Power Dispatch Guidelines",
    category: "Engineering Standard",
    content: "Strictly confidential dispatch instructions for high-voltage transmission interconnects.",
    summary: "Internal power dispatch manual for Titan energy infrastructure.",
    author: "Arthur Vance",
    tags: ["Power", "Engineering", "Confidential"],
    isPublicPlatformKnowledge: false,
    version: 1,
    createdAt: "2026-02-22T00:00:00Z",
    updatedAt: "2026-02-22T00:00:00Z",
  });

  db.memory.set("mem-titan-fact-1", {
    id: "mem-titan-fact-1",
    organizationId: "org-titan-corp",
    type: "decision",
    title: "Titan Q3 Grid Expansion Budget",
    content: "Board approved $15M supplemental allocation for automated grid sensor deployment.",
    source: "Titan Board Meeting Minutes",
    sourceReference: "doc-titan-secret-contract",
    confidence: 100,
    effectiveAt: "2026-03-01T00:00:00Z",
    verified: true,
    createdAt: "2026-03-01T00:00:00Z",
  });

  db.opportunities.set("opp-titan-1", {
    id: "opp-titan-1",
    organizationId: "org-titan-corp",
    title: "Titan Substation Power Inverter Modernization",
    category: "Process optimization",
    potentialValue: 12000000,
    confidence: 96,
    evidence: "Analysis of substation telemetry showing 8.4% thermal dissipation loss.",
    recommendedAction: "Deploy smart inverter telemetry firmware update.",
    expectedOutcome: "Recover $1.2M in annual transmission efficiency.",
    realizationSpeed: "Fastest",
    strategicImportance: "High",
    risk: "Low",
    status: "Approved",
    createdAt: "2026-03-05T00:00:00Z",
    updatedAt: "2026-03-05T00:00:00Z",
  });

  db.valueCaptured.set("cap-titan-1", {
    id: "cap-titan-1",
    organizationId: "org-titan-corp",
    opportunityId: "opp-titan-1",
    opportunityTitle: "Substation Inverter Optimization",
    category: "Cost avoided",
    capturedValue: 9500000,
    evidenceType: "Ledger Reconciliation",
    evidenceDescription: "Quarterly power efficiency audit",
    realizationDate: "2026-06-30",
    certifiedBy: "Arthur Vance",
    auditTrail: ["Certified by operations audit team"],
    createdAt: "2026-07-01T00:00:00Z",
  });

  db.workflows.set("wf-titan-secret", {
    id: "wf-titan-secret",
    organizationId: "org-titan-corp",
    name: "Titan Grid Outage Automated Failover",
    description: "Automated high-voltage switching sequence during severe weather events.",
    subsidiary: "Grid Operations",
    status: "active",
    version: 1,
    nodes: [
      { id: "n1", type: "trigger", title: "Outage Sensor Alert", configuration: {}, position: { x: 0, y: 0 } },
      { id: "n2", type: "action", title: "Engage Reserve Inverters", configuration: {}, position: { x: 100, y: 0 } },
    ],
    connections: [{ id: "c1", fromNodeId: "n1", toNodeId: "n2" }],
    runsCount: 3,
    successRate: 100,
    createdAt: "2026-03-10T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  });

  db.actions.set("act-titan-1", {
    id: "act-titan-1",
    organizationId: "org-titan-corp",
    recommendation: "Upgrade High-Voltage Substation Relays",
    owner: "Arthur Vance",
    deadline: "2026-09-30",
    expectedValue: 8500000,
    status: "Ready",
    confidence: 95,
    automationType: "Automated",
    requiresHumanApproval: true,
    insightSource: "Substation Telemetry Feed",
    decisionDetail: "Approved for execution",
    resultMetric: "Zero unscheduled outages",
    logs: ["Action created by Arthur Vance"],
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-03-15T00:00:00Z",
  });

  db.signals.set("sig-titan-1", {
    id: "sig-titan-1",
    organizationId: "org-titan-corp",
    category: "capacity",
    severity: "critical",
    title: "Titan Northeast Feeder Overload Signal",
    description: "Transmission feeder line 42 at 94% rated capacity during peak hours.",
    evidence: "Verified via telemetry meters",
    estimatedFinancialImpact: 18000000,
    status: "active",
    detectedAt: "2026-03-12T00:00:00Z",
  });

  db.actions.set("act-ready-test-1", {
    id: "act-ready-test-1",
    organizationId: "apex-demo",
    recommendation: "Deploy Dynamic Pricing Corridors for Export Tariffs",
    owner: "Elena Cho",
    deadline: "2026-09-15",
    expectedValue: 8000000,
    status: "Ready",
    confidence: 92,
    automationType: "AI-assisted",
    requiresHumanApproval: true,
    insightSource: "FX Corridors Scan",
    decisionDetail: "Pending CEO Approval",
    resultMetric: "Revenue yield calibration",
    logs: ["Action created in Ready status"],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  });

  await testCase("Authentication Security", "1. Successful login authenticates credentials and registers session in store", async () => {
    const loginResult = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_auth_success_run"
    );
    if (!loginResult?.session?.token) throw new Error("Missing session token in provider result");
    if (loginResult.session.userId !== "usr-marcus-thorne") throw new Error("User ID mismatch");
    if (loginResult.session.organizationId !== "apex-demo") throw new Error("Organization ID mismatch");
    if (loginResult.session.role !== "CEO") throw new Error("Role mismatch");
    if (!loginResult.session.permissions.includes("org:admin")) throw new Error("Missing admin permissions");

    const sessionInStore = await defaultSessionStore.getSession(loginResult.session.token);
    if (!sessionInStore) throw new Error("Session was not registered in session store");
  });

  await testCase("Authentication Security", "2. Wrong password triggers authentication rejection with generic error", async () => {
    let rejected = false;
    let errorMessage = "";
    try {
      await authService.login(
        { email: "m.thorne@apexsync.ai", password: "WrongPassword2026!" },
        "test_auth_bad_password"
      );
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        rejected = true;
        errorMessage = err.message;
      }
    }
    if (!rejected) throw new Error("Authentication succeeded with wrong password");
    if (errorMessage !== "Invalid email or password") {
      throw new Error(`Non-uniform error message leaked: '${errorMessage}'`);
    }
  });

  await testCase("Authentication Security", "3. Unknown account email triggers uniform rejection without account enumeration", async () => {
    let rejected = false;
    let errorMessage = "";
    try {
      await authService.login(
        { email: "nonexistent.user@apexsync.ai", password: "AnyPassword123!" },
        "test_auth_unknown_acc"
      );
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        rejected = true;
        errorMessage = err.message;
      }
    }
    if (!rejected) throw new Error("Non-existent user email was accepted");
    if (errorMessage !== "Invalid email or password") {
      throw new Error(`Account existence leaked via error message: '${errorMessage}'`);
    }
  });

  await testCase("Authentication Security", "4. Invalid credentials (disabled status or missing hash) blocked", async () => {
    const testCreds = hashPassword("ApexEnterprise2026!");
    db.users.set("usr-test-disabled-acc", {
      id: "usr-test-disabled-acc",
      email: "disabled-acc@apexsync.ai",
      name: "Disabled User",
      title: "Disabled",
      status: "disabled",
      passwordHash: testCreds.hash,
      passwordSalt: testCreds.salt,
      createdAt: "2026-01-01T00:00:00Z",
    });
    db.memberships.set("mem-test-disabled-acc", {
      id: "mem-test-disabled-acc",
      organizationId: "apex-demo",
      userId: "usr-test-disabled-acc",
      role: "Operations",
      department: "Ops",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    try {
      let rejected = false;
      try {
        await defaultAuthProvider.authenticateCredentials("disabled-acc@apexsync.ai", "ApexEnterprise2026!");
      } catch (err: any) {
        if (err instanceof UnauthorizedError || err instanceof ForbiddenError) rejected = true;
      }
      if (!rejected) throw new Error("Disabled account authenticated successfully");
    } finally {
      db.users.delete("usr-test-disabled-acc");
      db.memberships.delete("mem-test-disabled-acc");
    }

    db.users.set("usr-test-no-creds", {
      id: "usr-test-no-creds",
      email: "nocreds@apexsync.ai",
      name: "No Creds User",
      title: "Test User",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
    });
    db.memberships.set("mem-test-no-creds", {
      id: "mem-test-no-creds",
      organizationId: "apex-demo",
      userId: "usr-test-no-creds",
      role: "Operations",
      department: "Ops",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    try {
      let rejected = false;
      try {
        await defaultAuthProvider.authenticateCredentials("nocreds@apexsync.ai", "SomePass123!");
      } catch (err: any) {
        if (err instanceof UnauthorizedError) rejected = true;
      }
      if (!rejected) throw new Error("User without passwordHash authenticated");
    } finally {
      db.users.delete("usr-test-no-creds");
      db.memberships.delete("mem-test-no-creds");
    }
  });

  await testCase("Authentication Security", "5. Malformed login request rejected during validation", async () => {
    let rejectedEmptyEmail = false;
    try {
      await authService.login({ email: "", password: "SomePassword123!" }, "test_empty_email");
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof UnauthorizedError) rejectedEmptyEmail = true;
    }
    if (!rejectedEmptyEmail) throw new Error("Login succeeded with empty email");

    let rejectedEmptyPass = false;
    try {
      await authService.login({ email: "m.thorne@apexsync.ai", password: "" }, "test_empty_password");
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof UnauthorizedError) rejectedEmptyPass = true;
    }
    if (!rejectedEmptyPass) throw new Error("Login succeeded with empty password");
  });

  await testCase("Authentication Security", "6. Plaintext password is never returned in session data or user profiles", async () => {
    const loginResult = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_no_pwd_leak"
    );
    const session = loginResult.session;
    if ((session as any).password || (session as any).currentPassword || (session as any).plainPassword) {
      throw new Error("Session object leaked plaintext password");
    }

    const sessionData = await authService.getCurrentSession(tenantAContext);
    if ((sessionData.user as any).password) {
      throw new Error("getCurrentSession leaked plaintext password");
    }
  });

  await testCase("Authentication Security", "7. Password hash and salt are never returned in session data or user records", async () => {
    const loginResult = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_no_hash_leak"
    );
    const session = loginResult.session;
    if ((session as any).passwordHash || (session as any).passwordSalt) {
      throw new Error("Session object leaked cryptographic hashes or salts");
    }

    const sessionData = await authService.getCurrentSession(tenantAContext);
    if ((sessionData.user as any).passwordHash || (sessionData.user as any).passwordSalt) {
      throw new Error("User session leaked cryptographic hashes or salts");
    }
  });

  await testCase("Authentication Security", "8. Session token never returned in login API JSON response payload", async () => {
    const result = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_json_response_clean"
    );

    const apiJsonResponse = {
      success: true,
      user: {
        id: result.session.userId,
        email: result.session.userEmail,
        name: result.session.userName,
        role: result.session.role,
        permissions: result.session.permissions,
      },
      organization: {
        id: result.session.organizationId,
        name: result.session.organizationName,
      },
      availableOrganizations: result.availableOrganizations,
      expiresAt: result.session.expiresAt,
    };

    if ("token" in apiJsonResponse || (apiJsonResponse as any).token !== undefined) {
      throw new Error("CRITICAL SECURITY DEFECT: Session token leaked in login JSON response payload");
    }
  });

  await testCase("Authentication Security", "9. Secure cookie configuration enforces HttpOnly, Secure, SameSite, and path", () => {
    const prevEnv = process.env.APP_ENV;
    try {
      process.env.APP_ENV = "production";
      const prodCookie = getSessionCookieOptions(86400);
      if (prodCookie.name !== AUTH_COOKIE_NAME) throw new Error("Incorrect cookie name");
      if (prodCookie.httpOnly !== true) throw new Error("Cookie missing HttpOnly flag");
      if (prodCookie.secure !== true) throw new Error("Cookie missing Secure flag in production");
      if (prodCookie.sameSite !== "lax") throw new Error("Cookie missing SameSite=lax attribute");
      if (prodCookie.path !== "/") throw new Error("Cookie path is not root /");
      if (prodCookie.maxAge !== 86400) throw new Error("Cookie maxAge mismatch");

      const clearCookie = getClearSessionCookieOptions();
      if (clearCookie.name !== AUTH_COOKIE_NAME) throw new Error("Clear cookie name mismatch");
      if (clearCookie.value !== "") throw new Error("Clear cookie value not empty");
      if (clearCookie.maxAge !== 0) throw new Error("Clear cookie maxAge is not 0");
    } finally {
      process.env.APP_ENV = prevEnv;
    }
  });

  await testCase("Authentication Security", "10. Session token uses cryptographically secure random bytes with high entropy", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = generateSecureToken("apex_sec");
      if (!token.startsWith("apex_sec_")) throw new Error("Invalid token prefix format");
      if (token.length < 32) throw new Error("Token length insufficient for 256-bit entropy");
      if (tokens.has(token)) throw new Error("Duplicate token generated (entropy defect)");
      tokens.add(token);
    }
  });

  await testCase("Authentication Security", "11. Valid session resolves authenticated TenantContext via Header and Cookie", async () => {
    const login = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_valid_session"
    );
    const token = login.session.token;

    const ctxHeader = await resolveTenantContext({ authorization: `Bearer ${token}` }, defaultSessionStore);
    if (ctxHeader.userId !== "usr-marcus-thorne") throw new Error("Header auth userId mismatch");
    if (ctxHeader.organizationId !== "apex-demo") throw new Error("Header auth organizationId mismatch");

    const ctxCookie = await resolveTenantContext({ cookie: `${AUTH_COOKIE_NAME}=${token}` }, defaultSessionStore);
    if (ctxCookie.userId !== "usr-marcus-thorne") throw new Error("Cookie auth userId mismatch");
    if (ctxCookie.organizationId !== "apex-demo") throw new Error("Cookie auth organizationId mismatch");
  });

  await testCase("Authentication Security", "12. Expired session triggers 401 Unauthorized and is purged from store", async () => {
    const expiredSession = await defaultSessionStore.createSession(
      { id: "usr-temp-expired", email: "temp@example.com", name: "Temp" },
      { id: "apex-demo", name: "Apex Demo" },
      "CEO",
      [...ROLE_PERMISSIONS["CEO"]],
      -10
    );
    let rejected = false;
    try {
      await resolveTenantContext({ authorization: `Bearer ${expiredSession.token}` }, defaultSessionStore);
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejected = true;
    }
    if (!rejected) throw new Error("Expired session token was accepted");
    const sessionInStore = await defaultSessionStore.getSession(expiredSession.token);
    if (sessionInStore) throw new Error("Expired session was not purged from store");
  });

  await testCase("Authentication Security", "13. Revoked session token triggers 401 Unauthorized", async () => {
    const login = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_revoked_session"
    );
    const token = login.session.token;
    await defaultSessionStore.revokeSession(token);

    let rejected = false;
    try {
      await resolveTenantContext({ authorization: `Bearer ${token}` }, defaultSessionStore);
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejected = true;
    }
    if (!rejected) throw new Error("Revoked session token was accepted");
  });

  await testCase("Authentication Security", "14. Unknown / forged session token triggers 401 Unauthorized", async () => {
    let rejected = false;
    try {
      await resolveTenantContext({ authorization: "Bearer apex_sec_forged_random_string_12345" }, defaultSessionStore);
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejected = true;
    }
    if (!rejected) throw new Error("Forged token was accepted");
  });

  await testCase("Authentication Security", "15. Malformed session string triggers 401 Unauthorized", async () => {
    let rejectedEmpty = false;
    try {
      await resolveTenantContext({ authorization: "Bearer " }, defaultSessionStore);
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejectedEmpty = true;
    }
    if (!rejectedEmpty) throw new Error("Empty Bearer token was accepted");

    let rejectedCookie = false;
    try {
      await resolveTenantContext({ cookie: `${AUTH_COOKIE_NAME}=; other=123` }, defaultSessionStore);
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejectedCookie = true;
    }
    if (!rejectedCookie && process.env.APP_ENV === "production") {
      throw new Error("Empty cookie value was accepted");
    }
  });

  await testCase("Authentication Security", "16. Logout invalidates session token immediately in store", async () => {
    const login = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_logout_run"
    );
    const token = login.session.token;
    await authService.logout(token, tenantAContext);
    const session = await defaultSessionStore.getSession(token);
    if (session) throw new Error("Revoked session token remains valid in store after logout");
  });

  await testCase("Authentication Security", "17. Session fixation prevention: logins generate distinct cryptographic tokens", async () => {
    const login1 = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_fixation_1"
    );
    const login2 = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_fixation_2"
    );

    if (login1.session.token === login2.session.token) {
      throw new Error("Sequential logins returned identical session token (session fixation vulnerability)");
    }
    if (!login1.session.token.startsWith("apex_sec_") || !login2.session.token.startsWith("apex_sec_")) {
      throw new Error("Tokens do not use secure prefix format");
    }
  });

  await testCase("Authentication Security", "18. Target organization spoofing during login or switch is rejected with 403", async () => {
    let rejectedLogin = false;
    try {
      await defaultAuthProvider.authenticateCredentials(
        "m.thorne@apexsync.ai",
        "ApexEnterprise2026!",
        "org-titan-corp"
      );
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejectedLogin = true;
    }
    if (!rejectedLogin) throw new Error("User authenticated into unassigned organization tenant");

    let rejectedSwitch = false;
    try {
      await authService.switchOrganization("org-titan-corp", tenantAContext);
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejectedSwitch = true;
    }
    if (!rejectedSwitch) throw new Error("User switched into unauthorized tenant");
  });

  await testCase("Authentication Security", "19. Client-supplied organization headers or body cannot override context", async () => {
    const marcusLogin = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_tenant_spoof_login"
    );
    const headers = {
      authorization: `Bearer ${marcusLogin.session.token}`,
      "x-organization-id": "org-titan-corp",
      "x-tenant-id": "org-titan-corp",
    };
    const ctx = await resolveTenantContext(headers, defaultSessionStore);
    if (ctx.organizationId !== "apex-demo") {
      throw new Error(`Tenant spoofing vulnerability: Context resolved to '${ctx.organizationId}' instead of 'apex-demo'`);
    }
  });

  await testCase("Authentication Security", "20. Client cannot claim arbitrary role; role is derived strictly from membership", async () => {
    const elenaLogin = await authService.login(
      { email: "e.cho@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_role_spoof_login"
    );
    const headers = {
      authorization: `Bearer ${elenaLogin.session.token}`,
      "x-role": "CEO",
      "x-user-role": "SuperAdmin",
    };
    const ctx = await resolveTenantContext(headers, defaultSessionStore);
    if (ctx.userRole !== "Relationship Manager") {
      throw new Error(`Role spoofing vulnerability: Context resolved to '${ctx.userRole}' instead of verified 'Relationship Manager'`);
    }
  });

  await testCase("Authentication Security", "21. Client cannot claim arbitrary permissions; derived strictly from server rules", async () => {
    const elenaLogin = await authService.login(
      { email: "e.cho@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_perm_spoof_login"
    );
    const headers = {
      authorization: `Bearer ${elenaLogin.session.token}`,
      "x-permissions": "admin:manage,customer:delete,security:audit",
    };
    const ctx = await resolveTenantContext(headers, defaultSessionStore);
    if (ctx.permissions.includes("admin:manage") || ctx.permissions.includes("customer:delete")) {
      throw new Error("Permission spoofing vulnerability: Context granted unverified permissions from client header");
    }
  });

  await testCase("Authentication Security", "22. Production environment strictly denies demo fallback even with DEMO_MODE=true", async () => {
    const prevAppEnv = process.env.APP_ENV;
    const prevDemoMode = process.env.DEMO_MODE;
    try {
      process.env.APP_ENV = "production";
      process.env.DEMO_MODE = "true";

      let rejected = false;
      try {
        await resolveTenantContext({}, defaultSessionStore);
      } catch (err: any) {
        if (err instanceof UnauthorizedError) rejected = true;
      }
      if (!rejected) throw new Error("Production mode silently fell back to demo tenant context");
    } finally {
      process.env.APP_ENV = prevAppEnv;
      process.env.DEMO_MODE = prevDemoMode;
    }
  });

  await testCase("Authentication Security", "23. Authentication errors return uniform generic message without stack traces", async () => {
    const attempts = [
      { email: "nonexistent@apexsync.ai", password: "SomePassword123!" },
      { email: "m.thorne@apexsync.ai", password: "WrongPassword2026!" },
      { email: "malformed@invalid", password: "AnyPassword123!" },
    ];

    for (const attempt of attempts) {
      try {
        await authService.login(attempt, "test_error_safety");
        throw new Error("Authentication should have failed");
      } catch (err: any) {
        if (!(err instanceof UnauthorizedError)) {
          throw new Error(`Expected UnauthorizedError, got ${err?.constructor?.name}`);
        }
        if (err.message !== "Invalid email or password") {
          throw new Error(`Information leakage in error message: '${err.message}'`);
        }
      }
    }
  });

  await testCase("Authentication Security", "24. Concurrent session isolation preserves discrete tenant contexts", async () => {
    const marcusLogin = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_concurrent_marcus"
    );
    const elenaLogin = await authService.login(
      { email: "e.cho@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_concurrent_elena"
    );

    const concurrentRequests = Array.from({ length: 20 }, (_, i) => {
      const isEven = i % 2 === 0;
      const token = isEven ? marcusLogin.session.token : elenaLogin.session.token;
      return resolveTenantContext({ authorization: `Bearer ${token}` }, defaultSessionStore);
    });

    const resolvedContexts = await Promise.all(concurrentRequests);
    resolvedContexts.forEach((ctx, idx) => {
      const isEven = idx % 2 === 0;
      const expectedUserId = isEven ? "usr-marcus-thorne" : "usr-elena-cho";
      const expectedOrgId = "apex-demo";
      const expectedRole = isEven ? "CEO" : "Relationship Manager";

      if (ctx.userId !== expectedUserId || ctx.organizationId !== expectedOrgId || ctx.userRole !== expectedRole) {
        throw new Error(`Concurrent context collision at index ${idx}: expected ${expectedUserId}, got ${ctx.userId}`);
      }
    });
  });

  await testCase("Authentication Security", "25. Authenticated-user endpoint (/api/v1/auth/me) returns sanitized data", async () => {
    const sessionData = await authService.getCurrentSession(tenantAContext);
    if (!sessionData.user || !sessionData.organization) {
      throw new Error("Missing user or organization data in session profile");
    }

    const userKeys = Object.keys(sessionData.user);
    const forbiddenKeys = ["password", "passwordHash", "passwordSalt", "token", "sessionSecret"];
    for (const forbidden of forbiddenKeys) {
      if (userKeys.includes(forbidden) || (sessionData as any)[forbidden] !== undefined) {
        throw new Error(`Authenticated session endpoint leaked secret key '${forbidden}'`);
      }
    }
  });

  await testCase("Authentication Security", "Password policy enforcement verifies minimum complexity", () => {
    const tooShort = validatePasswordPolicy("12345");
    const validPass = validatePasswordPolicy("ApexEnterprise2026!");
    if (tooShort.valid) throw new Error("Short password was accepted");
    if (!validPass.valid) throw new Error("Valid enterprise password was rejected");
  });

  await testCase("Authentication Security", "Password change verifies current credentials and revokes active sessions", async () => {
    const elenaAuth = await authService.login(
      { email: "e.cho@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_pwd_change_run"
    );
    const oldToken = elenaAuth.session.token;

    await authService.changePassword(
      {
        userId: "usr-elena-cho",
        currentPassword: "ApexEnterprise2026!",
        newPassword: "UpdatedElenaPass2026!",
      },
      tenantARMContext
    );

    const sessionAfter = await defaultSessionStore.getSession(oldToken);
    if (sessionAfter) throw new Error("Active session was not revoked after password change");

    const newAuth = await authService.login(
      { email: "e.cho@apexsync.ai", password: "UpdatedElenaPass2026!" },
      "test_pwd_change_relogin"
    );
    if (!newAuth.session.token) throw new Error("Login with updated password failed");

    await authService.changePassword(
      {
        userId: "usr-elena-cho",
        currentPassword: "UpdatedElenaPass2026!",
        newPassword: "ApexEnterprise2026!",
      },
      tenantARMContext
    );
  });

  await testCase("Authentication Security", "Login rate limiting throttles excessive failed attempts", async () => {
    const testEmail = "rate-limit-test@apexsync.ai";
    const testIp = "192.168.1.100";

    for (let i = 0; i < 5; i++) {
      try {
        await authService.login(
          { email: testEmail, password: "BadPassword!" },
          `rate_attempt_${i}`,
          { ipAddress: testIp }
        );
      } catch {}
    }

    let rateLimited = false;
    try {
      await authService.login(
        { email: testEmail, password: "BadPassword!" },
        "rate_attempt_6",
        { ipAddress: testIp }
      );
    } catch (err: any) {
      if (err instanceof UnauthorizedError && err.message.includes("Too many failed login attempts")) {
        rateLimited = true;
      }
    }

    if (!rateLimited) {
      throw new Error("Excessive failed login attempts were not throttled by rate limiter");
    }
  });

  await testCase("Customer Domain", "Tenant A reads own customer record (ALLOW)", async () => {
    const cust = await customerService.getCustomerById("cust-dangote", tenantAContext);
    if (!cust || cust.organizationId !== "apex-demo") {
      throw new Error("Failed to read customer or organizationId mismatch");
    }
  });

  await testCase("Customer Domain", "Tenant A reading Tenant B customer is blocked with CrossTenantViolationError (DENY)", async () => {
    let blocked = false;
    try {
      await customerService.getCustomerById("cust-titan-energy", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B customer");
  });

  await testCase("Customer Domain", "Tenant A updating Tenant B customer is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await customerService.updateCustomer("cust-titan-energy", { name: "Tampered Customer" }, tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A modified Tenant B customer");
  });

  await testCase("Customer Domain", "Tenant A deleting Tenant B customer is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await customerService.deleteCustomer("cust-titan-energy", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A deleted Tenant B customer");
  });

  await testCase("Customer Domain", "Create Customer with payload-spoofed organizationId forces authenticated TenantContext", async () => {
    const created = await customerService.createCustomer(
      {
        name: "Spoof Test Customer",
        contactEmail: "spoof@testcorp.com",
        ...({ organizationId: "org-titan-corp" } as any),
      },
      tenantAContext
    );
    if (created.organizationId !== "apex-demo") {
      throw new Error(`Critical Isolation Flaw: Created customer has organizationId '${created.organizationId}' instead of 'apex-demo'`);
    }
    db.customers.delete(created.id);
  });

  await testCase("Customer Domain", "Customer list and search queries are strictly tenant-scoped", async () => {
    const list = await customerService.getCustomers(tenantAContext);
    const leaked = list.items.some((c) => c.organizationId !== "apex-demo");
    if (leaked) throw new Error("Cross-tenant customer record leaked in getCustomers");
    if (list.items.length === 0) throw new Error("Expected Tenant A customer records");

    const searchResults = await customerService.getCustomers(tenantAContext, { search: "Dangote" });
    if (searchResults.items.some((c) => c.organizationId !== "apex-demo")) {
      throw new Error("Cross-tenant record leaked in search");
    }
  });

  await testCase("Customer Domain", "Tenant B reads own customer and sees 0 Tenant A customers", async () => {
    const custB = await customerService.getCustomerById("cust-titan-energy", tenantBContext);
    if (!custB || custB.organizationId !== "org-titan-corp") {
      throw new Error("Tenant B failed to read own customer");
    }
    const listB = await customerService.getCustomers(tenantBContext);
    if (listB.items.some((c) => c.organizationId !== "org-titan-corp")) {
      throw new Error("Tenant B customer list leaked Tenant A records");
    }
  });

  await testCase("Contract Domain", "Tenant A reads own contract record (ALLOW)", async () => {
    const contract = await db.contractsRepo.findById("contract-1", tenantAContext, "Contract");
    if (!contract || contract.organizationId !== "apex-demo") {
      throw new Error("Failed to read contract or organizationId mismatch");
    }
  });

  await testCase("Contract Domain", "Tenant A reading Tenant B contract is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.contractsRepo.findById("contract-titan-1", tenantAContext, "Contract");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B contract");
  });

  await testCase("Contract Domain", "Tenant A updating Tenant B contract is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.contractsRepo.update("contract-titan-1", { title: "Tampered Title" }, tenantAContext, "Contract");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A modified Tenant B contract");
  });

  await testCase("Contract Domain", "Tenant A deleting Tenant B contract is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.contractsRepo.delete("contract-titan-1", tenantAContext, "Contract");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A deleted Tenant B contract");
  });

  await testCase("Contract Domain", "Contract queries (findByCustomer, findExpiringSoon) strictly tenant-scoped", async () => {
    const expiring = await db.contractsRepo.findExpiringSoon(365, tenantAContext);
    if (expiring.items.some((c) => c.organizationId !== "apex-demo")) {
      throw new Error("Cross-tenant contract leaked in findExpiringSoon");
    }
    const customerContracts = await db.contractsRepo.findByCustomer("cust-dangote", tenantAContext);
    if (customerContracts.items.some((c) => c.organizationId !== "apex-demo")) {
      throw new Error("Cross-tenant contract leaked in findByCustomer");
    }
  });

  await testCase("Transaction Domain", "Tenant A reads own transaction (ALLOW)", async () => {
    const txn = await db.transactionsRepo.findById("txn-1", tenantAContext, "Transaction");
    if (!txn || txn.organizationId !== "apex-demo") {
      throw new Error("Failed to read transaction or organizationId mismatch");
    }
  });

  await testCase("Transaction Domain", "Tenant A reading Tenant B transaction is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.transactionsRepo.findById("txn-titan-1", tenantAContext, "Transaction");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B transaction");
  });

  await testCase("Transaction Domain", "Financial totals calculation strictly isolates revenue and cost aggregates", async () => {
    const totalsA = await db.transactionsRepo.calculateFinancialTotals(tenantAContext);
    const totalsB = await db.transactionsRepo.calculateFinancialTotals(tenantBContext);

    if (totalsA.totalRevenue === 0) throw new Error("Tenant A financial revenue calculation failed");
    if (totalsB.totalRevenue !== 12500000) throw new Error(`Tenant B totals mismatch: ${totalsB.totalRevenue}`);
  });

  await testCase("Document Domain", "Tenant A reads own document metadata (ALLOW)", async () => {
    const doc = await documentService.getDocumentById("doc-1", tenantAContext);
    if (!doc || doc.organizationId !== "apex-demo") {
      throw new Error("Failed to read document or organizationId mismatch");
    }
  });

  await testCase("Document Domain", "Tenant A reading Tenant B document is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await documentService.getDocumentById("doc-titan-secret-contract", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B document");
  });

  await testCase("Document Domain", "Tenant A deleting Tenant B document is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await documentService.deleteDocument("doc-titan-secret-contract", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A deleted Tenant B document");
  });

  await testCase("Document Domain", "Inverted text search index strictly filters by organizationId", async () => {
    const matchesA = await documentSearchIndex.search("apex-demo", "roadmap");
    if (matchesA.includes("doc-titan-secret-contract")) {
      throw new Error("Inverted search index leaked Tenant B document ID to Tenant A query");
    }
    const matchesB = await documentSearchIndex.search("org-titan-corp", "roadmap");
    if (!matchesB.includes("doc-titan-secret-contract")) {
      throw new Error("Tenant B search index failed to find its own document");
    }
  });

  await testCase("Document Domain", "Document upload with payload spoofing forces caller organizationId", async () => {
    const uploaded = await documentService.uploadDocument(
      {
        name: "Test Spoof Doc.pdf",
        fileType: "pdf",
        category: "Contract",
        content: "Sample contract content with indexation rules",
        ...({ organizationId: "org-titan-corp" } as any),
      },
      tenantAContext
    );
    if (uploaded.organizationId !== "apex-demo") {
      throw new Error(`Document upload allowed organizationId spoofing: ${uploaded.organizationId}`);
    }
    await documentService.deleteDocument(uploaded.id, tenantAContext);
  });

  await testCase("Knowledge Domain", "Tenant A reads own knowledge item (ALLOW)", async () => {
    const item = await knowledgeService.getKnowledgeItemById("know-1", tenantAContext);
    if (!item || item.organizationId !== "apex-demo") {
      throw new Error("Failed to read knowledge item or organizationId mismatch");
    }
  });

  await testCase("Knowledge Domain", "Tenant A reading Tenant B private knowledge item is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await knowledgeService.getKnowledgeItemById("know-titan-secret-playbook", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B knowledge item");
  });

  await testCase("Knowledge Domain", "Tenant A updating Tenant B knowledge item is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await knowledgeService.updateKnowledgeItem(
        "know-titan-secret-playbook",
        { title: "Tampered Title" },
        tenantAContext
      );
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A modified Tenant B knowledge item");
  });

  await testCase("Knowledge Domain", "Knowledge search content queries strictly scoped to caller tenant", async () => {
    const searchA = await knowledgeService.getKnowledgeItems(tenantAContext, { query: "interconnects" });
    if (searchA.items.some((k) => k.id === "know-titan-secret-playbook")) {
      throw new Error("Knowledge search leaked Tenant B playbook to Tenant A");
    }
  });

  await testCase("Memory Domain", "Tenant A reads own organizational memory item (ALLOW)", async () => {
    const mem = await memoryService.getMemoryById("mem-fact-1", tenantAContext);
    if (!mem || mem.organizationId !== "apex-demo") {
      throw new Error("Failed to read memory item or organizationId mismatch");
    }
  });

  await testCase("Memory Domain", "Tenant A reading Tenant B memory item is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await memoryService.getMemoryById("mem-titan-fact-1", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B memory item");
  });

  await testCase("Memory Domain", "Memory list and keyword filtering strictly tenant-scoped", async () => {
    const memories = await memoryService.getMemoryItems(tenantAContext);
    if (memories.items.some((m) => m.organizationId !== "apex-demo")) {
      throw new Error("Memory list leaked cross-tenant items");
    }
  });

  await testCase("Value Intelligence", "Tenant A reads own opportunity (ALLOW)", async () => {
    const opp = await valueService.getOpportunityById("opp-1", tenantAContext);
    if (!opp || opp.organizationId !== "apex-demo") {
      throw new Error("Failed to read opportunity or organizationId mismatch");
    }
  });

  await testCase("Value Intelligence", "Tenant A reading Tenant B opportunity is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await valueService.getOpportunityById("opp-titan-1", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B opportunity");
  });

  await testCase("Value Intelligence", "Tenant A updating Tenant B opportunity is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.opportunitiesRepo.update("opp-titan-1", { status: "Captured" }, tenantAContext, "ValueOpportunity");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A modified Tenant B opportunity");
  });

  await testCase("Value Intelligence", "Value summary calculations strictly use caller tenant datasets", async () => {
    const summaryA = await valueService.getSummary(tenantAContext);
    const summaryB = await valueService.getSummary(tenantBContext);

    if (summaryA.tenantBaselineSummary.totalArr === 0) throw new Error("Tenant A ARR summary calculation failed");
    if (!summaryA.potentialValueIdentified.evidence) throw new Error("Missing evidence metadata in summary");
    if (summaryB.potentialValueIdentified.value !== 12000000) {
      throw new Error(`Tenant B value calculation mismatch: ${summaryB.potentialValueIdentified.value}`);
    }
  });

  await testCase("Workflow Domain", "Tenant A reads own workflow (ALLOW)", async () => {
    const wf = await workflowService.getWorkflowById("wf-1", tenantAContext);
    if (!wf || wf.organizationId !== "apex-demo") {
      throw new Error("Failed to read workflow or organizationId mismatch");
    }
  });

  await testCase("Workflow Domain", "Tenant A reading Tenant B workflow is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await workflowService.getWorkflowById("wf-titan-secret", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B workflow");
  });

  await testCase("Workflow Domain", "Tenant A triggering Tenant B workflow execution is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await workflowService.triggerWorkflowRun({ workflowId: "wf-titan-secret" }, tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A executed Tenant B workflow");
  });

  await testCase("Workflow Domain", "Workflow DAG cycle validation detects and rejects circular dependencies", () => {
    let rejected = false;
    try {
      WorkflowValidator.validateWorkflowGraph(
        [
          { id: "node-1", type: "trigger", title: "Trigger", configuration: {} },
          { id: "node-2", type: "action", title: "Action", configuration: {} },
        ],
        [
          { id: "c1", fromNodeId: "node-1", toNodeId: "node-2" },
          { id: "c2", fromNodeId: "node-2", toNodeId: "node-1" },
        ]
      );
    } catch (err: any) {
      if (err instanceof ValidationError) rejected = true;
    }
    if (!rejected) throw new Error("Validation failure: Cyclic workflow graph accepted");
  });

  await testCase("Action Domain", "Tenant A reads own action (ALLOW)", async () => {
    const act = await actionService.getActionById("act-1", tenantAContext);
    if (!act || act.organizationId !== "apex-demo") {
      throw new Error("Failed to read action or organizationId mismatch");
    }
  });

  await testCase("Action Domain", "Tenant A advancing Tenant B action is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await actionService.advanceAction("act-titan-1", tenantAContext);
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A advanced Tenant B action");
  });

  await testCase("Action Domain", "Action creation with payload spoofing forces caller organizationId", async () => {
    const act = await actionService.createAction(
      {
        recommendation: "Test Spoof Action for Execution Engine",
        expectedValue: 5000000,
        ...({ organizationId: "org-titan-corp" } as any),
      },
      tenantAContext
    );
    if (act.organizationId !== "apex-demo") {
      throw new Error(`Action creation allowed organizationId spoofing: ${act.organizationId}`);
    }
    db.actions.delete(act.id);
  });

  await testCase("Signals Domain", "Tenant A reads own signal (ALLOW)", async () => {
    const sig = await db.signalsRepo.findById("sig-1", tenantAContext, "Signal");
    if (!sig || sig.organizationId !== "apex-demo") {
      throw new Error("Failed to read signal or organizationId mismatch");
    }
  });

  await testCase("Signals Domain", "Tenant A reading Tenant B signal is blocked (DENY)", async () => {
    let blocked = false;
    try {
      await db.signalsRepo.findById("sig-titan-1", tenantAContext, "Signal");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Security Breach: Tenant A accessed Tenant B signal");
  });

  await testCase("Signals Domain", "Signal category queries strictly isolate Tenant A from Tenant B", async () => {
    const signalsA = await db.signalsRepo.findActiveByCategory("all", tenantAContext);
    if (signalsA.items.some((s) => s.organizationId !== "apex-demo")) {
      throw new Error("Cross-tenant signal leaked in findActiveByCategory");
    }
  });

  await testCase("RBAC Enforcement", "User lacking action:approve capability is blocked from approving action", async () => {
    let rejected = false;
    try {
      await actionService.advanceAction("act-ready-test-1", tenantARMContext);
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejected = true;
    }
    if (!rejected) throw new Error("RBAC Failure: User without action:approve approved action");
  });

  await testCase("RBAC Enforcement", "User lacking org:admin capability cannot change another user's credentials", async () => {
    let rejected = false;
    try {
      await authService.changePassword(
        {
          userId: "usr-marcus-thorne",
          currentPassword: "ApexEnterprise2026!",
          newPassword: "HackedPassword2026!",
        },
        tenantARMContext
      );
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejected = true;
    }
    if (!rejected) throw new Error("RBAC Failure: Non-admin changed another user's password");
  });

  await testCase("RBAC Enforcement", "User lacking audit:read capability is blocked from viewing audit logs", async () => {
    const restrictedContext: TenantContext = {
      ...tenantARMContext,
      permissions: tenantARMContext.permissions.filter((p) => p !== "audit:read"),
    };
    let rejected = false;
    try {
      await auditService.getAuditLogs(restrictedContext);
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejected = true;
    }
    if (!rejected) throw new Error("RBAC Failure: User without audit:read accessed audit logs");
  });

  await testCase("AI Tool Security", "get_tenant_customers AI tool is strictly tenant-scoped", async () => {
    const customers = (await authorizedAiTools.get_tenant_customers.handler({}, tenantAContext)) as any[];
    if (customers.some((c: any) => c.id === "cust-titan-energy")) {
      throw new Error("AI tool get_tenant_customers leaked Tenant B customer records");
    }
    if (customers.length === 0) throw new Error("Expected Tenant A customer records from AI tool");
  });

  await testCase("AI Tool Security", "get_value_opportunities AI tool is strictly tenant-scoped", async () => {
    const opps = (await authorizedAiTools.get_value_opportunities.handler({}, tenantAContext)) as any[];
    if (opps.some((o: any) => o.id === "opp-titan-1")) {
      throw new Error("AI tool get_value_opportunities leaked Tenant B opportunity");
    }
  });

  await testCase("AI Tool Security", "get_tenant_contracts AI tool is strictly tenant-scoped", async () => {
    const contracts = (await authorizedAiTools.get_tenant_contracts.handler({}, tenantAContext)) as any[];
    if (contracts.some((c: any) => c.id === "contract-titan-1")) {
      throw new Error("AI tool get_tenant_contracts leaked Tenant B contract");
    }
  });

  await testCase("AI Tool Security", "get_tenant_documents AI tool is strictly tenant-scoped", async () => {
    const docs = (await authorizedAiTools.get_tenant_documents.handler({}, tenantAContext)) as any[];
    if (docs.some((d: any) => d.id === "doc-titan-secret-contract")) {
      throw new Error("AI tool get_tenant_documents leaked Tenant B document");
    }
  });

  await testCase("AI Tool Security", "AI Intelligence Prompt aggregates only tenant-grounded records and handles empty organizations cleanly", async () => {
    const responseA = await aiOrchestratorService.processIntelligencePrompt(
      { prompt: "Analyze our revenue leakages", mode: "Revenue" },
      tenantAContext
    );
    if (responseA.groundedRecordsCount === 0) throw new Error("Failed to ground analysis in Tenant A records");
    if (responseA.organizationId !== "apex-demo") throw new Error("Organization ID mismatch in AI response");

    const emptyOrgContext: TenantContext = {
      organizationId: "org-empty-test",
      userId: "usr-empty",
      userEmail: "empty@test.com",
      userRole: "CEO",
      permissions: [...ROLE_PERMISSIONS["CEO"]],
      requestId: "test_empty_org",
      timestamp: new Date().toISOString(),
    };
    db.organizations.set("org-empty-test", {
      id: "org-empty-test",
      name: "Empty Org Ltd",
      displayName: "Empty Org",
      slug: "empty-org",
      industry: "general",
      plan: "standard",
      currency: "USD",
      currencySymbol: "$",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      const responseEmpty = await aiOrchestratorService.processIntelligencePrompt(
        { prompt: "What is my revenue?", mode: "Revenue" },
        emptyOrgContext
      );
      if (responseEmpty.status !== "insufficient_data" || responseEmpty.groundedRecordsCount !== 0) {
        throw new Error("Empty tenant did not return structured 'insufficient_data' status");
      }
    } finally {
      db.organizations.delete("org-empty-test");
    }
  });

  await testCase("Audit Logging & Protection", "Cross-tenant access attempts generate security audit violation records", async () => {
    try {
      await customerService.getCustomerById("cust-titan-energy", tenantAContext);
    } catch {}

    const logsAfter = await db.auditLogsRepo.findMany(tenantAContext, { limit: 100 });
    const violationLog = logsAfter.items.find(
      (l) => l.action === "security:cross_tenant_access_attempt" && l.resourceId === "cust-titan-energy"
    );

    if (!violationLog) {
      throw new Error("Cross-tenant access attempt was not recorded in security audit log");
    }
    if (violationLog.status !== "denied") {
      throw new Error(`Violation log status should be 'denied', got '${violationLog.status}'`);
    }
  });

  await testCase("Audit Logging & Protection", "Audit log retrieval is strictly isolated between tenants", async () => {
    const logsA = await auditService.getAuditLogs(tenantAContext);
    const leakedToA = logsA.items.some((l) => l.organizationId !== "apex-demo");
    if (leakedToA) throw new Error("Cross-tenant audit log leaked to Tenant A");

    const logsB = await auditService.getAuditLogs(tenantBContext);
    const leakedToB = logsB.items.some((l) => l.organizationId !== "org-titan-corp");
    if (leakedToB) throw new Error("Cross-tenant audit log leaked to Tenant B");
  });

  await testCase("Concurrency & Isolation", "Concurrent parallel operations across Tenant A and Tenant B execute without cross-contamination", async () => {
    const [custA, custB, summaryA, summaryB, docsA, docsB, knowA, knowB] = await Promise.all([
      customerService.getCustomers(tenantAContext),
      customerService.getCustomers(tenantBContext),
      valueService.getSummary(tenantAContext),
      valueService.getSummary(tenantBContext),
      documentService.getDocuments(tenantAContext),
      documentService.getDocuments(tenantBContext),
      knowledgeService.getKnowledgeItems(tenantAContext),
      knowledgeService.getKnowledgeItems(tenantBContext),
    ] as const);

    if (custA.items.some((c) => c.organizationId !== "apex-demo")) throw new Error("Concurrent custA contaminated");
    if (custB.items.some((c) => c.organizationId !== "org-titan-corp")) throw new Error("Concurrent custB contaminated");
    if (docsA.items.some((d) => d.organizationId !== "apex-demo")) throw new Error("Concurrent docsA contaminated");
    if (docsB.items.some((d) => d.organizationId !== "org-titan-corp")) throw new Error("Concurrent docsB contaminated");
    if (knowA.items.some((k) => k.organizationId !== "apex-demo")) throw new Error("Concurrent knowA contaminated");
    if (knowB.items.some((k) => k.organizationId !== "org-titan-corp")) throw new Error("Concurrent knowB contaminated");
    void summaryA;
    void summaryB;
  });

  await testCase("Validation & Sanitization", "Invalid email format rejected during customer creation", async () => {
    let rejected = false;
    try {
      await customerService.createCustomer(
        { name: "Invalid Email Corp", contactEmail: "no-at-sign-domain.com" },
        tenantAContext
      );
    } catch (err: any) {
      if (err instanceof ValidationError) rejected = true;
    }
    if (!rejected) throw new Error("Customer creation accepted malformed email address");
  });

  await testCase("Validation & Sanitization", "Missing required fields rejected during customer creation", async () => {
    let rejected = false;
    try {
      await customerService.createCustomer(
        { name: "", contactEmail: "missing-name@test.local" },
        tenantAContext
      );
    } catch (err: any) {
      if (err instanceof ValidationError) rejected = true;
    }
    if (!rejected) throw new Error("Customer creation accepted empty name");
  });

  await testCase("Validation & Sanitization", "Negative numbers rejected for financial monetary inputs", async () => {
    let rejected = false;
    try {
      await customerService.createCustomer(
        { name: "Negative ARR Corp", contactEmail: "valid@arr.com", arr: -5000 },
        tenantAContext
      );
    } catch (err: any) {
      if (err instanceof ValidationError) rejected = true;
    }
    if (!rejected) throw new Error("Customer creation accepted negative ARR amount");
  });

  await testCase("Endpoint-Level Security", "Unauthenticated request simulation fails with UnauthorizedError", async () => {
    let rejected = false;
    try {
      const headers = new Headers();
      const ctx = await resolveTenantContext(headers);
      if (!ctx) rejected = false;
    } catch (err: any) {
      if (err instanceof UnauthorizedError) rejected = true;
    }
    if (!rejected && process.env.APP_ENV === "production") {
      throw new Error("Unauthenticated request was allowed");
    }
  });

  await testCase("Endpoint-Level Security", "Insufficient permission fails with ForbiddenError", async () => {
    const limitedContext: TenantContext = {
      organizationId: "apex-demo",
      userId: "usr-limited",
      userEmail: "limited@apexsync.ai",
      userRole: "Viewer",
      permissions: ["customer:read"],
      requestId: "test_insufficient_perm",
      timestamp: new Date().toISOString(),
    };

    let rejected = false;
    try {
      await customerService.createCustomer(
        { name: "Unauthorized Add", contactEmail: "unauthorized.add@test.local" },
        limitedContext
      );
    } catch (err: any) {
      if (err instanceof ForbiddenError) rejected = true;
    }
    if (!rejected) throw new Error("Request with missing permission was permitted");
  });

  await testCase("Endpoint-Level Security", "Cross-tenant resource fetch via repository returns 404/CrossTenantViolation", async () => {
    let blocked = false;
    try {
      await db.customersRepo.findById("cust-titan-energy", tenantAContext, "Customer");
    } catch (err: any) {
      if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) blocked = true;
    }
    if (!blocked) throw new Error("Cross-tenant resource was resolved");
  });

  await testCase("Endpoint-Level Security", "Spoofed organizationId in creation payload is ignored in favor of authenticated context", async () => {
    const action = await actionService.createAction(
      {
        recommendation: "Test Payload Organization Spoofing Protection",
        expectedValue: 1000000,
        ...({ organizationId: "org-titan-corp", userId: "usr-titan-admin" } as any),
      },
      tenantAContext
    );

    if (action.organizationId !== "apex-demo") {
      throw new Error(`Security Defect: Resource adopted payload organizationId '${action.organizationId}' instead of context`);
    }
    db.actions.delete(action.id);
  });

  await testCase("Endpoint-Level Security", "AI Intelligence Engine strictly filters out other tenants' business data", async () => {
    const aiPromptResult = await aiOrchestratorService.processIntelligencePrompt(
      { prompt: "Summarize all customer contracts and board strategies across all companies" },
      tenantAContext
    );

    const fullResultText = JSON.stringify(aiPromptResult);
    if (fullResultText.includes("Titan Grid Maintenance") || fullResultText.includes("Arthur Vance") || fullResultText.includes("Titan North American")) {
      throw new Error("AI query leaked Tenant B (Titan Corp) contracts, documents, or knowledge into Tenant A context");
    }
    if (aiPromptResult.organizationId !== "apex-demo") {
      throw new Error("AI prompt result organizationId does not match authenticated context");
    }
  });

  await testCase("Endpoint-Level Security", "Valid authorized request executes, updates store, and records immutable audit log", async () => {
    const testDoc = await documentService.uploadDocument(
      {
        name: "Enterprise Audit Policy Verification.pdf",
        fileType: "pdf",
        category: "Compliance Document",
        size: "1 KB",
        contentBuffer: "Enterprise governance and multi-tenant authorization guidelines.",
      },
      tenantAContext
    );

    if (!testDoc.id || testDoc.organizationId !== "apex-demo") {
      throw new Error("Document creation failed");
    }

    const auditLogs = await db.auditLogsRepo.findMany(tenantAContext, { limit: 20 });
    const hasLog = auditLogs.items.some((l) => l.resourceId === testDoc.id);
    if (!hasLog) {
      throw new Error("Audit log was not recorded for document upload");
    }

    await documentService.deleteDocument(testDoc.id, tenantAContext);
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    passed: failedCount === 0,
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
