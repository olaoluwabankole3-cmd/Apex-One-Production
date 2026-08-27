/**
 * APEX ONE — Customer Data Truthfulness & Integrity Test Suite (TASK 03B-FIX-2)
 * 
 * Verifies strict truthfulness in customer repository mappings:
 * TEST 1: A customer with subsidiary "Nigeria" maps correctly.
 * TEST 2: A customer with subsidiary "Ghana" maps correctly.
 * TEST 3: A customer with an unsupported/missing subsidiary does NOT become "Strategic Accounts".
 * TEST 4: A customer with no subsidiary gets null/unavailable businessUnit.
 * TEST 5: A customer with a real since value preserves the exact value.
 * TEST 6: A customer without since gets null.
 * TEST 7: The system does not default missing since to "2024".
 * TEST 8: Previously fixed nullable customer fields remain nullable when unavailable.
 */

import { CustomerRecord } from "../database/schema";
import { customerRepository } from "../../data/repositories/customerRepository";
import { apiClient } from "../../apiClient";

export interface TestResult {
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
  passed: boolean;
  results: TestResult[];
}

export async function runCustomerDataTruthfulnessTestSuite(): Promise<TestSuiteSummary> {
  const results: TestResult[] = [];

  const runTest = async (testName: string, fn: () => Promise<void> | void) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: "Customer Data Truthfulness Suite",
        testName,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        suite: "Customer Data Truthfulness Suite",
        testName,
        passed: false,
        error: err?.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  };

  // Helper to mock apiClient.get for isolated repository mapping tests
  const originalGet = apiClient.get;

  try {
    // TEST 1: A customer with subsidiary "Nigeria" maps correctly
    await runTest("TEST 1: Customer with subsidiary 'Nigeria' maps correctly", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-ng-1",
        organizationId: "org-1",
        name: "Zenith Global",
        subsidiary: "Nigeria",
        tier: "Enterprise",
        status: "active",
        healthScore: 92,
        arr: 4500000,
        owner: "Amara Okonkwo",
        contactName: "Tunde Bakare",
        contactRole: "Chief Technology Officer",
        contactEmail: "tunde@zenith.ng",
        since: "2021",
        tags: ["Core", "Direct"],
        createdAt: "2021-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-ng-1");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.businessUnit !== "Nigeria") {
        throw new Error(`Expected businessUnit to be 'Nigeria', got '${unified.businessUnit}'`);
      }
      if (unified.since !== "2021") {
        throw new Error(`Expected since to be '2021', got '${unified.since}'`);
      }
    });

    // TEST 2: A customer with subsidiary "Ghana" maps correctly
    await runTest("TEST 2: Customer with subsidiary 'Ghana' maps correctly", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-gh-1",
        organizationId: "org-1",
        name: "Accra Logistics",
        subsidiary: "Ghana",
        tier: "Mid-Market",
        status: "active",
        healthScore: 84,
        arr: 1200000,
        owner: "Kofi Mensah",
        contactName: "Kwame Osei",
        contactRole: "Managing Director",
        contactEmail: "kwame@accralog.gh",
        since: "2019",
        tags: ["Logistics"],
        createdAt: "2019-06-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-gh-1");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.businessUnit !== "Ghana") {
        throw new Error(`Expected businessUnit to be 'Ghana', got '${unified.businessUnit}'`);
      }
      if (unified.since !== "2019") {
        throw new Error(`Expected since to be '2019', got '${unified.since}'`);
      }
    });

    // TEST 3: A customer with an unsupported/missing subsidiary does NOT become "Strategic Accounts"
    await runTest("TEST 3: Customer with unsupported subsidiary does NOT become 'Strategic Accounts'", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-unsupported-1",
        organizationId: "org-1",
        name: "Francophone Ventures",
        subsidiary: "Ivory Coast",
        tier: "SMB",
        status: "active",
        healthScore: 78,
        arr: 600000,
        owner: "Jean-Paul S.",
        contactName: "Marc Diop",
        contactRole: "COO",
        contactEmail: "marc@fv.ci",
        since: "2022",
        tags: [],
        createdAt: "2022-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-unsupported-1");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.businessUnit === "Strategic Accounts") {
        throw new Error("Business unit must NOT fallback to 'Strategic Accounts'");
      }
      if (unified.businessUnit !== "Ivory Coast") {
        throw new Error(`Expected businessUnit to be 'Ivory Coast', got '${unified.businessUnit}'`);
      }
    });

    // TEST 4: A customer with no subsidiary gets null/unavailable businessUnit
    await runTest("TEST 4: Customer with no subsidiary gets null businessUnit", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-no-sub",
        organizationId: "org-1",
        name: "Anonymous Holding",
        subsidiary: null as any,
        tier: "Enterprise",
        status: "active",
        healthScore: 80,
        arr: 2000000,
        owner: "Unassigned",
        contactName: "N/A",
        contactRole: "N/A",
        contactEmail: "info@anon.com",
        since: "2023",
        tags: [],
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-no-sub");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.businessUnit !== null) {
        throw new Error(`Expected businessUnit to be null, got '${unified.businessUnit}'`);
      }
    });

    // TEST 5: A customer with a real since value preserves the exact value
    await runTest("TEST 5: Customer with real since preserves exact value", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-since-2018",
        organizationId: "org-1",
        name: "Legacy Partner",
        subsidiary: "Nigeria",
        tier: "Enterprise",
        status: "active",
        healthScore: 95,
        arr: 8000000,
        owner: "Chidi N.",
        contactName: "Adaobi E.",
        contactRole: "VP Finance",
        contactEmail: "adaobi@legacy.ng",
        since: "2018",
        tags: [],
        createdAt: "2018-05-15T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-since-2018");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.since !== "2018") {
        throw new Error(`Expected since to be '2018', got '${unified.since}'`);
      }
    });

    // TEST 6: A customer without since gets null
    await runTest("TEST 6: Customer without since gets null", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-no-since",
        organizationId: "org-1",
        name: "New Prospect Client",
        subsidiary: "Nigeria",
        tier: "SMB",
        status: "onboarding",
        healthScore: 70,
        arr: 300000,
        owner: "Fola A.",
        contactName: "Kelechi U.",
        contactRole: "Founder",
        contactEmail: "kelechi@prospect.io",
        since: null as any,
        tags: [],
        createdAt: "2025-02-01T00:00:00Z",
        updatedAt: "2025-02-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-no-since");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.since !== null) {
        throw new Error(`Expected since to be null, got '${unified.since}'`);
      }
    });

    // TEST 7: The system does not default missing since to "2024"
    await runTest("TEST 7: System does not default missing since to '2024'", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-no-since-2",
        organizationId: "org-1",
        name: "Alpha Corp",
        subsidiary: "Ghana",
        tier: "Enterprise",
        status: "active",
        healthScore: 88,
        arr: 5000000,
        owner: "Kofi M.",
        contactName: "Yaw B.",
        contactRole: "CTO",
        contactEmail: "yaw@alphacorp.gh",
        since: undefined as any,
        tags: [],
        createdAt: "2023-11-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-no-since-2");
      if (!unified) throw new Error("Expected customer to be returned");
      if (unified.since === "2024") {
        throw new Error("System defaulted missing since to fabricated '2024'");
      }
      if (unified.since !== null) {
        throw new Error(`Expected since to be null, got '${unified.since}'`);
      }
    });

    // TEST 8: Previously fixed nullable customer fields remain nullable when unavailable
    await runTest("TEST 8: Previously fixed nullable customer fields remain nullable when unavailable", async () => {
      const mockRecord: CustomerRecord = {
        id: "cust-sparse-fields",
        organizationId: "org-1",
        name: "Sparse Records Ltd",
        subsidiary: "Nigeria",
        tier: "SMB",
        status: "active",
        healthScore: 75,
        arr: 500000,
        owner: "Agent 01",
        contactName: "Jane Doe",
        contactRole: "Director",
        contactEmail: "jane@sparse.ng",
        since: "2020",
        tags: [],
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2020-01-01T00:00:00Z",
        industry: null,
        growthYoY: null,
        engagementLevel: null,
        contractStatus: null,
        supportActivity: null,
        supportTickets: null,
        paymentBehavior: null,
        paymentStatus: null,
        riskLevel: null,
        riskScore: null,
        opportunityReason: null,
        aiInsight: null,
        recommendedAction: null,
      };

      apiClient.get = (async () => ({ success: true, data: mockRecord })) as any;
      const unified = await customerRepository.getUnifiedCustomer("cust-sparse-fields");
      if (!unified) throw new Error("Expected customer to be returned");

      if (unified.industry !== null) throw new Error(`industry should be null, got ${unified.industry}`);
      if (unified.growthYoY !== null) throw new Error(`growthYoY should be null, got ${unified.growthYoY}`);
      if (unified.engagementLevel !== null) throw new Error(`engagementLevel should be null, got ${unified.engagementLevel}`);
      if (unified.contractStatus !== null) throw new Error(`contractStatus should be null, got ${unified.contractStatus}`);
      if (unified.supportActivity !== null) throw new Error(`supportActivity should be null, got ${unified.supportActivity}`);
      if (unified.supportTickets !== null) throw new Error(`supportTickets should be null, got ${unified.supportTickets}`);
      if (unified.paymentBehavior !== null) throw new Error(`paymentBehavior should be null, got ${unified.paymentBehavior}`);
      if (unified.paymentStatus !== null) throw new Error(`paymentStatus should be null, got ${unified.paymentStatus}`);
      if (unified.riskLevel !== null) throw new Error(`riskLevel should be null, got ${unified.riskLevel}`);
      if (unified.riskScore !== null) throw new Error(`riskScore should be null, got ${unified.riskScore}`);
      if (unified.opportunityReason !== null) throw new Error(`opportunityReason should be null, got ${unified.opportunityReason}`);
      if (unified.aiInsight !== null) throw new Error(`aiInsight should be null, got ${unified.aiInsight}`);
      if (unified.recommendedAction !== null) throw new Error(`recommendedAction should be null, got ${unified.recommendedAction}`);
    });

  } finally {
    apiClient.get = originalGet;
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passedCount,
    failedCount,
    passed: failedCount === 0,
    results,
  };
}
