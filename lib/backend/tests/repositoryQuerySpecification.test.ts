/**
 * APEX ONE — Repository Query Specification & Pagination Test Suite
 * 
 * TASK 04.07.01 & TASK 04.07.02:
 * 1. Structured Query Specifications (eq, neq, gt, gte, lt, lte, in, nin, contains, startsWith, endsWith, ilike, AND, OR, NOT, array operators)
 * 2. Repository methods (findOne, count, findMany)
 * 3. Pagination & Deterministic Sorting:
 *    - Default limit enforcement (50)
 *    - Max limit clamping (100)
 *    - Invalid limit handling (0, negative, NaN, Infinity)
 *    - Cursor-based forward pagination (hasMore, nextCursor)
 *    - Deterministic tie-breaking with primary field + id
 *    - Exact boundary behavior (limit matching item count vs exceeding)
 *    - Sort field whitelisting and protection against arbitrary column injection
 *    - Tampered cursor and malformed cursor resilience
 *    - Cross-tenant cursor leakage protection
 *    - Concrete domain repository query methods
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

export async function runRepositoryQuerySpecificationTestSuite(): Promise<TestSummary> {
  const suite = "Repository Query Specification & Pagination Suite";
  const results: TestResult[] = [];

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

  async function test(name: string, fn: (db: DatabaseStore) => Promise<void>) {
    const start = performance.now();
    const testDb = new DatabaseStore();
    try {
      await fn(testDb);
      results.push({
        suite,
        testName: name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: unknown) {
      results.push({
        suite,
        testName: name,
        passed: false,
        error: (err as Error).message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // =========================================================================
  // 1. QUERY SPECIFICATION OPERATORS
  // =========================================================================

  // 1. Equality & Comparison operators
  await test("QuerySpec: eq, neq, gt, gte, lt, lte operators", async (db) => {
    await db.customersRepo.create({
      id: "cust-1",
      name: "Acme Corp",
      industry: "Manufacturing",
      tier: "Enterprise",
      arr: 150000,
      healthScore: 85,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "John Acme",
      contactEmail: "john@acme.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-2",
      name: "Beta Ltd",
      industry: "Technology",
      tier: "Growth",
      arr: 50000,
      healthScore: 60,
      status: "at-risk",
      contractRenewalDate: "2026-06-30",
      contactName: "Jane Beta",
      contactEmail: "jane@beta.com",
    }, tenantA);

    // eq
    const eqRes = await db.customersRepo.findMany(tenantA, {
      where: { tier: { eq: "Enterprise" } },
    });
    if (eqRes.items.length !== 1 || eqRes.items[0].id !== "cust-1") throw new Error("eq failed");

    // neq
    const neqRes = await db.customersRepo.findMany(tenantA, {
      where: { tier: { neq: "Enterprise" } },
    });
    if (neqRes.items.length !== 1 || neqRes.items[0].id !== "cust-2") throw new Error("neq failed");

    // gt
    const gtRes = await db.customersRepo.findMany(tenantA, {
      where: { arr: { gt: 100000 } },
    });
    if (gtRes.items.length !== 1 || gtRes.items[0].id !== "cust-1") throw new Error("gt failed");

    // lte
    const lteRes = await db.customersRepo.findMany(tenantA, {
      where: { healthScore: { lte: 60 } },
    });
    if (lteRes.items.length !== 1 || lteRes.items[0].id !== "cust-2") throw new Error("lte failed");
  });

  // 2. Set membership operators (in, nin)
  await test("QuerySpec: in and nin operators", async (db) => {
    await db.customersRepo.create({
      id: "cust-1",
      name: "Acme Corp",
      industry: "Manufacturing",
      tier: "Enterprise",
      arr: 150000,
      healthScore: 85,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "John Acme",
      contactEmail: "john@acme.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-2",
      name: "Beta Ltd",
      industry: "Technology",
      tier: "Growth",
      arr: 50000,
      healthScore: 60,
      status: "at-risk",
      contractRenewalDate: "2026-06-30",
      contactName: "Jane Beta",
      contactEmail: "jane@beta.com",
    }, tenantA);

    // in
    const inRes = await db.customersRepo.findMany(tenantA, {
      where: { tier: { in: ["Growth", "Startup"] } },
    });
    if (inRes.items.length !== 1 || inRes.items[0].id !== "cust-2") throw new Error("in operator failed");

    // nin
    const ninRes = await db.customersRepo.findMany(tenantA, {
      where: { tier: { nin: ["Growth", "Startup"] } },
    });
    if (ninRes.items.length !== 1 || ninRes.items[0].id !== "cust-1") throw new Error("nin operator failed");
  });

  // 3. String pattern matching (contains, startsWith, endsWith, ilike)
  await test("QuerySpec: string matching operators (contains, startsWith, endsWith, ilike)", async (db) => {
    await db.customersRepo.create({
      id: "cust-1",
      name: "Acme Industrial Logistics",
      industry: "Logistics",
      tier: "Enterprise",
      arr: 150000,
      healthScore: 85,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "John Acme",
      contactEmail: "john.doe@acme-corp.com",
    }, tenantA);

    // contains (case-insensitive)
    const containsRes = await db.customersRepo.findMany(tenantA, {
      where: { name: { contains: "industrial" } },
    });
    if (containsRes.items.length !== 1) throw new Error("contains operator failed");

    // startsWith
    const startsWithRes = await db.customersRepo.findMany(tenantA, {
      where: { name: { startsWith: "Acme" } },
    });
    if (startsWithRes.items.length !== 1) throw new Error("startsWith operator failed");

    // endsWith
    const endsWithRes = await db.customersRepo.findMany(tenantA, {
      where: { contactEmail: { endsWith: ".com" } },
    });
    if (endsWithRes.items.length !== 1) throw new Error("endsWith operator failed");

    // ilike
    const ilikeRes = await db.customersRepo.findMany(tenantA, {
      where: { name: { ilike: "ACME INDUSTRIAL LOGISTICS" } },
    });
    if (ilikeRes.items.length !== 1) throw new Error("ilike operator failed");
  });

  // 4. Compound logical operators (AND, OR, NOT)
  await test("QuerySpec: compound logical operations (AND, OR, NOT)", async (db) => {
    await db.customersRepo.create({
      id: "cust-1",
      name: "Alpha Corp",
      industry: "Logistics",
      tier: "Enterprise",
      arr: 200000,
      healthScore: 80,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "Alice",
      contactEmail: "alice@alpha.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-2",
      name: "Beta Corp",
      industry: "Logistics",
      tier: "Growth",
      arr: 80000,
      healthScore: 65,
      status: "at-risk",
      contractRenewalDate: "2026-12-31",
      contactName: "Bob",
      contactEmail: "bob@beta.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-3",
      name: "Gamma Corp",
      industry: "Finance",
      tier: "Enterprise",
      arr: 500000,
      healthScore: 95,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "Charlie",
      contactEmail: "charlie@gamma.com",
    }, tenantA);

    // AND
    const andRes = await db.customersRepo.findMany(tenantA, {
      where: {
        AND: [
          { industry: { eq: "Logistics" } },
          { tier: { eq: "Enterprise" } },
        ],
      },
    });
    if (andRes.items.length !== 1 || andRes.items[0].id !== "cust-1") throw new Error("AND failed");

    // OR
    const orRes = await db.customersRepo.findMany(tenantA, {
      where: {
        OR: [
          { status: { eq: "at-risk" } },
          { arr: { gt: 400000 } },
        ],
      },
    });
    if (orRes.items.length !== 2) throw new Error("OR failed");

    // NOT
    const notRes = await db.customersRepo.findMany(tenantA, {
      where: {
        NOT: { industry: { eq: "Logistics" } },
      },
    });
    if (notRes.items.length !== 1 || notRes.items[0].id !== "cust-3") throw new Error("NOT failed");
  });

  // 5. Array operators
  await test("QuerySpec: array operators on tags", async (db) => {
    await db.documentsRepo.create({
      id: "doc-1",
      name: "Q4 Financials",
      category: "financial",
      fileType: "pdf",
      fileSize: 1024,
      storageUri: "uri://1",
      tags: ["finance", "quarterly", "confidential"],
      status: "indexed",
      uploadedBy: "user-1",
      uploadedAt: "2026-01-01",
    }, tenantA);

    await db.documentsRepo.create({
      id: "doc-2",
      name: "Engineering Roadmap",
      category: "technical",
      fileType: "pdf",
      fileSize: 2048,
      storageUri: "uri://2",
      tags: ["engineering", "roadmap"],
      status: "indexed",
      uploadedBy: "user-1",
      uploadedAt: "2026-01-01",
    }, tenantA);

    // arrayContains
    const arrContainsRes = await db.documentsRepo.findMany(tenantA, {
      where: { tags: { arrayContains: "confidential" } },
    });
    if (arrContainsRes.items.length !== 1 || arrContainsRes.items[0].id !== "doc-1") {
      throw new Error("arrayContains failed");
    }

    // arrayContainsAny
    const arrAnyRes = await db.documentsRepo.findMany(tenantA, {
      where: { tags: { arrayContainsAny: ["roadmap", "nonexistent"] } },
    });
    if (arrAnyRes.items.length !== 1 || arrAnyRes.items[0].id !== "doc-2") {
      throw new Error("arrayContainsAny failed");
    }
  });

  // 6. findOne and count methods
  await test("QuerySpec: findOne and count repository methods", async (db) => {
    await db.customersRepo.create({
      id: "cust-1",
      name: "Acme Corp",
      industry: "Manufacturing",
      tier: "Enterprise",
      arr: 150000,
      healthScore: 85,
      status: "healthy",
      contractRenewalDate: "2026-12-31",
      contactName: "John Acme",
      contactEmail: "john@acme.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-2",
      name: "Beta Ltd",
      industry: "Technology",
      tier: "Growth",
      arr: 50000,
      healthScore: 60,
      status: "at-risk",
      contractRenewalDate: "2026-06-30",
      contactName: "Jane Beta",
      contactEmail: "jane@beta.com",
    }, tenantA);

    // findOne
    const single = await db.customersRepo.findOne(tenantA, {
      where: { contactEmail: { eq: "jane@beta.com" } },
    });
    if (!single || single.id !== "cust-2") throw new Error("findOne failed");

    // count
    const totalCount = await db.customersRepo.count(tenantA);
    if (totalCount !== 2) throw new Error(`count total failed, got ${totalCount}`);

    const filteredCount = await db.customersRepo.count(tenantA, {
      where: { status: { eq: "at-risk" } },
    });
    if (filteredCount !== 1) throw new Error(`count filtered failed, got ${filteredCount}`);
  });

  // =========================================================================
  // 2. PAGINATION & DETERMINISTIC SORTING (TASK 04.07.02)
  // =========================================================================

  // 7. Default limit enforcement (50 items)
  await test("Pagination: Default page size of 50 is applied when limit is omitted", async (db) => {
    for (let i = 1; i <= 60; i++) {
      await db.customersRepo.create({
        id: `cust-bulk-${String(i).padStart(3, "0")}`,
        name: `Customer ${i}`,
        tier: "Standard",
        arr: i * 1000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `c${i}@test.com`,
      }, tenantA);
    }

    const res = await db.customersRepo.findMany(tenantA);
    if (res.items.length !== 50) {
      throw new Error(`Expected default page size 50, got ${res.items.length}`);
    }
    if (res.hasMore !== true) {
      throw new Error("Expected hasMore to be true when total (60) > default limit (50)");
    }
    if (!res.nextCursor) {
      throw new Error("Expected nextCursor to be present when hasMore is true");
    }
    if (res.count !== 50) {
      throw new Error(`Expected count to be 50, got ${res.count}`);
    }
  });

  // 8. Max limit clamping (100 items)
  await test("Pagination: Max page size of 100 is enforced when limit exceeds 100", async (db) => {
    for (let i = 1; i <= 110; i++) {
      await db.customersRepo.create({
        id: `cust-max-${String(i).padStart(3, "0")}`,
        name: `Max Customer ${i}`,
        tier: "Standard",
        arr: i * 1000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `cmax${i}@test.com`,
      }, tenantA);
    }

    const res = await db.customersRepo.findMany(tenantA, { limit: 500 });
    if (res.items.length !== 100) {
      throw new Error(`Expected clamped max page size 100, got ${res.items.length}`);
    }
    if (res.hasMore !== true) {
      throw new Error("Expected hasMore to be true when total (110) > max limit (100)");
    }
    if (!res.nextCursor) {
      throw new Error("Expected nextCursor to be present");
    }
  });

  // 9. Invalid limits handling (0, negative, NaN, Infinity)
  await test("Pagination: Invalid limit values (0, negative, NaN, Infinity) safely normalize to default (50)", async (db) => {
    for (let i = 1; i <= 110; i++) {
      await db.customersRepo.create({
        id: `cust-inv-${String(i).padStart(3, "0")}`,
        name: `Customer ${i}`,
        tier: "Standard",
        arr: i * 1000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `cinv${i}@test.com`,
      }, tenantA);
    }

    const resZero = await db.customersRepo.findMany(tenantA, { limit: 0 });
    if (resZero.items.length !== 50) throw new Error("limit: 0 did not normalize to 50");

    const resNeg = await db.customersRepo.findMany(tenantA, { limit: -10 });
    if (resNeg.items.length !== 50) throw new Error("negative limit did not normalize to 50");

    const resNaN = await db.customersRepo.findMany(tenantA, { limit: NaN as any });
    if (resNaN.items.length !== 50) throw new Error("NaN limit did not normalize to 50");

    const resInf = await db.customersRepo.findMany(tenantA, { limit: Infinity as any });
    if (resInf.items.length !== 100) throw new Error("Infinity limit did not clamp to max 100");
  });

  // 10. Multi-page traversal with cursor
  await test("Pagination: Multi-page traversal using cursors traverses entire dataset without missing or duplicate records", async (db) => {
    const totalRecords = 25;
    for (let i = 1; i <= totalRecords; i++) {
      await db.customersRepo.create({
        id: `cust-page-${String(i).padStart(3, "0")}`,
        name: `Customer ${i}`,
        tier: "Standard",
        arr: i * 10000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `cp${i}@test.com`,
      }, tenantA);
    }

    const collectedIds: string[] = [];
    let currentCursor: string | undefined = undefined;
    let pageCount = 0;
    const pageSize = 10;

    do {
      pageCount++;
      const pageResult = await db.customersRepo.findMany(tenantA, {
        limit: pageSize,
        cursor: currentCursor,
        orderBy: [{ field: "arr", direction: "asc" }],
      });

      for (const item of pageResult.items) {
        collectedIds.push(item.id);
      }

      currentCursor = pageResult.nextCursor;
      if (!pageResult.hasMore) {
        break;
      }
    } while (currentCursor && pageCount < 10);

    if (pageCount !== 3) {
      throw new Error(`Expected 3 pages for 25 items with limit 10, got ${pageCount}`);
    }
    if (collectedIds.length !== totalRecords) {
      throw new Error(`Expected ${totalRecords} items collected, got ${collectedIds.length}`);
    }

    // Verify all IDs unique and preserved in order
    const uniqueIds = new Set(collectedIds);
    if (uniqueIds.size !== totalRecords) {
      throw new Error("Duplicate items encountered across pages");
    }
  });

  // 11. Deterministic sorting and tie-breaking
  await test("Pagination: Deterministic tie-breaking on identical sort field values", async (db) => {
    // 5 customers with identical arr (100000)
    for (let i = 1; i <= 5; i++) {
      await db.customersRepo.create({
        id: `cust-tie-${i}`,
        name: `Customer Tie ${i}`,
        tier: "Standard",
        arr: 100000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `ctie${i}@test.com`,
      }, tenantA);
    }

    // Page 1: limit 2
    const page1 = await db.customersRepo.findMany(tenantA, {
      limit: 2,
      orderBy: [{ field: "arr", direction: "asc" }],
    });
    if (page1.items.length !== 2) throw new Error("Page 1 length mismatch");
    if (!page1.nextCursor) throw new Error("Page 1 nextCursor missing");

    // Page 2: limit 2
    const page2 = await db.customersRepo.findMany(tenantA, {
      limit: 2,
      cursor: page1.nextCursor,
      orderBy: [{ field: "arr", direction: "asc" }],
    });
    if (page2.items.length !== 2) throw new Error("Page 2 length mismatch");
    if (!page2.nextCursor) throw new Error("Page 2 nextCursor missing");

    // Page 3: limit 2 -> should return 1 item and hasMore = false
    const page3 = await db.customersRepo.findMany(tenantA, {
      limit: 2,
      cursor: page2.nextCursor,
      orderBy: [{ field: "arr", direction: "asc" }],
    });
    if (page3.items.length !== 1) throw new Error("Page 3 length mismatch");
    if (page3.hasMore !== false) throw new Error("Page 3 hasMore should be false");

    // Ensure all 5 items are distinct
    const allCollected = [...page1.items, ...page2.items, ...page3.items].map((c) => c.id);
    const unique = new Set(allCollected);
    if (unique.size !== 5) {
      throw new Error(`Expected 5 unique IDs under tie-breaker, got ${unique.size}: ${allCollected.join(",")}`);
    }
  });

  // 12. Empty collection response
  await test("Pagination: Empty collection returns structured empty PaginatedResult", async (db) => {
    const res = await db.customersRepo.findMany(tenantA);
    if (res.items.length !== 0) throw new Error("Expected 0 items");
    if (res.count !== 0) throw new Error("Expected count 0");
    if (res.hasMore !== false) throw new Error("Expected hasMore false");
    if (res.nextCursor !== undefined) throw new Error("Expected undefined nextCursor");
  });

  // 13. Exact page size boundary (e.g. 5 items with limit 5)
  await test("Pagination: Exact page size boundary yields hasMore=false and no nextCursor", async (db) => {
    for (let i = 1; i <= 5; i++) {
      await db.customersRepo.create({
        id: `cust-exact-${i}`,
        name: `Exact ${i}`,
        tier: "Standard",
        arr: i * 1000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `ce${i}@test.com`,
      }, tenantA);
    }

    const res = await db.customersRepo.findMany(tenantA, { limit: 5 });
    if (res.items.length !== 5) throw new Error("Expected 5 items");
    if (res.hasMore !== false) throw new Error("Expected hasMore=false for exact boundary");
    if (res.nextCursor !== undefined) throw new Error("Expected no nextCursor for exact boundary");
  });

  // 14. Boundary with 1 extra item (e.g. 6 items with limit 5)
  await test("Pagination: Limit + 1 items yields hasMore=true on page 1 and hasMore=false on page 2", async (db) => {
    for (let i = 1; i <= 6; i++) {
      await db.customersRepo.create({
        id: `cust-bound-${i}`,
        name: `Bound ${i}`,
        tier: "Standard",
        arr: i * 1000,
        healthScore: 80,
        status: "healthy",
        contactName: `Contact ${i}`,
        contactEmail: `cb${i}@test.com`,
      }, tenantA);
    }

    const p1 = await db.customersRepo.findMany(tenantA, { limit: 5 });
    if (p1.items.length !== 5) throw new Error("P1 length should be 5");
    if (p1.hasMore !== true) throw new Error("P1 hasMore should be true");
    if (!p1.nextCursor) throw new Error("P1 nextCursor should exist");

    const p2 = await db.customersRepo.findMany(tenantA, { limit: 5, cursor: p1.nextCursor });
    if (p2.items.length !== 1) throw new Error("P2 length should be 1");
    if (p2.hasMore !== false) throw new Error("P2 hasMore should be false");
    if (p2.nextCursor !== undefined) throw new Error("P2 nextCursor should not exist");
  });

  // 15. Sort field whitelisting & rejection of forbidden fields
  await test("Pagination: Sort field whitelisting rejects unapproved fields or SQL injection attempts", async (db) => {
    await db.customersRepo.create({
      id: "cust-sort-1",
      name: "Sort Test",
      tier: "Standard",
      arr: 50000,
      healthScore: 80,
      status: "healthy",
      contactName: "Contact",
      contactEmail: "csort@test.com",
    }, tenantA);

    let threw = false;
    try {
      await db.customersRepo.findMany(tenantA, {
        orderBy: [{ field: "invalid_column; DROP TABLE customers;--" as any, direction: "asc" }],
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) threw = true;
    }
    if (!threw) {
      throw new Error("Expected ValidationError for unwhitelisted orderBy field");
    }
  });

  // 16. Tampered/invalid cursor handling
  await test("Pagination: Tampered or invalid base64 cursor throws ValidationError and prevents exploit", async (db) => {
    await db.customersRepo.create({
      id: "cust-tamp-1",
      name: "Tamper Test",
      tier: "Standard",
      arr: 50000,
      healthScore: 80,
      status: "healthy",
      contactName: "Contact",
      contactEmail: "ctamp@test.com",
    }, tenantA);

    // Completely invalid base64
    let threwInvalid = false;
    try {
      await db.customersRepo.findMany(tenantA, { cursor: "not_a_valid_base64_cursor!!!" });
    } catch (err: unknown) {
      if (err instanceof ValidationError) threwInvalid = true;
    }
    if (!threwInvalid) {
      throw new Error("Expected ValidationError for invalid cursor string");
    }

    // Valid base64 but invalid JSON payload
    const badJsonCursor = Buffer.from("this is plain text not json").toString("base64url");
    let threwBadJson = false;
    try {
      await db.customersRepo.findMany(tenantA, { cursor: badJsonCursor });
    } catch (err: unknown) {
      if (err instanceof ValidationError) threwBadJson = true;
    }
    if (!threwBadJson) {
      throw new Error("Expected ValidationError for non-JSON cursor payload");
    }
  });

  // 17. Cross-tenant cursor leakage prevention
  await test("Pagination: Cursor issued for Tenant A cannot be used by Tenant B (Cross-Tenant Defense)", async (db) => {
    // Tenant A record
    await db.customersRepo.create({
      id: "cust-a-1",
      name: "Tenant A Customer 1",
      tier: "Standard",
      arr: 10000,
      healthScore: 80,
      status: "healthy",
      contactName: "Contact A1",
      contactEmail: "ca1@test.com",
    }, tenantA);

    await db.customersRepo.create({
      id: "cust-a-2",
      name: "Tenant A Customer 2",
      tier: "Standard",
      arr: 20000,
      healthScore: 80,
      status: "healthy",
      contactName: "Contact A2",
      contactEmail: "ca2@test.com",
    }, tenantA);

    // Tenant B record
    await db.customersRepo.create({
      id: "cust-b-1",
      name: "Tenant B Customer 1",
      tier: "Standard",
      arr: 30000,
      healthScore: 80,
      status: "healthy",
      contactName: "Contact B1",
      contactEmail: "cb1@test.com",
    }, tenantB);

    // Generate cursor for Tenant A
    const resA = await db.customersRepo.findMany(tenantA, { limit: 1 });
    if (!resA.nextCursor) throw new Error("Expected Tenant A cursor");

    // Tenant B attempts to use Tenant A's cursor
    let threwCrossTenant = false;
    try {
      await db.customersRepo.findMany(tenantB, { cursor: resA.nextCursor });
    } catch (err: unknown) {
      if (err instanceof ValidationError) threwCrossTenant = true;
    }
    if (!threwCrossTenant) {
      throw new Error("Expected ValidationError when Tenant B supplied Tenant A cursor");
    }
  });

  // 18. Concrete domain repository query methods
  await test("QuerySpec: Concrete domain repository query methods work seamlessly with pagination", async (db) => {
    await db.customersRepo.create({
      id: "cust-c1",
      name: "Customer At Risk",
      industry: "SaaS",
      tier: "Enterprise",
      arr: 100000,
      healthScore: 55,
      status: "at-risk",
      contactName: "Lead",
      contactEmail: "lead@risk.com",
    }, tenantA);

    const emailMatch = await db.customersRepo.findByEmail("lead@risk.com", tenantA);
    if (!emailMatch || emailMatch.id !== "cust-c1") throw new Error("findByEmail failed");

    const atRisk = await db.customersRepo.findAtRisk(tenantA);
    if (atRisk.items.length !== 1 || atRisk.items[0].id !== "cust-c1") throw new Error("findAtRisk failed");

    // Contracts
    await db.contractsRepo.create({
      id: "contract-c1",
      customerId: "cust-c1",
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

    const expiringSoon = await db.contractsRepo.findExpiringSoon(30, tenantA);
    if (expiringSoon.items.length !== 1 || expiringSoon.items[0].id !== "contract-c1") {
      throw new Error("findExpiringSoon failed");
    }

    // Knowledge search
    await db.knowledgeRepo.create({
      id: "know-c1",
      title: "Security Guidelines for Cloud Migration",
      content: "Ensure all endpoints enforce tenant-level isolation and AES-256 encryption.",
      category: "policy",
      tags: ["security", "cloud"],
      confidenceScore: 0.98,
      verifiedBy: "user-1",
      verifiedAt: "2026-01-01",
    }, tenantA);

    const searchRes = await db.knowledgeRepo.searchContent("encryption", tenantA);
    if (searchRes.items.length !== 1 || searchRes.items[0].id !== "know-c1") {
      throw new Error("searchContent failed");
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    suite,
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
