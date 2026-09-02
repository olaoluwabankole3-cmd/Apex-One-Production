/**
 * APEX ONE — Final Canonical Repository Contract Audit
 *
 * Stage 3 preserves the original security/error invariants while replacing
 * legacy offset/array assertions with cursor-based PaginatedResult semantics.
 */

import { DatabaseStore } from "../database/store";
import { TenantContext } from "../core/security";
import {
  NotFoundError,
  CrossTenantViolationError,
  ValidationError,
  ConflictError,
} from "../core/errors";
import { Validator } from "../core/validation";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface TestSuiteSummary {
  suite: string;
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}

const tenantA: TenantContext = Object.freeze({
  organizationId: "org-alpha-audit",
  userId: "user-alpha-audit",
  userEmail: "alpha.audit@enterprise.com",
  userRole: "Administrator",
  permissions: ["*"],
  requestId: "req-alpha-audit",
});

const tenantB: TenantContext = Object.freeze({
  organizationId: "org-beta-audit",
  userId: "user-beta-audit",
  userEmail: "beta.audit@holdings.com",
  userRole: "Administrator",
  permissions: ["*"],
  requestId: "req-beta-audit",
});

async function expectCrossTenant(fn: () => Promise<unknown>, label: string) {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = error instanceof CrossTenantViolationError;
  }
  if (!rejected) throw new Error(`${label} did not reject cross-tenant ID access`);
}

