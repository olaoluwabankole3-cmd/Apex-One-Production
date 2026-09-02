/**
 * APEX ONE — Canonical Query Limits, Cursor, Filter & Sort Safety Suite
 *
 * Stage 3 deliberately removes offset pagination from repository contracts.
 * This suite protects the replacement cursor model without reintroducing
 * compatibility aliases for the retired offset/query API.
 */

import { DatabaseStore } from "../database/store";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeLimit,
  normalizeAndValidateOrderBy,
  ENTITY_SORT_WHITELIST,
} from "../database/repository";
import { TenantContext } from "../core/security";
import { ValidationError } from "../core/errors";

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

const tenantA: TenantContext = {
  organizationId: "org-query-a",
  userId: "usr-query-a",
  userEmail: "query-a@test.local",
  userRole: "Administrator",
  permissions: ["*"],
  requestId: "req-query-a",
  timestamp: "2026-09-02T00:00:00.000Z",
};

const tenantB: TenantContext = {
  organizationId: "org-query-b",
  userId: "usr-query-b",
  userEmail: "query-b@test.local",
  userRole: "Administrator",
  permissions: ["*"],
  requestId: "req-query-b",
  timestamp: "2026-09-02T00:00:00.000Z",
};

function makeCustomer(id: string, name: string, tier: string = "Enterprise") {
  return {
    id,
    name,
    industry: "Technology",
    tier,
    arr: 100000,
    healthScore: 80,
    status: "healthy",
    contactName: `${name} Contact`,
    contactEmail: `${id}@query.test`,
  } as any;
}

export async function runQueryLimitsAndSortSafetyTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];
  const suiteName = "Query Limits & Sort/Filter Safety";

  const test = async (name: string, fn: () => Promise<void> | void) => {
    const start = performance.now();
    try {
      await fn();
      results.push({ suite: suiteName, testName: name, passed: true, durationMs: Math.round(performance.now() - start) });
    } catch (error: any) {
      results.push({ suite: suiteName, testName: name, passed: false, error: error?.message || String(error), durationMs: Math.round(performance.now() - start) });
    }
  };

  await test("Centralized pagination constants are strictly configured", () => {
    if (DEFAULT_PAGE_SIZE !== 50 || MAX_PAGE_SIZE !== 100) {
      throw new Error(`Unexpected page constants: ${DEFAULT_PAGE_SIZE}/${MAX_PAGE_SIZE}`);
    }
  });

  await test("normalizeLimit handles undefined and defaults to DEFAULT_PAGE_SIZE", () => {
    if (normalizeLimit(undefined) !== DEFAULT_PAGE_SIZE) throw new Error("undefined limit did not default");
  });

  await test("normalizeLimit caps oversized and positive infinite limits to MAX_PAGE_SIZE", () => {
    if (normalizeLimit(10_000) !== MAX_PAGE_SIZE) throw new Error("oversized limit was not capped");
    if (normalizeLimit(Infinity) !== MAX_PAGE_SIZE) throw new Error("Infinity was not capped");
  });

  await test("normalizeLimit normalizes zero, negative, NaN, and negative Infinity", () => {
    for (const candidate of [0, -10, NaN, -Infinity]) {
      if (normalizeLimit(candidate) !== DEFAULT_PAGE_SIZE) {
        throw new Error(`Invalid limit ${String(candidate)} did not normalize to default`);
      }
    }
  });

  await test("normalizeLimit floors floating point limits", () => {
    if (normalizeLimit(25.9) !== 25) throw new Error("floating limit was not floored");
  });

  await test("Public repository query contract contains cursor and no offset field", () => {
    const source = require("fs").readFileSync(
      require("path").join(process.cwd(), "lib/backend/database/querySpecification.ts"),
      "utf-8"
    );
    const block = source.match(/export interface QuerySpecification[\s\S]*?\{([\s\S]*?)\n\}/)?.[1];
    if (!block) throw new Error("QuerySpecification interface not found");
    if (!source.includes("extends PaginationOptions")) throw new Error("QuerySpecification is not cursor-pagination based");
    if (/\boffset\b/.test(block)) throw new Error("offset remains in the public QuerySpecification contract");
  });

  await test("Sort validation accepts approved fields and preserves direction", () => {
    const order = normalizeAndValidateOrderBy("Customer", { field: "name", direction: "desc" });
    if (String(order[0].field) !== "name" || order[0].direction !== "desc") {
      throw new Error("approved customer sort was not preserved");
    }
    if (!order.some((entry) => String(entry.field) === "id")) {
      throw new Error("deterministic id tie-breaker was not appended");
    }
  });

  await test("Sort validation rejects arbitrary and injection-like fields", () => {
    const malicious = ["__proto__", "passwordHash", "organizationId", "SELECT * FROM users", "constructor"];
    for (const field of malicious) {
      let rejected = false;
      try {
        normalizeAndValidateOrderBy("Customer", { field: field as any, direction: "asc" });
      } catch (error) {
        rejected = error instanceof ValidationError;
      }
      if (!rejected) throw new Error(`Unapproved sort field '${field}' was accepted`);
    }
  });

  await test("Entity sort whitelists expose only approved domain fields", () => {
    const customerFields = ENTITY_SORT_WHITELIST.Customer || [];
    if (!customerFields.includes("name") || !customerFields.includes("id")) {
      throw new Error("Customer sort whitelist is missing canonical fields");
    }
    if (customerFields.includes("organizationId") || customerFields.includes("passwordHash")) {
      throw new Error("Sensitive/internal field leaked into Customer sort whitelist");
    }
  });

  await test("findMany enforces MAX_PAGE_SIZE for unbounded requests", async () => {
    const db = new DatabaseStore();
    for (let i = 0; i < 110; i++) {
      await db.customersRepo.create(makeCustomer(`limit-${i}`, `Limit ${i}`), tenantA);
    }
    const page = await db.customersRepo.findMany(tenantA, { limit: 99999 });
    if (page.items.length !== MAX_PAGE_SIZE || page.count !== MAX_PAGE_SIZE || !page.hasMore) {
      throw new Error("repository did not enforce canonical maximum page size");
    }
  });

  await test("findMany strictly isolates tenant records under structured queries", async () => {
    const db = new DatabaseStore();
    await db.customersRepo.create(makeCustomer("a-1", "Alpha", "Enterprise"), tenantA);
    await db.customersRepo.create(makeCustomer("b-1", "Beta", "Enterprise"), tenantB);

    const aPage = await db.customersRepo.findMany(tenantA, { where: { tier: { eq: "Enterprise" } } });
    const bPage = await db.customersRepo.findMany(tenantB, { where: { tier: { eq: "Enterprise" } } });
    if (aPage.items.some((item) => item.organizationId !== tenantA.organizationId)) throw new Error("Tenant A leakage");
    if (bPage.items.some((item) => item.organizationId !== tenantB.organizationId)) throw new Error("Tenant B leakage");
    if (aPage.items.some((item) => item.id === "b-1") || bPage.items.some((item) => item.id === "a-1")) {
      throw new Error("cross-tenant record appeared in canonical page");
    }
  });

  await test("findMany sorting applies correctly on approved fields ASC and DESC", async () => {
    const db = new DatabaseStore();
    for (const [id, name] of [["c", "Charlie"], ["a", "Alpha"], ["b", "Bravo"]] as const) {
      await db.customersRepo.create(makeCustomer(id, name), tenantA);
    }
    const asc = await db.customersRepo.findMany(tenantA, { orderBy: { field: "name", direction: "asc" } });
    const desc = await db.customersRepo.findMany(tenantA, { orderBy: { field: "name", direction: "desc" } });
    if (asc.items.map((item) => item.name).join(",") !== "Alpha,Bravo,Charlie") throw new Error("ascending order failed");
    if (desc.items.map((item) => item.name).join(",") !== "Charlie,Bravo,Alpha") throw new Error("descending order failed");
  });

  await test("Structured filters preserve domain and tenant invariants", async () => {
    const db = new DatabaseStore();
    await db.customersRepo.create(makeCustomer("customer-a", "Customer A"), tenantA);
    await db.contractsRepo.create({
      id: "contract-active",
      customerId: "customer-a",
      title: "Active Contract",
      contractValue: 1000,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      renewalDaysRemaining: 120,
      status: "active",
      slaCompliance: 100,
      volatilityIndexationClause: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    }, tenantA);
    const contracts = await db.contractsRepo.findMany(tenantA, { where: { status: { eq: "active" } } });
    if (contracts.items.length !== 1 || contracts.items[0].status !== "active") throw new Error("contract filter failed");
    if (contracts.items[0].organizationId !== tenantA.organizationId) throw new Error("contract tenant scope failed");
  });

  await test("Audit repository enforces canonical page bounds and tenant isolation", async () => {
    const db = new DatabaseStore();
    for (let i = 0; i < 110; i++) {
      await db.auditLogsRepo.record({
        organizationId: tenantA.organizationId,
        actorId: tenantA.userId,
        actorEmail: tenantA.userEmail,
        action: "test",
        resource: "Customer",
        resourceId: `audit-${i}`,
        requestId: tenantA.requestId,
        status: "success",
      });
    }
    await db.auditLogsRepo.record({
      organizationId: tenantB.organizationId,
      actorId: tenantB.userId,
      actorEmail: tenantB.userEmail,
      action: "test",
      resource: "Customer",
      resourceId: "audit-b",
      requestId: tenantB.requestId,
      status: "success",
    });

    const page = await db.auditLogsRepo.findMany(tenantA, { limit: 1000 });
    if (page.items.length !== MAX_PAGE_SIZE || page.count !== MAX_PAGE_SIZE || page.totalCount !== 110) {
      throw new Error("audit page bounds are incorrect");
    }
    if (page.items.some((log) => log.organizationId !== tenantA.organizationId)) {
      throw new Error("audit log cross-tenant leakage detected");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { suite: suiteName, total: results.length, passedCount, failedCount, results };
}
