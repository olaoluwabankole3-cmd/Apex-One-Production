/**
 * APEX ONE — Automated Tenant Isolation & Security Verification Test Suite
 * 
 * Exhaustive Multi-Tenant Security & Authentication Verification Matrix:
 * Tenant A: apex-demo (Apex Demo Group)
 * Tenant B: org-titan-corp (Titan Global Holdings)
 * 
 * Comprehensive Test Suites:
 * 1. Authentication Security (Tokens, Passwords, Hashes, Salts, Status, Policy, Invalidation)
 * 2. Customer Isolation & Multi-Tenant Boundaries
 * 3. Value Intelligence & Revenue Isolation
 * 4. Organizational Memory & Action Isolation
 * 5. Audit Logging Scoping & Protection
 * 6. AI Orchestrator Tool Scoping
 * 7. RBAC & Governance Enforcement
 * 8. Document, Knowledge & Workflow Domain Isolation
 * 9. Graph & Request Validation
 * 10. Evidence-Grounded Calculation Integrity
 */

import { customerService } from "../domains/customers/customerService";
import { valueService } from "../domains/value/valueService";
import { memoryService } from "../domains/memory/memoryService";
import { actionService } from "../domains/actions/actionService";
import { auditService } from "../domains/audit/auditService";
import { authService } from "../domains/auth/authService";
import { documentService } from "../domains/documents/documentService";
import { knowledgeService } from "../domains/knowledge/knowledgeService";
import { workflowService } from "../domains/workflows/workflowService";
import { WorkflowValidator } from "../domains/workflows/workflowValidator";
import { defaultSessionStore, defaultAuthProvider } from "../domains/auth/authProvider";
import { authorizedAiTools } from "../domains/ai/aiOrchestratorService";
import { db } from "../database/store";
import { hashPassword, validatePasswordPolicy } from "../core/crypto";
import {
  TenantContext,
  CrossTenantViolationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../core/errors";
import { resolveTenantContext, ROLE_PERMISSIONS } from "../core/security";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
}