export async function runFinalRepositoryAuditTestSuite(): Promise<TestSuiteSummary> {
  const suite = "Final Repository Contract & Consumer Compatibility Audit";
  const results: TestResult[] = [];

  const test = async (testName: string, fn: () => Promise<void>) => {
    const started = performance.now();
    try {
      await fn();
      results.push({ suite, testName, passed: true, durationMs: Math.round(performance.now() - started) });
    } catch (error: any) {
      results.push({ suite, testName, passed: false, error: error?.message || String(error), durationMs: Math.round(performance.now() - started) });
    }
  };

  await test("IDOR: Customer findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const record = await db.customersRepo.create({ name: "Alpha Customer", tier: "Enterprise", status: "active", arr: 500000 } as any, tenantA);
    await expectCrossTenant(() => db.customersRepo.findById(record.id, tenantB, "Customer"), "Customer");
  });

  await test("IDOR: Contract findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const customer = await db.customersRepo.create({ name: "Alpha", tier: "SMB", status: "active" } as any, tenantA);
    const record = await db.contractsRepo.create({
      customerId: customer.id,
      title: "Alpha MSA",
      contractValue: 100000,
      annualRecurringRevenue: 100000,
      currency: "USD",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      renewalDaysRemaining: 180,
      billingCadence: "annual",
      slaCompliance: 99.5,
      volatilityIndexationClause: true,
    } as any, tenantA);
    await expectCrossTenant(() => db.contractsRepo.findById(record.id, tenantB, "Contract"), "Contract");
  });

  await test("IDOR: Transaction findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const customer = await db.customersRepo.create({ name: "Alpha", tier: "SMB", status: "active" } as any, tenantA);
    const record = await db.transactionsRepo.create({
      customerId: customer.id,
      amount: 25000,
      currency: "USD",
      type: "revenue",
      status: "cleared",
      reference: "REF-001",
      category: "Subscription",
      date: "2026-06-01",
    } as any, tenantA);
    await expectCrossTenant(() => db.transactionsRepo.findById(record.id, tenantB, "Transaction"), "Transaction");
  });

  await test("IDOR: Signal findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const record = await db.signalsRepo.create({
      title: "Alpha Signal",
      category: "revenue",
      severity: "high",
      status: "active",
      estimatedFinancialImpact: 120000,
    } as any, tenantA);
    await expectCrossTenant(() => db.signalsRepo.findById(record.id, tenantB, "Signal"), "Signal");
  });

  await test("IDOR: Document findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const record = await db.documentsRepo.create({
      name: "Alpha Board Deck.pdf",
      category: "Board Paper",
      status: "indexed",
      fileType: "pdf",
      fileSize: 1024,
      storageUri: "memory://alpha",
      tags: [],
      uploadedAt: "2026-01-01",
    } as any, tenantA);
    await expectCrossTenant(() => db.documentsRepo.findById(record.id, tenantB, "Document"), "Document");
  });

  await test("IDOR: Workflow findById across tenants throws CrossTenantViolationError", async () => {
    const db = new DatabaseStore();
    const record = await db.workflowsRepo.create({ name: "Alpha Workflow", status: "active", version: 1, steps: [] } as any, tenantA);
    await expectCrossTenant(() => db.workflowsRepo.findById(record.id, tenantB, "Workflow"), "Workflow");
  });

  await test("PAGINATION: Multi-page cursor traversal has no duplicates or missing records", async () => {
    const db = new DatabaseStore();
    db.customers.clear();
    for (let i = 0; i < 25; i++) {
      const suffix = String(i).padStart(2, "0");
      await db.customersRepo.create({
        id: `audit-page-${suffix}`,
        name: `Customer Record ${suffix}`,
        tier: "Mid-Market",
        status: "active",
        arr: (i + 1) * 1000,
      } as any, tenantA);
    }

    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await db.customersRepo.findMany(tenantA, {
        limit: 10,
        cursor,
        orderBy: { field: "name", direction: "asc" },
      });
      pages += 1;
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      if (!page.hasMore) {
        if (page.nextCursor !== null) throw new Error("final page must expose nextCursor=null");
        break;
      }
    } while (cursor && pages < 10);

    if (pages !== 3 || ids.length !== 25 || new Set(ids).size !== 25) {
      throw new Error("cursor traversal produced missing/duplicate records");
    }
    if (ids[0] !== "audit-page-00" || ids[24] !== "audit-page-24") {
      throw new Error("cursor traversal was not deterministic");
    }
  });

  await test("PAGINATION: Exhausted final page exposes hasMore=false and nextCursor=null", async () => {
    const db = new DatabaseStore();
    db.customers.clear();
    await db.customersRepo.create({ id: "only", name: "Only", tier: "SMB", status: "active" } as any, tenantA);
    const page = await db.customersRepo.findMany(tenantA, { limit: 10 });
    if (page.items.length !== 1 || page.hasMore || page.nextCursor !== null || page.count !== 1 || page.totalCount !== 1) {
      throw new Error("final-page metadata is not canonical");
    }
  });

  await test("ERROR SEMANTICS: NotFoundError is preserved for unknown entity IDs", async () => {
    const db = new DatabaseStore();
    let caught = false;
    try {
      await db.customersRepo.findById("does-not-exist", tenantA, "Customer");
    } catch (error) {
      caught = error instanceof NotFoundError && error.statusCode === 404;
    }
    if (!caught) throw new Error("NotFoundError semantics were not preserved");
  });

  await test("ERROR SEMANTICS: ValidationError is preserved for invalid numerical inputs", async () => {
    let caught = false;
    try {
      Validator.requireNumber(-5000, "ARR", { min: 0 });
    } catch (error) {
      caught = error instanceof ValidationError && error.statusCode === 400;
    }
    if (!caught) throw new Error("ValidationError semantics were not preserved");
  });

  await test("ERROR SEMANTICS: ConflictError is preserved for restricted lifecycle mutations", async () => {
    const db = new DatabaseStore();
    const customer = await db.customersRepo.create({ name: "Dependent", tier: "SMB", status: "active" } as any, tenantA);
    await db.contractsRepo.create({
      customerId: customer.id,
      title: "Active SLA",
      contractValue: 50000,
      annualRecurringRevenue: 50000,
      currency: "USD",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      renewalDaysRemaining: 120,
      billingCadence: "annual",
      slaCompliance: 99,
      volatilityIndexationClause: false,
    } as any, tenantA);

    let caught = false;
    try {
      await db.customersRepo.delete(customer.id, tenantA, "Customer");
    } catch (error) {
      caught = error instanceof ConflictError && error.statusCode === 409;
    }
    if (!caught) throw new Error("ConflictError semantics were not preserved");
  });

  await test("TENANT FILTER INVARIANCE: Query predicates cannot override authenticated organization scope", async () => {
    const db = new DatabaseStore();
    db.customers.clear();
    await db.customersRepo.create({ id: "alpha", name: "Alpha", tier: "Enterprise", status: "active" } as any, tenantA);
    await db.customersRepo.create({ id: "beta", name: "Beta", tier: "Enterprise", status: "active" } as any, tenantB);

    const spoofed = await db.customersRepo.findMany(tenantA, {
      where: { organizationId: { eq: tenantB.organizationId } },
    });
    if (spoofed.items.length !== 0 || spoofed.totalCount !== 0) {
      throw new Error("query organizationId predicate bypassed tenant pre-filtering");
    }

    const normal = await db.customersRepo.findMany(tenantA);
    if (normal.items.length !== 1 || normal.items[0].id !== "alpha") {
      throw new Error("authenticated tenant scope was corrupted by query handling");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;
  return { suite, total: results.length, passedCount, failedCount, results };
}
