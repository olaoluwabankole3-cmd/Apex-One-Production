/**
 * APEX ONE — Query Limits, Filter Safety, and Sort Whitelist Verification Test Suite
 * 
 * Verifies:
 * 1. Centralized pagination limits (DEFAULT_PAGE_SIZE = 50, MAX_PAGE_SIZE = 200).
 * 2. Normalization of invalid, negative, zero, NaN, float, and oversized limits.
 * 3. Normalization of negative, NaN, and non-integer offsets.
 * 4. Whitelist enforcement for sorting across all domain repositories (preventing arbitrary injection).
 * 5. Strict tenant isolation preservation during structured queries and filtering.
 */

import { db } from "../database/store";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeQueryLimit,
  normalizeQueryOffset,
  validateSortOptions,
  CUSTOMER_SORT_FIELDS,
  CONTRACT_SORT_FIELDS,
  TRANSACTION_SORT_FIELDS,
  SIGNAL_SORT_FIELDS,
  VALUE_OPPORTUNITY_SORT_FIELDS,
} from "../database/repository";
import { TenantContext } from "../core/security";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSuiteSummary {
  suite: string;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

export async function runQueryLimitsAndSortSafetyTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Query Limits & Sort/Filter Safety";

  async function test(name: string, fn: () => Promise<void> | void) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: suiteName,
        testName: name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        suite: suiteName,
        testName: name,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  const tenantA: TenantContext = {
    organizationId: "org-acme",
    userId: "usr-acme-admin",
    userEmail: "admin@acme.corp",
    userRole: "admin",
    permissions: ["*"],
    requestId: "req-query-test-1",
  };

  const tenantB: TenantContext = {
    organizationId: "org-globex",
    userId: "usr-globex-admin",
    userEmail: "admin@globex.corp",
    userRole: "admin",
    permissions: ["*"],
    requestId: "req-query-test-2",
  };

  // --------------------------------------------------------------------------
  // 1. Centralized Query Limits & Normalization
  // --------------------------------------------------------------------------

  await test("Centralized pagination constants are strictly configured", () => {
    if (DEFAULT_PAGE_SIZE !== 50) {
      throw new Error(`Expected DEFAULT_PAGE_SIZE to be 50, got ${DEFAULT_PAGE_SIZE}`);
    }
    if (MAX_PAGE_SIZE !== 100) {
      throw new Error(`Expected MAX_PAGE_SIZE to be 100, got ${MAX_PAGE_SIZE}`);
    }
  });

  await test("normalizeQueryLimit handles undefined and defaults to DEFAULT_PAGE_SIZE", () => {
    const limit = normalizeQueryLimit(undefined);
    if (limit !== DEFAULT_PAGE_SIZE) {
      throw new Error(`Expected undefined limit to normalize to ${DEFAULT_PAGE_SIZE}, got ${limit}`);
    }
  });

  await test("normalizeQueryLimit caps unbounded/oversized limits to MAX_PAGE_SIZE", () => {
    if (normalizeQueryLimit(10000) !== MAX_PAGE_SIZE) {
      throw new Error(`Expected 10000 to be capped at ${MAX_PAGE_SIZE}`);
    }
    if (normalizeQueryLimit(201) !== MAX_PAGE_SIZE) {
      throw new Error(`Expected 201 to be capped at ${MAX_PAGE_SIZE}`);
    }
  });

  await test("normalizeQueryLimit normalizes non-positive, zero, NaN, and Infinity limits", () => {
    if (normalizeQueryLimit(0) !== DEFAULT_PAGE_SIZE) {
      throw new Error("Expected limit 0 to normalize to DEFAULT_PAGE_SIZE");
    }
    if (normalizeQueryLimit(-10) !== DEFAULT_PAGE_SIZE) {
      throw new Error("Expected limit -10 to normalize to DEFAULT_PAGE_SIZE");
    }
    if (normalizeQueryLimit(NaN) !== DEFAULT_PAGE_SIZE) {
      throw new Error("Expected limit NaN to normalize to DEFAULT_PAGE_SIZE");
    }
    if (normalizeQueryLimit(Infinity) !== MAX_PAGE_SIZE) {
      throw new Error("Expected limit Infinity to normalize to MAX_PAGE_SIZE");
    }
    if (normalizeQueryLimit(-Infinity) !== DEFAULT_PAGE_SIZE) {
      throw new Error("Expected limit -Infinity to normalize to DEFAULT_PAGE_SIZE");
    }
    if (normalizeQueryLimit("500" as any) !== MAX_PAGE_SIZE) {
      throw new Error("Expected string '500' to be parsed and capped at MAX_PAGE_SIZE");
    }
  });

  await test("normalizeQueryLimit floors floating point limits into integers", () => {
    const limit = normalizeQueryLimit(25.9);
    if (limit !== 25) {
      throw new Error(`Expected 25.9 to be floored to 25, got ${limit}`);
    }
  });

  await test("normalizeQueryOffset normalizes negative, float, and invalid offsets", () => {
    if (normalizeQueryOffset(undefined) !== 0) {
      throw new Error("Expected undefined offset to normalize to 0");
    }
    if (normalizeQueryOffset(-10) !== 0) {
      throw new Error("Expected negative offset -10 to normalize to 0");
    }
    if (normalizeQueryOffset(NaN) !== 0) {
      throw new Error("Expected NaN offset to normalize to 0");
    }
    if (normalizeQueryOffset(14.8) !== 14) {
      throw new Error("Expected float offset 14.8 to be floored to 14");
    }
  });

  // --------------------------------------------------------------------------
  // 2. Sort Whitelist Validation
  // --------------------------------------------------------------------------

  await test("validateSortOptions accepts valid whitelisted sort fields and directions", () => {
    const validSort = validateSortOptions(
      { field: "name", direction: "desc" },
      CUSTOMER_SORT_FIELDS
    );
    if (!validSort || validSort.field !== "name" || validSort.direction !== "desc") {
      throw new Error("Expected valid customer sort to pass validation");
    }
  });

  await test("validateSortOptions rejects arbitrary / malicious sort fields", () => {
    const maliciousSorts = [
      { field: "__proto__", direction: "asc" },
      { field: "passwordHash", direction: "asc" },
      { field: "organizationId", direction: "asc" },
      { field: "SELECT * FROM users", direction: "asc" },
      { field: "constructor", direction: "asc" },
    ];

    for (const badSort of maliciousSorts) {
      const result = validateSortOptions(badSort as any, CUSTOMER_SORT_FIELDS);
      if (result !== undefined) {
        throw new Error(`Expected malicious sort field '${badSort.field}' to be rejected, but got ${JSON.stringify(result)}`);
      }
    }
  });

  await test("validateSortOptions normalizes case-insensitive direction and defaults invalid direction to 'asc'", () => {
    const sort = validateSortOptions({ field: "arr", direction: "DESC" as any }, CUSTOMER_SORT_FIELDS);
    if (!sort || sort.direction !== "desc") {
      throw new Error("Expected 'DESC' to normalize to 'desc'");
    }

    const sortInvalidDir = validateSortOptions({ field: "arr", direction: "invalid" as any }, CUSTOMER_SORT_FIELDS);
    if (!sortInvalidDir || sortInvalidDir.direction !== "asc") {
      throw new Error("Expected invalid direction to default to 'asc'");
    }
  });

  // --------------------------------------------------------------------------
  // 3. Repository Query Execution & Tenant Isolation
  // --------------------------------------------------------------------------

  await test("findMany enforces MAX_PAGE_SIZE even if caller requests an unbounded limit", async () => {
    const customers = await db.customersRepo.findMany(tenantA, { limit: 99999 });
    if (customers.length > MAX_PAGE_SIZE) {
      throw new Error(`Query returned ${customers.length} records, exceeding MAX_PAGE_SIZE of ${MAX_PAGE_SIZE}`);
    }
  });

  await test("findMany strictly isolates records to authenticated tenant under structured queries", async () => {
    const acmeCustomers = await db.customersRepo.findMany(tenantA, {
      filter: { tier: "Enterprise" },
      sort: { field: "name", direction: "asc" },
      limit: 10,
    });

    for (const c of acmeCustomers) {
      if (c.organizationId !== tenantA.organizationId) {
        throw new Error(`Cross-tenant data leakage detected: customer ${c.id} belongs to ${c.organizationId}`);
      }
    }

    const globexCustomers = await db.customersRepo.findMany(tenantB, {
      filter: { tier: "Enterprise" },
      sort: { field: "name", direction: "asc" },
      limit: 10,
    });

    for (const c of globexCustomers) {
      if (c.organizationId !== tenantB.organizationId) {
        throw new Error(`Cross-tenant data leakage detected: customer ${c.id} belongs to ${c.organizationId}`);
      }
    }
  });

  await test("findMany sorting applies correctly on whitelisted fields (ASC / DESC)", async () => {
    const ascCustomers = await db.customersRepo.findMany(tenantA, {
      sort: { field: "name", direction: "asc" },
      limit: 50,
    });

    for (let i = 0; i < ascCustomers.length - 1; i++) {
      if (ascCustomers[i].name.localeCompare(ascCustomers[i + 1].name) > 0) {
        throw new Error(`Expected ascending name order, but '${ascCustomers[i].name}' came before '${ascCustomers[i + 1].name}'`);
      }
    }

    const descCustomers = await db.customersRepo.findMany(tenantA, {
      sort: { field: "name", direction: "desc" },
      limit: 50,
    });

    for (let i = 0; i < descCustomers.length - 1; i++) {
      if (descCustomers[i].name.localeCompare(descCustomers[i + 1].name) < 0) {
        throw new Error(`Expected descending name order, but '${descCustomers[i].name}' came before '${descCustomers[i + 1].name}'`);
      }
    }
  });

  await test("findMany structured filters filter correctly across domain entities", async () => {
    // Contracts
    const activeContracts = await db.contractsRepo.findMany(tenantA, {
      filter: { status: "active" },
    });
    for (const c of activeContracts) {
      if (c.status !== "active") {
        throw new Error(`Expected contract status 'active', got '${c.status}'`);
      }
      if (c.organizationId !== tenantA.organizationId) {
        throw new Error("Tenant isolation breached in contract filter");
      }
    }

    // Transactions
    const revenueTransactions = await db.transactionsRepo.findMany(tenantA, {
      filter: { type: "revenue" },
    });
    for (const t of revenueTransactions) {
      if (t.type !== "revenue") {
        throw new Error(`Expected transaction type 'revenue', got '${t.type}'`);
      }
      if (t.organizationId !== tenantA.organizationId) {
        throw new Error("Tenant isolation breached in transaction filter");
      }
    }

    // Signals
    const activeSignals = await db.signalsRepo.findMany(tenantA, {
      filter: { status: "active" },
    });
    for (const s of activeSignals) {
      if (s.status !== "active") {
        throw new Error(`Expected signal status 'active', got '${s.status}'`);
      }
    }
  });

  await test("Audit log repository enforces limit bounds and structured filtering", async () => {
    const logs = await db.auditLogsRepo.findMany(tenantA, {
      limit: 1000, // Should be capped at MAX_PAGE_SIZE
    });

    if (logs.length > MAX_PAGE_SIZE) {
      throw new Error(`Audit log query returned ${logs.length} entries, exceeding MAX_PAGE_SIZE (${MAX_PAGE_SIZE})`);
    }

    for (const log of logs) {
      if (log.organizationId !== tenantA.organizationId) {
        throw new Error(`Audit log cross-tenant leakage: log ${log.id} belongs to ${log.organizationId}`);
      }
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    suite: suiteName,
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
