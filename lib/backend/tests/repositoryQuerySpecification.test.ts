/**
 * APEX ONE — Canonical Repository Query Specification & Pagination Suite
 *
 * Stage 3 repository contract invariants:
 * - structured, storage-agnostic query operators
 * - findMany -> PaginatedResult<T>
 * - findOne/count primitives
 * - cursor-only forward pagination
 * - deterministic sorting and tie-breaking
 * - tenant- and sort-safe cursors
 * - concrete repositories preserve the same collection contract
 */

import { DatabaseStore } from "../database/store";
import { TenantContext } from "../core/security";
import { ValidationError } from "../core/errors";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSummary {
  suite: string;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

const tenantA: TenantContext = {
  organizationId: "org-alpha",
  userId: "user-alpha-1",
  userEmail: "alpha@apex.corp",
  roles: ["org_admin"],
  permissions: ["*"],
  requestId: "req-test-alpha",
};

const tenantB: TenantContext = {
  organizationId: "org-beta",
  userId: "user-beta-1",
  userEmail: "beta@apex.corp",
  roles: ["org_admin"],
  permissions: ["*"],
  requestId: "req-test-beta",
};

function customer(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Customer ${id}`,
    industry: "Technology",
    tier: "Standard",
    arr: 100_000,
    healthScore: 80,
    status: "healthy",
    contactName: `Contact ${id}`,
    contactEmail: `${id}@test.com`,
    ...overrides,
  } as any;
}

async function seedCustomers(
  db: DatabaseStore,
  count: number,
  prefix: string,
  ctx: TenantContext = tenantA
) {
  for (let i = 1; i <= count; i++) {
    await db.customersRepo.create(
      customer(`${prefix}-${String(i).padStart(3, "0")}`, {
        name: `${prefix} Customer ${i}`,
        arr: i * 1000,
        contactEmail: `${prefix}${i}@test.com`,
      }),
      ctx
    );
  }
}

export async function runRepositoryQuerySpecificationTestSuite(): Promise<TestSummary> {
  const suite = "Repository Query Specification & Pagination Suite";
  const results: TestResult[] = [];

  const test = async (name: string, fn: (db: DatabaseStore) => Promise<void>) => {
    const start = performance.now();
    const db = new DatabaseStore();
    try {
      await fn(db);
      results.push({
        suite,
        testName: name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (error: any) {
      results.push({
        suite,
        testName: name,
        passed: false,
        error: error?.message || String(error),
        durationMs: Math.round(performance.now() - start),
      });
    }
  };

  await test("QuerySpec: eq, neq, gt, gte, lt, lte operators", async (db) => {
    await db.customersRepo.create(customer("cust-1", { tier: "Enterprise", arr: 150000, healthScore: 85 }), tenantA);
    await db.customersRepo.create(customer("cust-2", { tier: "Growth", arr: 50000, healthScore: 60, status: "at-risk" }), tenantA);

    const eq = await db.customersRepo.findMany(tenantA, { where: { tier: { eq: "Enterprise" } } });
    const neq = await db.customersRepo.findMany(tenantA, { where: { tier: { neq: "Enterprise" } } });
    const gt = await db.customersRepo.findMany(tenantA, { where: { arr: { gt: 100000 } } });
    const gte = await db.customersRepo.findMany(tenantA, { where: { healthScore: { gte: 85 } } });
    const lt = await db.customersRepo.findMany(tenantA, { where: { arr: { lt: 100000 } } });
    const lte = await db.customersRepo.findMany(tenantA, { where: { healthScore: { lte: 60 } } });

    if (eq.items[0]?.id !== "cust-1") throw new Error("eq failed");
    if (neq.items[0]?.id !== "cust-2") throw new Error("neq failed");
    if (gt.items[0]?.id !== "cust-1") throw new Error("gt failed");
    if (gte.items[0]?.id !== "cust-1") throw new Error("gte failed");
    if (lt.items[0]?.id !== "cust-2") throw new Error("lt failed");
    if (lte.items[0]?.id !== "cust-2") throw new Error("lte failed");
  });

  await test("QuerySpec: in and nin operators", async (db) => {
    await db.customersRepo.create(customer("cust-1", { tier: "Enterprise" }), tenantA);
    await db.customersRepo.create(customer("cust-2", { tier: "Growth" }), tenantA);

    const included = await db.customersRepo.findMany(tenantA, { where: { tier: { in: ["Growth", "Startup"] } } });
    const excluded = await db.customersRepo.findMany(tenantA, { where: { tier: { nin: ["Growth", "Startup"] } } });
    if (included.items.length !== 1 || included.items[0].id !== "cust-2") throw new Error("in failed");
    if (excluded.items.length !== 1 || excluded.items[0].id !== "cust-1") throw new Error("nin failed");
  });

  await test("QuerySpec: string matching operators (contains, startsWith, endsWith, ilike)", async (db) => {
    await db.customersRepo.create(customer("cust-1", {
      name: "Acme Industrial Logistics",
      contactEmail: "john.doe@acme-corp.com",
    }), tenantA);

    const contains = await db.customersRepo.findMany(tenantA, { where: { name: { contains: "industrial" } } });
    const starts = await db.customersRepo.findMany(tenantA, { where: { name: { startsWith: "Acme" } } });
    const ends = await db.customersRepo.findMany(tenantA, { where: { contactEmail: { endsWith: ".com" } } });
    const ilike = await db.customersRepo.findMany(tenantA, { where: { name: { ilike: "ACME INDUSTRIAL LOGISTICS" } } });
    if ([contains, starts, ends, ilike].some((page) => page.items.length !== 1)) {
      throw new Error("one or more string operators failed");
    }
  });

  await test("QuerySpec: compound logical operations (AND, OR, NOT)", async (db) => {
    await db.customersRepo.create(customer("cust-1", { industry: "Logistics", tier: "Enterprise", arr: 200000 }), tenantA);
    await db.customersRepo.create(customer("cust-2", { industry: "Logistics", tier: "Growth", arr: 80000, status: "at-risk" }), tenantA);
    await db.customersRepo.create(customer("cust-3", { industry: "Finance", tier: "Enterprise", arr: 500000 }), tenantA);

    const andPage = await db.customersRepo.findMany(tenantA, {
      where: { AND: [{ industry: { eq: "Logistics" } }, { tier: { eq: "Enterprise" } }] },
    });
    const orPage = await db.customersRepo.findMany(tenantA, {
      where: { OR: [{ status: { eq: "at-risk" } }, { arr: { gt: 400000 } }] },
    });
    const notPage = await db.customersRepo.findMany(tenantA, {
      where: { NOT: { industry: { eq: "Logistics" } } },
    });
    if (andPage.items.length !== 1 || andPage.items[0].id !== "cust-1") throw new Error("AND failed");
    if (orPage.items.length !== 2) throw new Error("OR failed");
    if (notPage.items.length !== 1 || notPage.items[0].id !== "cust-3") throw new Error("NOT failed");
  });

  await test("QuerySpec: array operators on tags", async (db) => {
    await db.documentsRepo.create({
      id: "doc-1", name: "Q4 Financials", category: "financial", fileType: "pdf", fileSize: 1024,
      storageUri: "uri://1", tags: ["finance", "quarterly", "confidential"], status: "indexed",
      uploadedBy: "user-1", uploadedAt: "2026-01-01",
    }, tenantA);
    await db.documentsRepo.create({
      id: "doc-2", name: "Engineering Roadmap", category: "technical", fileType: "pdf", fileSize: 2048,
      storageUri: "uri://2", tags: ["engineering", "roadmap"], status: "indexed",
      uploadedBy: "user-1", uploadedAt: "2026-01-01",
    }, tenantA);

    const contains = await db.documentsRepo.findMany(tenantA, { where: { tags: { arrayContains: "confidential" } } });
    const any = await db.documentsRepo.findMany(tenantA, { where: { tags: { arrayContainsAny: ["roadmap", "missing"] } } });
    if (contains.items[0]?.id !== "doc-1") throw new Error("arrayContains failed");
    if (any.items[0]?.id !== "doc-2") throw new Error("arrayContainsAny failed");
  });

  await test("QuerySpec: findOne and count repository methods", async (db) => {
    await db.customersRepo.create(customer("cust-1", { contactEmail: "one@test.com" }), tenantA);
    await db.customersRepo.create(customer("cust-2", { contactEmail: "two@test.com", status: "at-risk" }), tenantA);
    const one = await db.customersRepo.findOne(tenantA, { where: { contactEmail: { eq: "two@test.com" } } });
    const total = await db.customersRepo.count(tenantA);
    const filtered = await db.customersRepo.count(tenantA, { where: { status: { eq: "at-risk" } } });
    if (one?.id !== "cust-2" || total !== 2 || filtered !== 1) throw new Error("findOne/count contract failed");
  });

  await test("Pagination: Default page size of 50 is applied when limit is omitted", async (db) => {
    await seedCustomers(db, 60, "default");
    const page = await db.customersRepo.findMany(tenantA);
    if (page.items.length !== 50 || page.count !== 50 || !page.hasMore || !page.nextCursor || page.totalCount !== 60) {
      throw new Error("default page contract failed");
    }
  });

  await test("Pagination: Max page size of 100 is enforced when limit exceeds 100", async (db) => {
    await seedCustomers(db, 110, "max");
    const page = await db.customersRepo.findMany(tenantA, { limit: 500 });
    if (page.items.length !== 100 || !page.hasMore || !page.nextCursor || page.totalCount !== 110) {
      throw new Error("max page clamp failed");
    }
  });

  await test("Pagination: Invalid limit values safely normalize to bounded limits", async (db) => {
    await seedCustomers(db, 110, "invalid");
    const zero = await db.customersRepo.findMany(tenantA, { limit: 0 });
    const negative = await db.customersRepo.findMany(tenantA, { limit: -10 });
    const nan = await db.customersRepo.findMany(tenantA, { limit: NaN as any });
    const infinity = await db.customersRepo.findMany(tenantA, { limit: Infinity as any });
    if (zero.items.length !== 50 || negative.items.length !== 50 || nan.items.length !== 50 || infinity.items.length !== 100) {
      throw new Error("invalid limit normalization failed");
    }
  });

  await test("Pagination: Multi-page cursor traversal has no missing or duplicate records", async (db) => {
    await seedCustomers(db, 25, "page");
    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await db.customersRepo.findMany(tenantA, {
        limit: 10,
        cursor,
        orderBy: { field: "arr", direction: "asc" },
      });
      pages++;
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      if (!page.hasMore) break;
    } while (cursor && pages < 10);

    if (pages !== 3 || ids.length !== 25 || new Set(ids).size !== 25) {
      throw new Error("cursor traversal lost or duplicated records");
    }
  });

  await test("Pagination: Deterministic tie-breaking on identical sort values", async (db) => {
    for (let i = 1; i <= 5; i++) {
      await db.customersRepo.create(customer(`cust-tie-${i}`, { arr: 100000 }), tenantA);
    }
    const p1 = await db.customersRepo.findMany(tenantA, { limit: 2, orderBy: { field: "arr", direction: "asc" } });
    if (!p1.nextCursor) throw new Error("first cursor missing");
    const p2 = await db.customersRepo.findMany(tenantA, { limit: 2, cursor: p1.nextCursor, orderBy: { field: "arr", direction: "asc" } });
    if (!p2.nextCursor) throw new Error("second cursor missing");
    const p3 = await db.customersRepo.findMany(tenantA, { limit: 2, cursor: p2.nextCursor, orderBy: { field: "arr", direction: "asc" } });
    const ids = [...p1.items, ...p2.items, ...p3.items].map((item) => item.id);
    if (ids.length !== 5 || new Set(ids).size !== 5 || p3.hasMore || p3.nextCursor !== null) {
      throw new Error("deterministic tie-breaker contract failed");
    }
  });

  await test("Pagination: Empty collection returns canonical empty PaginatedResult", async (db) => {
    const page = await db.customersRepo.findMany(tenantA);
    if (page.items.length !== 0 || page.count !== 0 || page.totalCount !== 0 || page.hasMore || page.nextCursor !== null) {
      throw new Error("empty page is not canonical");
    }
  });

  await test("Pagination: Exact page boundary yields hasMore=false and nextCursor=null", async (db) => {
    await seedCustomers(db, 5, "exact");
    const page = await db.customersRepo.findMany(tenantA, { limit: 5 });
    if (page.items.length !== 5 || page.hasMore || page.nextCursor !== null || page.totalCount !== 5) {
      throw new Error("exact-boundary page contract failed");
    }
  });

  await test("Pagination: Limit + 1 yields a final page with nextCursor=null", async (db) => {
    await seedCustomers(db, 6, "boundary");
    const p1 = await db.customersRepo.findMany(tenantA, { limit: 5 });
    if (!p1.hasMore || !p1.nextCursor || p1.items.length !== 5) throw new Error("first boundary page failed");
    const p2 = await db.customersRepo.findMany(tenantA, { limit: 5, cursor: p1.nextCursor });
    if (p2.items.length !== 1 || p2.hasMore || p2.nextCursor !== null) throw new Error("final boundary page failed");
  });

  await test("Pagination: Sort field whitelist rejects arbitrary/injection-like fields", async (db) => {
    await db.customersRepo.create(customer("sort-1"), tenantA);
    let rejected = false;
    try {
      await db.customersRepo.findMany(tenantA, {
        orderBy: { field: "invalid_column; DROP TABLE customers;--" as any, direction: "asc" },
      });
    } catch (error) {
      rejected = error instanceof ValidationError;
    }
    if (!rejected) throw new Error("unapproved sort field was accepted");
  });

  await test("Pagination: Tampered or malformed cursors are rejected", async (db) => {
    await db.customersRepo.create(customer("tamper-1"), tenantA);
    const candidates = [
      "not_a_valid_base64_cursor!!!",
      Buffer.from("this is plain text not json").toString("base64url"),
    ];
    for (const cursor of candidates) {
      let rejected = false;
      try {
        await db.customersRepo.findMany(tenantA, { cursor });
      } catch (error) {
        rejected = error instanceof ValidationError;
      }
      if (!rejected) throw new Error("malformed cursor was accepted");
    }
  });

  await test("Pagination: Cursor issued for Tenant A cannot be used by Tenant B", async (db) => {
    await seedCustomers(db, 2, "tenant-a", tenantA);
    await seedCustomers(db, 2, "tenant-b", tenantB);
    const pageA = await db.customersRepo.findMany(tenantA, { limit: 1 });
    if (!pageA.nextCursor) throw new Error("Tenant A cursor missing");
    let rejected = false;
    try {
      await db.customersRepo.findMany(tenantB, { limit: 1, cursor: pageA.nextCursor });
    } catch (error) {
      rejected = error instanceof ValidationError;
    }
    if (!rejected) throw new Error("cross-tenant cursor was accepted");
  });

  await test("QuerySpec: Concrete domain repository query methods preserve pagination", async (db) => {
    await db.customersRepo.create(customer("cust-risk", {
      tier: "Enterprise",
      status: "at-risk",
      contactEmail: "lead@risk.com",
    }), tenantA);

    const byEmail = await db.customersRepo.findByEmail("lead@risk.com", tenantA);
    const atRisk = await db.customersRepo.findAtRisk(tenantA);
    if (byEmail?.id !== "cust-risk" || atRisk.items[0]?.id !== "cust-risk") {
      throw new Error("customer convenience queries failed");
    }

    await db.contractsRepo.create({
      id: "contract-1",
      customerId: "cust-risk",
      title: "Master Services Agreement",
      contractValue: 100000,
      annualRecurringRevenue: 100000,
      currency: "USD",
      startDate: "2025-01-01",
      endDate: "2026-03-31",
      renewalDaysRemaining: 15,
      status: "active",
      billingCadence: "annual",
      slaCompliance: 99.9,
      volatilityIndexationClause: false,
    }, tenantA);
    const expiring = await db.contractsRepo.findExpiringSoon(30, tenantA);
    if (expiring.items[0]?.id !== "contract-1") throw new Error("contract convenience query failed");

    await db.knowledgeRepo.create({
      id: "knowledge-1",
      title: "Security Guidelines",
      content: "Use tenant isolation and encryption.",
      category: "policy",
      tags: ["security"],
      confidenceScore: 0.98,
      verifiedBy: "user-1",
      verifiedAt: "2026-01-01",
    }, tenantA);
    const knowledge = await db.knowledgeRepo.searchContent("encryption", tenantA);
    if (knowledge.items[0]?.id !== "knowledge-1") throw new Error("knowledge convenience query failed");
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { suite, total: results.length, passedCount, failedCount, results };
}