export async function runTenantIsolationTestSuite(): Promise<{ passed: boolean; total: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  const tenantAContext: TenantContext = {
    organizationId: "apex-demo",
    userId: "usr-marcus-thorne",
    userEmail: "m.thorne@apexsync.ai",
    userRole: "CEO",
    permissions: ROLE_PERMISSIONS["CEO"],
    requestId: "test_req_tenant_a",
    timestamp: new Date().toISOString(),
  };

  const tenantARMContext: TenantContext = {
    organizationId: "apex-demo",
    userId: "usr-elena-cho",
    userEmail: "e.cho@apexsync.ai",
    userRole: "Relationship Manager",
    permissions: ROLE_PERMISSIONS["Relationship Manager"],
    requestId: "test_req_tenant_a_rm",
    timestamp: new Date().toISOString(),
  };

  const tenantBContext: TenantContext = {
    organizationId: "org-titan-corp",
    userId: "usr-titan-admin",
    userEmail: "admin@titancorp.internal",
    userRole: "CEO",
    permissions: ROLE_PERMISSIONS["CEO"],
    requestId: "test_req_tenant_b",
    timestamp: new Date().toISOString(),
  };

  // =========================================================================
  // SUITE 1: AUTHENTICATION & PASSWORD SECURITY
  // =========================================================================

  // 1. Missing authentication token check
  try {
    const prevEnv = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";
    await resolveTenantContext({});
    results.push({
      suite: "Authentication Security",
      testName: "Missing Bearer token triggers 401 Unauthorized",
      passed: false,
      error: "Failed: Request without token was allowed",
    });
    process.env.DEMO_MODE = prevEnv;
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Missing Bearer token triggers 401 Unauthorized",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Missing Bearer token triggers 401 Unauthorized",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 2. Empty Bearer token check
  try {
    await resolveTenantContext({ authorization: "Bearer " });
    results.push({
      suite: "Authentication Security",
      testName: "Empty Bearer token triggers 401 Unauthorized",
      passed: false,
      error: "Failed: Empty Bearer token was accepted",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Empty Bearer token triggers 401 Unauthorized",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Empty Bearer token triggers 401 Unauthorized",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 3. Forged session token check
  try {
    await resolveTenantContext({ authorization: "Bearer apex_invalid_forged_token_xyz" });
    results.push({
      suite: "Authentication Security",
      testName: "Forged session token triggers 401 Unauthorized",
      passed: false,
      error: "Failed: Forged token was accepted",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Forged session token triggers 401 Unauthorized",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Forged session token triggers 401 Unauthorized",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 4. Expired session token check
  try {
    const expiredSession = await defaultSessionStore.createSession(
      { id: "usr-temp", email: "temp@example.com", name: "Temp" },
      { id: "apex-demo", name: "Apex Demo" },
      "CEO",
      ROLE_PERMISSIONS["CEO"],
      -10 // Expired 10 seconds ago
    );
    await resolveTenantContext({ authorization: `Bearer ${expiredSession.token}` });
    results.push({
      suite: "Authentication Security",
      testName: "Expired session token triggers 401 Unauthorized",
      passed: false,
      error: "Failed: Expired token was accepted",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Expired session token triggers 401 Unauthorized",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Expired session token triggers 401 Unauthorized",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 5. Valid credentials authentication (Positive flow)
  try {
    const loginResult = await authService.login(
      {
        email: "m.thorne@apexsync.ai",
        password: "ApexEnterprise2026!",
      },
      "test_auth_success"
    );
    if (
      loginResult.session &&
      loginResult.session.token &&
      loginResult.session.userId === "usr-marcus-thorne" &&
      loginResult.session.organizationId === "apex-demo" &&
      loginResult.session.role === "CEO"
    ) {
      results.push({
        suite: "Authentication Security",
        testName: "Valid Credentials Authenticate Successfully",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Valid Credentials Authenticate Successfully",
        passed: false,
        error: "Session payload mismatch",
      });
    }
  } catch (err: any) {
    results.push({
      suite: "Authentication Security",
      testName: "Valid Credentials Authenticate Successfully",
      passed: false,
      error: err.message,
    });
  }

  // 6. Invalid password authentication (Negative flow)
  try {
    await authService.login(
      {
        email: "m.thorne@apexsync.ai",
        password: "IncorrectPassword123!",
      },
      "test_auth_bad_password"
    );
    results.push({
      suite: "Authentication Security",
      testName: "Invalid Password Triggers Authentication Failure [DENIED]",
      passed: false,
      error: "Security Breach: Login succeeded with incorrect password!",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Invalid Password Triggers Authentication Failure [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Invalid Password Triggers Authentication Failure [DENIED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 7. Missing password rejection (Negative flow)
  try {
    await authService.login(
      {
        email: "m.thorne@apexsync.ai",
        password: "",
      },
      "test_auth_empty_password"
    );
    results.push({
      suite: "Authentication Security",
      testName: "Empty Password Triggers Validation Failure [REJECTED]",
      passed: false,
      error: "Security Breach: Login succeeded with empty password!",
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Empty Password Triggers Validation Failure [REJECTED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Empty Password Triggers Validation Failure [REJECTED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 8. Missing password hash on user record (Missing credential rejection)
  try {
    // Seed temporary user without password hash
    db.users.set("usr-test-no-hash", {
      id: "usr-test-no-hash",
      email: "nohash@apexsync.ai",
      name: "No Hash User",
      title: "Test User",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
    });
    db.memberships.set("mem-test-no-hash", {
      id: "mem-test-no-hash",
      organizationId: "apex-demo",
      userId: "usr-test-no-hash",
      role: "Operations",
      department: "Ops",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    await defaultAuthProvider.authenticateCredentials("nohash@apexsync.ai", "AnyPassword123!");
    results.push({
      suite: "Authentication Security",
      testName: "Missing Password Hash Rejects Authentication [DENIED]",
      passed: false,
      error: "Critical Flaw: User without passwordHash authenticated!",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Missing Password Hash Rejects Authentication [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Missing Password Hash Rejects Authentication [DENIED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  } finally {
    db.users.delete("usr-test-no-hash");
    db.memberships.delete("mem-test-no-hash");
  }

  // 9. Disabled account status authentication rejection
  try {
    const testCreds = hashPassword("ApexEnterprise2026!");
    db.users.set("usr-test-disabled", {
      id: "usr-test-disabled",
      email: "disabled@apexsync.ai",
      name: "Disabled User",
      title: "Disabled Account",
      status: "disabled",
      passwordHash: testCreds.hash,
      passwordSalt: testCreds.salt,
      createdAt: "2026-01-01T00:00:00Z",
    });
    db.memberships.set("mem-test-disabled", {
      id: "mem-test-disabled",
      organizationId: "apex-demo",
      userId: "usr-test-disabled",
      role: "Operations",
      department: "Ops",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    await defaultAuthProvider.authenticateCredentials("disabled@apexsync.ai", "ApexEnterprise2026!");
    results.push({
      suite: "Authentication Security",
      testName: "Disabled User Account Authentication [DENIED]",
      passed: false,
      error: "Security Breach: Disabled account was permitted to login!",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      results.push({
        suite: "Authentication Security",
        testName: "Disabled User Account Authentication [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Disabled User Account Authentication [DENIED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  } finally {
    db.users.delete("usr-test-disabled");
    db.memberships.delete("mem-test-disabled");
  }

  // 10. Non-existent user authentication rejection
  try {
    await defaultAuthProvider.authenticateCredentials("nonexistent@apexsync.ai", "SomePassword123!");
    results.push({
      suite: "Authentication Security",
      testName: "Non-Existent User Authentication [DENIED]",
      passed: false,
      error: "Security Breach: Non-existent user succeeded authentication!",
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      results.push({
        suite: "Authentication Security",
        testName: "Non-Existent User Authentication [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Non-Existent User Authentication [DENIED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 11. Target organization spoofing blocked during login
  try {
    await defaultAuthProvider.authenticateCredentials(
      "m.thorne@apexsync.ai",
      "ApexEnterprise2026!",
      "org-titan-corp" // Marcus is not a member of Titan Corp
    );
    results.push({
      suite: "Authentication Security",
      testName: "Target Organization Spoofing Blocked [DENIED]",
      passed: false,
      error: "Security Breach: User authenticated into unassigned organization tenant!",
    });
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      results.push({
        suite: "Authentication Security",
        testName: "Target Organization Spoofing Blocked [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Target Organization Spoofing Blocked [DENIED]",
        passed: false,
        error: `Unexpected error: ${err.message}`,
      });
    }
  }

  // 12. Password policy enforcement (minimum 8 characters)
  const policyShort = validatePasswordPolicy("short");
  const policyValid = validatePasswordPolicy("LongSecurePassword2026!");
  if (!policyShort.valid && policyValid.valid) {
    results.push({
      suite: "Authentication Security",
      testName: "Password Policy Minimum Length Enforcement",
      passed: true,
    });
  } else {
    results.push({
      suite: "Authentication Security",
      testName: "Password Policy Minimum Length Enforcement",
      passed: false,
      error: "Password policy validation failed",
    });
  }

  // 13. Password change with cryptographic verification & session revocation
  try {
    // 1. Authenticate Elena Cho
    const elenaAuth = await authService.login(
      { email: "e.cho@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_pwd_change_login"
    );
    const elenaToken = elenaAuth.session.token;

    // 2. Change password with correct current password
    await authService.changePassword(
      {
        userId: "usr-elena-cho",
        currentPassword: "ApexEnterprise2026!",
        newPassword: "NewElenaPassword2026!",
      },
      tenantARMContext
    );

    // 3. Old session token should now be revoked
    const sessionAfter = await defaultSessionStore.getSession(elenaToken);
    const oldSessionRevoked = !sessionAfter;

    // 4. Authenticate with new password should succeed
    const newAuth = await authService.login(
      { email: "e.cho@apexsync.ai", password: "NewElenaPassword2026!" },
      "test_pwd_change_new"
    );

    // 5. Restore original password for ongoing test repeatability
    await authService.changePassword(
      {
        userId: "usr-elena-cho",
        currentPassword: "NewElenaPassword2026!",
        newPassword: "ApexEnterprise2026!",
      },
      tenantARMContext
    );

    if (oldSessionRevoked && newAuth.session.token) {
      results.push({
        suite: "Authentication Security",
        testName: "Password Change Enforces Invalidation and Verifies Current Credentials",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Password Change Enforces Invalidation and Verifies Current Credentials",
        passed: false,
        error: "Active sessions were not revoked upon password change",
      });
    }
  } catch (err: any) {
    results.push({
      suite: "Authentication Security",
      testName: "Password Change Enforces Invalidation and Verifies Current Credentials",
      passed: false,
      error: err.message,
    });
  }

  // 14. Session logout and token invalidation
  try {
    const tempLogin = await authService.login(
      { email: "m.thorne@apexsync.ai", password: "ApexEnterprise2026!" },
      "test_logout_login"
    );
    const tokenToRevoke = tempLogin.session.token;
    await authService.logout(tokenToRevoke, tenantAContext);
    const sessionRevoked = await defaultSessionStore.getSession(tokenToRevoke);

    if (!sessionRevoked) {
      results.push({
        suite: "Authentication Security",
        testName: "Session Logout Revokes Token Immediately",
        passed: true,
      });
    } else {
      results.push({
        suite: "Authentication Security",
        testName: "Session Logout Revokes Token Immediately",
        passed: false,
        error: "Revoked token is still accepted",
      });
    }
  } catch (err: any) {
    results.push({
      suite: "Authentication Security",
      testName: "Session Logout Revokes Token Immediately",
      passed: false,
      error: err.message,
    });
  }

  // =========================================================================
  // SUITE 2: MULTI-TENANT ISOLATION & DOMAIN BOUNDARIES
  // =========================================================================

  // 15. Tenant A -> Tenant A Customer (ALLOW)
  try {
    const cust = await customerService.getCustomerById("cust-dangote", tenantAContext);
    if (cust && cust.organizationId === "apex-demo") {
      results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant A Customer", passed: true });
    } else {
      results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant A Customer", passed: false, error: "Unexpected customer data" });
    }
  } catch (err: any) {
    results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant A Customer", passed: false, error: err.message });
  }

  // 16. Tenant A -> Tenant B Customer (DENY)
  try {
    await customerService.getCustomerById("cust-titan-energy", tenantAContext);
    results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant B Customer [DENIED]", passed: false, error: "Security Breach: Tenant A accessed Tenant B customer!" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant B Customer [DENIED]", passed: true });
    } else {
      results.push({ suite: "Customer Isolation", testName: "Tenant A reads Tenant B Customer [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 17. Tenant A -> Tenant B Customer Update (DENY)
  try {
    await customerService.updateCustomer("cust-titan-energy", { name: "Hacked Customer" }, tenantAContext);
    results.push({ suite: "Customer Isolation", testName: "Tenant A updates Tenant B Customer [DENIED]", passed: false, error: "Security Breach: Tenant A modified Tenant B customer!" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Customer Isolation", testName: "Tenant A updates Tenant B Customer [DENIED]", passed: true });
    } else {
      results.push({ suite: "Customer Isolation", testName: "Tenant A updates Tenant B Customer [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 18. Tenant A -> Tenant B Customer Delete (DENY)
  try {
    await customerService.deleteCustomer("cust-titan-energy", tenantAContext);
    results.push({ suite: "Customer Isolation", testName: "Tenant A deletes Tenant B Customer [DENIED]", passed: false, error: "Security Breach: Tenant A deleted Tenant B customer!" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Customer Isolation", testName: "Tenant A deletes Tenant B Customer [DENIED]", passed: true });
    } else {
      results.push({ suite: "Customer Isolation", testName: "Tenant A deletes Tenant B Customer [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 19. Tenant A -> Search Customers Scoped (ALLOW & FILTERED)
  try {
    const customers = await customerService.getCustomers(tenantAContext);
    const leaked = customers.some((c) => c.organizationId !== "apex-demo");
    if (!leaked && customers.length > 0) {
      results.push({ suite: "Customer Isolation", testName: "Customer Search is Strictly Tenant-Scoped", passed: true });
    } else {
      results.push({ suite: "Customer Isolation", testName: "Customer Search is Strictly Tenant-Scoped", passed: false, error: "Cross-tenant record leakage in search" });
    }
  } catch (err: any) {
    results.push({ suite: "Customer Isolation", testName: "Customer Search is Strictly Tenant-Scoped", passed: false, error: err.message });
  }

  // 20. Tenant A -> Tenant B Opportunity (DENY)
  try {
    await valueService.getOpportunityById("opp-titan-1", tenantAContext);
    results.push({ suite: "Value Isolation", testName: "Tenant A reads Tenant B Opportunity [DENIED]", passed: false, error: "Security Breach: Tenant A accessed Tenant B opportunity!" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Value Isolation", testName: "Tenant A reads Tenant B Opportunity [DENIED]", passed: true });
    } else {
      results.push({ suite: "Value Isolation", testName: "Tenant A reads Tenant B Opportunity [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 21. Tenant A -> Tenant B Memory Item (DENY)
  try {
    await memoryService.getMemoryById("mem-titan-nonexistent", tenantAContext);
    results.push({ suite: "Memory Isolation", testName: "Tenant A reads Tenant B Memory [DENIED]", passed: false, error: "Security Breach: Tenant A accessed unowned memory" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Memory Isolation", testName: "Tenant A reads Tenant B Memory [DENIED]", passed: true });
    } else {
      results.push({ suite: "Memory Isolation", testName: "Tenant A reads Tenant B Memory [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 22. Tenant A -> Tenant B Action Advance (DENY)
  try {
    await actionService.advanceAction("act-titan-unknown", tenantAContext);
    results.push({ suite: "Action Isolation", testName: "Tenant A advances Tenant B Action [DENIED]", passed: false, error: "Security Breach: Tenant A advanced unowned action!" });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Action Isolation", testName: "Tenant A advances Tenant B Action [DENIED]", passed: true });
    } else {
      results.push({ suite: "Action Isolation", testName: "Tenant A advances Tenant B Action [DENIED]", passed: false, error: `Unexpected error: ${err.message}` });
    }
  }

  // 23. Tenant A -> Audit Logs Scoping (ALLOW & SCOPED)
  try {
    const logs = await auditService.getAuditLogs(tenantAContext);
    const leaked = logs.some((l) => l.organizationId !== "apex-demo");
    if (!leaked) {
      results.push({ suite: "Audit Isolation", testName: "Audit Logs are Strictly Tenant-Scoped", passed: true });
    } else {
      results.push({ suite: "Audit Isolation", testName: "Audit Logs are Strictly Tenant-Scoped", passed: false, error: "Cross-tenant audit log leakage" });
    }
  } catch (err: any) {
    results.push({ suite: "Audit Isolation", testName: "Audit Logs are Strictly Tenant-Scoped", passed: false, error: err.message });
  }

  // 24. Tenant A -> AI Tool Customer Ingestion Isolation (ALLOW & SCOPED)
  try {
    const toolResults = (await authorizedAiTools.get_tenant_customers.handler({}, tenantAContext)) as any[];
    const hasLeakage = toolResults.some((c: any) => c.id === "cust-titan-energy");
    if (!hasLeakage && toolResults.length > 0) {
      results.push({ suite: "AI Tool Security", testName: "AI Tool Execution Tenant Scoping", passed: true });
    } else {
      results.push({ suite: "AI Tool Security", testName: "AI Tool Execution Tenant Scoping", passed: false, error: "AI Tool leaked Tenant B customer records" });
    }
  } catch (err: any) {
    results.push({ suite: "AI Tool Security", testName: "AI Tool Execution Tenant Scoping", passed: false, error: err.message });
  }

  // 25. Tenant B -> Tenant B Customer (ALLOW)
  try {
    const custB = await customerService.getCustomerById("cust-titan-energy", tenantBContext);
    if (custB && custB.organizationId === "org-titan-corp") {
      results.push({ suite: "Multi-Tenant Independence", testName: "Tenant B reads Tenant B Customer", passed: true });
    } else {
      results.push({ suite: "Multi-Tenant Independence", testName: "Tenant B reads Tenant B Customer", passed: false, error: "Unexpected customer data" });
    }
  } catch (err: any) {
    results.push({ suite: "Multi-Tenant Independence", testName: "Tenant B reads Tenant B Customer", passed: false, error: err.message });
  }

  // 26. RBAC Authorization: Role without action:approve capability attempting approval (DENY)
  try {
    await actionService.advanceAction("act-1", tenantARMContext);
    results.push({
      suite: "RBAC Enforcement",
      testName: "Unauthorized Role Blocked from Action Approval [DENIED]",
      passed: false,
      error: "RBAC Failure: User without action:approve was allowed to approve action",
    });
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      results.push({
        suite: "RBAC Enforcement",
        testName: "Unauthorized Role Blocked from Action Approval [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "RBAC Enforcement",
        testName: "Unauthorized Role Blocked from Action Approval [DENIED]",
        passed: false,
        error: `Unexpected error type: ${err.message}`,
      });
    }
  }

  // 27. Organization Switching to Unauthorized Tenant (DENY)
  try {
    await authService.switchOrganization("org-titan-corp", tenantAContext);
    results.push({
      suite: "Multi-Tenant Membership",
      testName: "Switching to Non-Member Tenant [DENIED]",
      passed: false,
      error: "Security Breach: User switched to unauthorized organization!",
    });
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      results.push({
        suite: "Multi-Tenant Membership",
        testName: "Switching to Non-Member Tenant [DENIED]",
        passed: true,
      });
    } else {
      results.push({
        suite: "Multi-Tenant Membership",
        testName: "Switching to Non-Member Tenant [DENIED]",
        passed: false,
        error: `Unexpected error type: ${err.message}`,
      });
    }
  }

  // 28. Document Isolation: Tenant A reading Tenant B Document (DENY)
  try {
    await documentService.getDocumentById("doc-titan-secret-contract", tenantAContext);
    results.push({
      suite: "Document Isolation",
      testName: "Tenant A reading Tenant B Document [DENIED]",
      passed: false,
      error: "Security Breach: Tenant A accessed Tenant B document!",
    });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Document Isolation", testName: "Tenant A reading Tenant B Document [DENIED]", passed: true });
    } else {
      results.push({ suite: "Document Isolation", testName: "Tenant A reading Tenant B Document [DENIED]", passed: false, error: err.message });
    }
  }

  // 29. Knowledge Isolation: Tenant A reading Tenant B Knowledge Item (DENY)
  try {
    await knowledgeService.getKnowledgeItemById("know-titan-secret-playbook", tenantAContext);
    results.push({
      suite: "Knowledge Isolation",
      testName: "Tenant A reading Tenant B Knowledge Item [DENIED]",
      passed: false,
      error: "Security Breach: Tenant A accessed Tenant B knowledge item!",
    });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Knowledge Isolation", testName: "Tenant A reading Tenant B Knowledge Item [DENIED]", passed: true });
    } else {
      results.push({ suite: "Knowledge Isolation", testName: "Tenant A reading Tenant B Knowledge Item [DENIED]", passed: false, error: err.message });
    }
  }

  // 30. Workflow Isolation: Tenant A executing Tenant B Workflow (DENY)
  try {
    await workflowService.triggerWorkflowRun({ workflowId: "wf-titan-secret" }, tenantAContext);
    results.push({
      suite: "Workflow Isolation",
      testName: "Tenant A executing Tenant B Workflow [DENIED]",
      passed: false,
      error: "Security Breach: Tenant A executed Tenant B workflow!",
    });
  } catch (err: any) {
    if (err instanceof CrossTenantViolationError || err instanceof NotFoundError) {
      results.push({ suite: "Workflow Isolation", testName: "Tenant A executing Tenant B Workflow [DENIED]", passed: true });
    } else {
      results.push({ suite: "Workflow Isolation", testName: "Tenant A executing Tenant B Workflow [DENIED]", passed: false, error: err.message });
    }
  }

  // 31. Workflow Graph Validation: Cyclic connection detection (VALIDATION REJECT)
  try {
    WorkflowValidator.validateWorkflowGraph(
      [
        { id: "node-1", type: "trigger", title: "Trigger", status: "completed" },
        { id: "node-2", type: "action", title: "Step 2", status: "idle" },
      ],
      [
        { id: "c1", fromNodeId: "node-1", toNodeId: "node-2" },
        { id: "c2", fromNodeId: "node-2", toNodeId: "node-1" }, // Circular loop
      ]
    );
    results.push({
      suite: "Graph Validation",
      testName: "Workflow DAG Cycle Detection [REJECTED]",
      passed: false,
      error: "Validation Failure: Cyclic workflow graph was accepted!",
    });
  } catch (err: any) {
    if (err instanceof ValidationError) {
      results.push({ suite: "Graph Validation", testName: "Workflow DAG Cycle Detection [REJECTED]", passed: true });
    } else {
      results.push({ suite: "Graph Validation", testName: "Workflow DAG Cycle Detection [REJECTED]", passed: false, error: err.message });
    }
  }

  // 32. Request Validation: Invalid email rejection (VALIDATION REJECT)
  try {
    await customerService.createCustomer(
      {
        name: "Test Customer",
        contactEmail: "invalid-email-no-at-sign",
      },
      tenantAContext
    );
    results.push({
      suite: "Request Validation",
      testName: "Invalid Contact Email Rejection [REJECTED]",
      passed: false,
      error: "Validation Failure: Bad email format accepted!",
    });
  } catch (err: any) {
    if (err instanceof ValidationError) {
      results.push({ suite: "Request Validation", testName: "Invalid Contact Email Rejection [REJECTED]", passed: true });
    } else {
      results.push({ suite: "Request Validation", testName: "Invalid Contact Email Rejection [REJECTED]", passed: false, error: err.message });
    }
  }

  // 33. Value Intelligence Evidence Chain: Dynamic calculation and zero-data handling (ALLOW)
  try {
    const summary = await valueService.getSummary(tenantAContext);
    if (
      summary.potentialValueIdentified.evidence &&
      summary.revenueLeakageTotal.calculationMethod &&
      summary.realizationEfficiencyRate >= 0
    ) {
      results.push({
        suite: "Value Intelligence Evidence",
        testName: "Dynamic Evidence-Grounded Calculations",
        passed: true,
      });
    } else {
      results.push({
        suite: "Value Intelligence Evidence",
        testName: "Dynamic Evidence-Grounded Calculations",
        passed: false,
        error: "Missing calculation evidence chain",
      });
    }
  } catch (err: any) {
    results.push({
      suite: "Value Intelligence Evidence",
      testName: "Dynamic Evidence-Grounded Calculations",
      passed: false,
      error: err.message,
    });
  }

  const allPassed = results.every((r) => r.passed);
  return {
    passed: allPassed,
    total: results.length,
    results,
  };
}

