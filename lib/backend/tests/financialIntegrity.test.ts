/**
 * APEX ONE — Financial & Currency Integrity Security & Validation Test Suite
 * 
 * Production test suite verifying:
 * - Currency normalization and validation
 * - Prevention of invalid multi-currency aggregation
 * - Transaction status filtering (cleared vs pending/failed/disputed)
 * - Financial tenant isolation
 * - Prohibition of fabricated LTV from ARR
 * - Prohibition of hardcoded exchange rate multipliers
 */

import { DatabaseStore } from "../database/store";
import { DemoDataProvider } from "../database/demoDataProvider";
import { Validator, SUPPORTED_CURRENCIES } from "../core/validation";
import { ValidationError, TenantContext } from "../core/errors";
import { customerRepository } from "../../data/repositories/customerRepository";
import { apiClient } from "../../apiClient";
import { CustomerRecord } from "../database/schema";

export interface TestCaseResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSuiteSummary {
  total: number;
  passedCount: number;
  failedCount: number;
  results: TestCaseResult[];
}

export async function runFinancialIntegrityTestSuite(isolatedDb?: DatabaseStore): Promise<TestSuiteSummary> {
  const results: TestCaseResult[] = [];
  const originalApiClientGet = apiClient.get;

  const testCase = async (suite: string, name: string, fn: () => Promise<void> | void) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite,
        testName: name,
        passed: true,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (err: any) {
      results.push({
        suite,
        testName: name,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  };

  try {
    // Re-seed the in-memory database to establish a clean state
    const db = isolatedDb || DatabaseStore.createFreshStore();
    new DemoDataProvider().seedInitialTenants(db);

    const orgAContext: TenantContext = {
      organizationId: "apex-demo",
      userId: "usr-demo-admin",
      userRole: "admin",
      permissions: ["transaction:read", "transaction:write", "customer:read"],
    };

    const orgBContext: TenantContext = {
      organizationId: "org-titan-corp",
      userId: "usr-titan-admin",
      userRole: "admin",
      permissions: ["transaction:read", "transaction:write", "customer:read"],
    };

    // Register Tenant B USD transaction for isolation testing
    await db.transactionsRepo.create(
      {
        id: "txn-titan-1",
        organizationId: "org-titan-corp",
        customerId: "cust-titan-energy",
        type: "revenue",
        amount: 12500000,
        currency: "USD",
        status: "cleared",
        reference: "INV-TITAN-001",
        category: "Power Inverter License",
        date: "2026-03-01",
        createdAt: "2026-03-01T00:00:00Z",
      },
      orgBContext
    );

    // =========================================================================
    // 1. SAME-CURRENCY AGGREGATION
    // =========================================================================

    await testCase("Financial Aggregation", "Same currency transactions aggregate accurately", async () => {
      const testCtx: TenantContext = {
        organizationId: "org-same-curr-test",
        userId: "usr-tester",
        userRole: "admin",
        permissions: ["transaction:read", "transaction:write"],
      };

      // Insert 3 NGN transactions: 1,000, 2,500, 500
      await db.transactionsRepo.create(
        {
          id: "txn-same-1",
          organizationId: "org-same-curr-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 1000,
          currency: "NGN",
          status: "cleared",
          reference: "REF-S1",
          category: "Subscription",
          date: "2026-02-01",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      await db.transactionsRepo.create(
        {
          id: "txn-same-2",
          organizationId: "org-same-curr-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 2500,
          currency: "NGN",
          status: "cleared",
          reference: "REF-S2",
          category: "Subscription",
          date: "2026-02-02",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      await db.transactionsRepo.create(
        {
          id: "txn-same-3",
          organizationId: "org-same-curr-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 500,
          currency: "NGN",
          status: "cleared",
          reference: "REF-S3",
          category: "Subscription",
          date: "2026-02-03",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      const totals = await db.transactionsRepo.calculateFinancialTotals(testCtx);

      if (totals.isMixedCurrency !== false) {
        throw new Error(`Expected isMixedCurrency === false, got ${totals.isMixedCurrency}`);
      }
      if (totals.currency !== "NGN") {
        throw new Error(`Expected currency === 'NGN', got ${totals.currency}`);
      }
      if (totals.totalRevenue !== 4000) {
        throw new Error(`Expected totalRevenue === 4000, got ${totals.totalRevenue}`);
      }
      if (totals.byCurrency["NGN"]?.totalRevenue !== 4000) {
        throw new Error(`Expected byCurrency.NGN.totalRevenue === 4000, got ${totals.byCurrency["NGN"]?.totalRevenue}`);
      }
    });

    // =========================================================================
    // 2. MIXED-CURRENCY AGGREGATION PROTECTION
    // =========================================================================

    await testCase("Financial Aggregation", "Mixed currency transactions are NEVER summed into a single universal total", async () => {
      const testCtx: TenantContext = {
        organizationId: "org-mixed-curr-test",
        userId: "usr-tester",
        userRole: "admin",
        permissions: ["transaction:read", "transaction:write"],
      };

      // Insert 1000 NGN and 100 USD
      await db.transactionsRepo.create(
        {
          id: "txn-mix-1",
          organizationId: "org-mixed-curr-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 1000,
          currency: "NGN",
          status: "cleared",
          reference: "REF-M1",
          category: "Subscription",
          date: "2026-02-01",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      await db.transactionsRepo.create(
        {
          id: "txn-mix-2",
          organizationId: "org-mixed-curr-test",
          customerId: "cust-2",
          type: "revenue",
          amount: 100,
          currency: "USD",
          status: "cleared",
          reference: "REF-M2",
          category: "License",
          date: "2026-02-02",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      const totals = await db.transactionsRepo.calculateFinancialTotals(testCtx);

      // CRITICAL: Must be flagged as mixed currency
      if (totals.isMixedCurrency !== true) {
        throw new Error("Financial integrity violation: isMixedCurrency should be true for mixed currencies");
      }

      // CRITICAL: totalRevenue must NOT be 1100! It must be null.
      if (totals.totalRevenue !== null && totals.totalRevenue !== undefined) {
        throw new Error(
          `Financial integrity violation: totalRevenue must not be a blended universal sum (${totals.totalRevenue}) when currencies are mixed`
        );
      }

      // Must provide structured, grouped totals per currency
      if (totals.byCurrency["NGN"]?.totalRevenue !== 1000) {
        throw new Error(`Expected byCurrency.NGN.totalRevenue === 1000, got ${totals.byCurrency["NGN"]?.totalRevenue}`);
      }
      if (totals.byCurrency["USD"]?.totalRevenue !== 100) {
        throw new Error(`Expected byCurrency.USD.totalRevenue === 100, got ${totals.byCurrency["USD"]?.totalRevenue}`);
      }
    });

    // =========================================================================
    // 3. INVALID CURRENCY HANDLING & VALIDATION
    // =========================================================================

    await testCase("Currency Validation", "Invalid currency code 'XYZ' is rejected with ValidationError", () => {
      let failedAsExpected = false;
      try {
        Validator.requireCurrency("XYZ");
      } catch (err: any) {
        if (err instanceof ValidationError && err.message.includes("Invalid or unsupported currency")) {
          failedAsExpected = true;
        }
      }
      if (!failedAsExpected) {
        throw new Error("Expected Validator.requireCurrency('XYZ') to throw ValidationError");
      }
    });

    await testCase("Currency Validation", "Validator.normalizeCurrency returns undefined for unsupported currencies", () => {
      const normalized = Validator.normalizeCurrency("monopoly_money");
      if (normalized !== undefined) {
        throw new Error(`Expected normalizeCurrency('monopoly_money') to return undefined, got '${normalized}'`);
      }
    });

    await testCase("Currency Validation", "Canonical currencies normalize reliably", () => {
      if (Validator.normalizeCurrency("₦") !== "NGN") throw new Error("₦ did not normalize to NGN");
      if (Validator.normalizeCurrency("naira") !== "NGN") throw new Error("naira did not normalize to NGN");
      if (Validator.normalizeCurrency("ngn") !== "NGN") throw new Error("ngn did not normalize to NGN");
      if (Validator.normalizeCurrency("$") !== "USD") throw new Error("$ did not normalize to USD");
      if (Validator.normalizeCurrency("usd") !== "USD") throw new Error("usd did not normalize to USD");
      if (Validator.normalizeCurrency("dollar") !== "USD") throw new Error("dollar did not normalize to USD");
      if (Validator.normalizeCurrency("£") !== "GBP") throw new Error("£ did not normalize to GBP");
      if (Validator.normalizeCurrency("€") !== "EUR") throw new Error("€ did not normalize to EUR");
      if (Validator.normalizeCurrency("GHS") !== "GHS") throw new Error("GHS did not normalize to GHS");
      if (Validator.normalizeCurrency("cedi") !== "GHS") throw new Error("cedi did not normalize to GHS");
    });

    // =========================================================================
    // 4. MISSING CURRENCY HANDLING
    // =========================================================================

    await testCase("Currency Validation", "Missing, empty, or null currency is rejected with ValidationError", () => {
      let failedNull = false;
      try {
        Validator.requireCurrency(null);
      } catch (err: any) {
        if (err instanceof ValidationError) failedNull = true;
      }
      if (!failedNull) throw new Error("Expected requireCurrency(null) to throw ValidationError");

      let failedEmpty = false;
      try {
        Validator.requireCurrency("");
      } catch (err: any) {
        if (err instanceof ValidationError) failedEmpty = true;
      }
      if (!failedEmpty) throw new Error("Expected requireCurrency('') to throw ValidationError");
    });

    // =========================================================================
    // 5. TRANSACTION STATUS FILTERING (FAILED / PENDING / DISPUTED)
    // =========================================================================

    await testCase("Financial Aggregation", "Failed, pending, and disputed transactions are excluded from realized totals", async () => {
      const testCtx: TenantContext = {
        organizationId: "org-status-filter-test",
        userId: "usr-tester",
        userRole: "admin",
        permissions: ["transaction:read", "transaction:write"],
      };

      // 1000 cleared revenue
      await db.transactionsRepo.create(
        {
          id: "txn-stat-1",
          organizationId: "org-status-filter-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 1000,
          currency: "NGN",
          status: "cleared",
          reference: "REF-STAT1",
          category: "Subscription",
          date: "2026-02-01",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      // 500 failed revenue (MUST NOT BE IN REALIZED REVENUE)
      await db.transactionsRepo.create(
        {
          id: "txn-stat-2",
          organizationId: "org-status-filter-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 500,
          currency: "NGN",
          status: "failed",
          reference: "REF-STAT2",
          category: "Subscription",
          date: "2026-02-02",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      // 300 pending revenue (MUST NOT BE IN REALIZED REVENUE)
      await db.transactionsRepo.create(
        {
          id: "txn-stat-3",
          organizationId: "org-status-filter-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 300,
          currency: "NGN",
          status: "pending",
          reference: "REF-STAT3",
          category: "Subscription",
          date: "2026-02-03",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      // 200 disputed revenue (MUST NOT BE IN REALIZED REVENUE)
      await db.transactionsRepo.create(
        {
          id: "txn-stat-4",
          organizationId: "org-status-filter-test",
          customerId: "cust-1",
          type: "revenue",
          amount: 200,
          currency: "NGN",
          status: "disputed",
          reference: "REF-STAT4",
          category: "Subscription",
          date: "2026-02-04",
          createdAt: new Date().toISOString(),
        },
        testCtx
      );

      const totals = await db.transactionsRepo.calculateFinancialTotals(testCtx);

      if (totals.totalRevenue !== 1000) {
        throw new Error(
          `Financial status filtering violation: totalRevenue should be 1000 (cleared only), but got ${totals.totalRevenue}`
        );
      }
    });

    // =========================================================================
    // 6. TENANT ISOLATION IN FINANCIAL AGGREGATION
    // =========================================================================

    await testCase("Tenant Isolation", "Financial aggregates strictly isolate Tenant A from Tenant B", async () => {
      const totalsA = await db.transactionsRepo.calculateFinancialTotals(orgAContext);
      const totalsB = await db.transactionsRepo.calculateFinancialTotals(orgBContext);

      // Tenant A transactions are NGN
      if (totalsA.currency !== "NGN") {
        throw new Error(`Tenant A currency expected 'NGN', got ${totalsA.currency}`);
      }

      // Tenant B transactions are USD
      if (totalsB.currency !== "USD") {
        throw new Error(`Tenant B currency expected 'USD', got ${totalsB.currency}`);
      }

      // Tenant A totals should never leak Tenant B revenue
      if (totalsA.byCurrency["USD"]) {
        throw new Error("Isolation breach: Tenant A contains Tenant B USD transactions");
      }

      // Tenant B totals should never leak Tenant A revenue
      if (totalsB.byCurrency["NGN"]) {
        throw new Error("Isolation breach: Tenant B contains Tenant A NGN transactions");
      }
    });

    // =========================================================================
    // 7. ARR IS NOT LTV (NO FABRICATED LTV)
    // =========================================================================

    await testCase("Financial Truthfulness", "Customer mapper does not fabricate LTV from ARR", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-ltv-truth-test",
        organizationId: "apex-demo",
        name: "Acme Industrial Testing",
        subsidiary: "Nigeria",
        tier: "Enterprise",
        status: "active",
        healthScore: 85,
        arr: 50000000, // 50M ARR
        owner: "Amara Okafor",
        contactName: "Tunde Bakare",
        contactRole: "Chief Technology Officer",
        contactEmail: "tunde@acme-industrial.com",
        since: "2024-01-15",
        tags: ["Industrial", "Enterprise"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const target = await customerRepository.getUnifiedCustomer("cust-ltv-truth-test");

      if (!target) {
        throw new Error(`Failed to find customer in unified customer lookup`);
      }

      // Must preserve true ARR
      if (target.arr !== 50000000) {
        throw new Error(`Expected arr === 50000000, got ${target.arr}`);
      }

      // LTV MUST NOT be fabricated from ARR
      if (target.ltvUSD !== null && target.ltvUSD !== undefined) {
        throw new Error(`Financial truthfulness violation: ltvUSD was fabricated (${target.ltvUSD}) from ARR`);
      }
      if (target.ltvNaira !== null && target.ltvNaira !== undefined) {
        throw new Error(`Financial truthfulness violation: ltvNaira was fabricated (${target.ltvNaira}) from ARR`);
      }
    });

    // =========================================================================
    // 8. NO HARDCODED FX CONVERSIONS
    // =========================================================================

    await testCase("Financial Truthfulness", "Customer mapper does not apply arbitrary hardcoded FX multiplier (* 1500)", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-fx-truth-test",
        organizationId: "apex-demo",
        name: "Global Shipping Corp",
        subsidiary: "Nigeria",
        tier: "Enterprise",
        status: "active",
        healthScore: 90,
        arr: 10000000, // 10M ARR
        owner: "Amara Okafor",
        contactName: "David Mensah",
        contactRole: "VP Logistics",
        contactEmail: "david@globalshipping.com",
        since: "2023-05-10",
        tags: ["Shipping", "Enterprise"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const target = await customerRepository.getUnifiedCustomer("cust-fx-truth-test");

      if (!target) {
        throw new Error(`Failed to find customer in unified customer lookup`);
      }

      // arrNaira must NOT be 10M * 1500 / 1M = 15000 without an authoritative currency conversion provider
      if (target.arrNaira !== null && target.arrNaira !== undefined) {
        throw new Error(`Financial truthfulness violation: arrNaira (${target.arrNaira}) was derived using hardcoded FX multiplier`);
      }
    });
  } finally {
    apiClient.get = originalApiClientGet;
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passedCount,
    failedCount,
    results,
  };
}
