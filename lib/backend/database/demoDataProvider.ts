/**
 * APEX ONE — Demo vs Production Data Provider Abstraction
 * 
 * ARCHITECTURAL NOTICE:
 * Separates demonstration dataset generation from production tenant storage.
 * Production tenants start empty with no hardcoded financial figures.
 * Demo datasets are explicitly flagged and only seeded for specified demonstration tenants.
 */

import {
  OrganizationRecord,
  UserRecord,
  OrganizationMembershipRecord,
  CustomerRecord,
  ContractRecord,
  TransactionRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  OrganizationalMemoryRecord,
  SignalRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  WorkflowRecord,
  ActionRecord,
} from "./schema";
import { hashPassword } from "../core/crypto";

export interface IDataProvider {
  isDemoProvider(): boolean;
  seedInitialTenants(store: {
    organizations: Map<string, OrganizationRecord>;
    users: Map<string, UserRecord>;
    memberships: Map<string, OrganizationMembershipRecord>;
    customers: Map<string, CustomerRecord>;
    contracts: Map<string, ContractRecord>;
    transactions: Map<string, TransactionRecord>;
    documents: Map<string, DocumentRecord>;
    knowledge: Map<string, KnowledgeItemRecord>;
    memory: Map<string, OrganizationalMemoryRecord>;
    signals: Map<string, SignalRecord>;
    opportunities: Map<string, ValueOpportunityRecord>;
    valueCaptured: Map<string, ValueCapturedRecord>;
    workflows: Map<string, WorkflowRecord>;
    actions: Map<string, ActionRecord>;
  }): void;
}

export class ProductionDataProvider implements IDataProvider {
  public isDemoProvider(): boolean {
    return false;
  }

  public seedInitialTenants(store: {
    organizations: Map<string, OrganizationRecord>;
    users: Map<string, UserRecord>;
    memberships: Map<string, OrganizationMembershipRecord>;
  }): void {
    // In production, tenants and users are provisioned via verified onboarding flows.
    // No mock business records are seeded.
  }
}

export class DemoDataProvider implements IDataProvider {
  public isDemoProvider(): boolean {
    return true;
  }

  public seedInitialTenants(store: {
    organizations: Map<string, OrganizationRecord>;
    users: Map<string, UserRecord>;
    memberships: Map<string, OrganizationMembershipRecord>;
    customers: Map<string, CustomerRecord>;
    contracts: Map<string, ContractRecord>;
    transactions: Map<string, TransactionRecord>;
    documents: Map<string, DocumentRecord>;
    knowledge: Map<string, KnowledgeItemRecord>;
    memory: Map<string, OrganizationalMemoryRecord>;
    signals: Map<string, SignalRecord>;
    opportunities: Map<string, ValueOpportunityRecord>;
    valueCaptured: Map<string, ValueCapturedRecord>;
    workflows: Map<string, WorkflowRecord>;
    actions: Map<string, ActionRecord>;
  }): void {
    // 1. Organizations
    store.organizations.set("apex-demo", {
      id: "apex-demo",
      name: "Apex Demo Group",
      displayName: "Apex Demo",
      slug: "apex-demo",
      industry: "financial_services",
      plan: "enterprise",
      currency: "NGN",
      currencySymbol: "₦",
      timezone: "Africa/Lagos",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    });

    store.organizations.set("org-titan-corp", {
      id: "org-titan-corp",
      name: "Titan Global Holdings",
      displayName: "Titan Corp",
      slug: "titan-corp",
      industry: "telecom_energy",
      plan: "enterprise",
      currency: "USD",
      currencySymbol: "$",
      timezone: "America/New_York",
      createdAt: "2026-02-15T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
    });

    // 2. Users
    const ceoCreds = hashPassword("ApexEnterprise2026!");
    const rmCreds = hashPassword("ApexEnterprise2026!");
    const titanCreds = hashPassword("TitanEnterprise2026!");

    store.users.set("usr-marcus-thorne", {
      id: "usr-marcus-thorne",
      email: "m.thorne@apexsync.ai",
      name: "Marcus Thorne",
      title: "Chief Executive Officer",
      status: "active",
      passwordHash: ceoCreds.hash,
      passwordSalt: ceoCreds.salt,
      createdAt: "2026-01-01T00:00:00Z",
    });

    store.users.set("usr-elena-cho", {
      id: "usr-elena-cho",
      email: "e.cho@apexsync.ai",
      name: "Elena Cho",
      title: "VP of Strategic Relationships",
      status: "active",
      passwordHash: rmCreds.hash,
      passwordSalt: rmCreds.salt,
      createdAt: "2026-01-01T00:00:00Z",
    });

    store.users.set("usr-titan-admin", {
      id: "usr-titan-admin",
      email: "admin@titancorp.internal",
      name: "Arthur Vance",
      title: "Chief Operations Officer",
      status: "active",
      passwordHash: titanCreds.hash,
      passwordSalt: titanCreds.salt,
      createdAt: "2026-02-15T00:00:00Z",
    });

    // 3. Memberships
    store.memberships.set("mem-1", {
      id: "mem-1",
      organizationId: "apex-demo",
      userId: "usr-marcus-thorne",
      role: "CEO",
      department: "Executive",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    store.memberships.set("mem-2", {
      id: "mem-2",
      organizationId: "apex-demo",
      userId: "usr-elena-cho",
      role: "Relationship Manager",
      department: "Strategic Accounts",
      joinedAt: "2026-01-01T00:00:00Z",
    });

    store.memberships.set("mem-3", {
      id: "mem-3",
      organizationId: "org-titan-corp",
      userId: "usr-titan-admin",
      role: "Operations",
      department: "Global Ops",
      joinedAt: "2026-02-15T00:00:00Z",
    });

    // 4. Customers — Tenant A
    store.customers.set("cust-dangote", {
      id: "cust-dangote",
      organizationId: "apex-demo",
      name: "Dangote Group Holdings",
      subsidiary: "Dangote Cement & Logistics",
      tier: "Enterprise",
      status: "active",
      healthScore: 92,
      arr: 65000000,
      owner: "Elena Cho",
      contactName: "Alhaji Bello",
      contactRole: "Director of Group Treasury",
      contactEmail: "bello.treasury@dangote-group.com",
      since: "2023-04-12",
      tags: ["Industrial", "Multi-Plant", "Tier-1-SLA"],
      createdAt: "2026-01-10T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    });

    store.customers.set("cust-flour-mills", {
      id: "cust-flour-mills",
      organizationId: "apex-demo",
      name: "Flour Mills of Nigeria",
      subsidiary: "Agro-Allied Processing Division",
      tier: "Enterprise",
      status: "at-risk",
      healthScore: 58,
      arr: 42000000,
      owner: "Elena Cho",
      contactName: "Oluwaseun Adeyemi",
      contactRole: "Chief Technology Officer",
      contactEmail: "o.adeyemi@fmnplc.com",
      since: "2024-01-15",
      tags: ["Agriculture", "Logistics", "Contract-Review-Needed"],
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-08-05T00:00:00Z",
    });

    store.customers.set("cust-access-holdings", {
      id: "cust-access-holdings",
      organizationId: "apex-demo",
      name: "Access Holdings Plc",
      subsidiary: "Banking & Global Payments Tech",
      tier: "Enterprise",
      status: "active",
      healthScore: 95,
      arr: 88000000,
      owner: "Marcus Thorne",
      contactName: "Chidinma Nwosu",
      contactRole: "Head of Infrastructure & Cloud",
      contactEmail: "cnwosu@accessholdings.com",
      since: "2022-11-20",
      tags: ["Fintech", "Payment-Gateway", "Mission-Critical"],
      createdAt: "2026-01-05T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
    });

    // Customer — Tenant B (Titan Corp)
    store.customers.set("cust-titan-energy", {
      id: "cust-titan-energy",
      organizationId: "org-titan-corp",
      name: "Apex North American Power",
      subsidiary: "Grid Operations Unit",
      tier: "Enterprise",
      status: "active",
      healthScore: 88,
      arr: 45000000,
      owner: "Arthur Vance",
      contactName: "Rachel Sterling",
      contactRole: "VP Grid Systems",
      contactEmail: "rsterling@titanenergy.com",
      since: "2025-03-01",
      tags: ["Power", "Strict-Confidential"],
      createdAt: "2026-02-20T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    });

    // 5. Contracts
    store.contracts.set("contract-1", {
      id: "contract-1",
      organizationId: "apex-demo",
      customerId: "cust-dangote",
      title: "Master Industrial Telemetry & Analytics Agreement",
      contractValue: 65000000,
      startDate: "2025-01-01",
      endDate: "2027-01-01",
      renewalDaysRemaining: 145,
      status: "active",
      slaCompliance: 99.4,
      volatilityIndexationClause: true,
      createdAt: "2026-01-10T00:00:00Z",
    });

    store.contracts.set("contract-2", {
      id: "contract-2",
      organizationId: "apex-demo",
      customerId: "cust-flour-mills",
      title: "Enterprise Supply Chain Monitoring Suite",
      contractValue: 42000000,
      startDate: "2024-01-01",
      endDate: "2026-09-30",
      renewalDaysRemaining: 42,
      status: "expiring_soon",
      slaCompliance: 84.1,
      volatilityIndexationClause: false,
      createdAt: "2026-01-15T00:00:00Z",
    });

    store.contracts.set("contract-3", {
      id: "contract-3",
      organizationId: "apex-demo",
      customerId: "cust-access-holdings",
      title: "Core Multi-Rail Payment Orchestration License",
      contractValue: 88000000,
      startDate: "2024-06-01",
      endDate: "2027-06-01",
      renewalDaysRemaining: 310,
      status: "active",
      slaCompliance: 99.9,
      volatilityIndexationClause: true,
      createdAt: "2026-01-05T00:00:00Z",
    });

    // 6. Transactions
    store.transactions.set("txn-1", {
      id: "txn-1",
      organizationId: "apex-demo",
      customerId: "cust-dangote",
      type: "revenue",
      amount: 16250000,
      currency: "NGN",
      status: "cleared",
      reference: "INV-2026-Q2-DNG",
      category: "Subscription",
      date: "2026-07-01",
      createdAt: "2026-07-01T00:00:00Z",
    });

    store.transactions.set("txn-2", {
      id: "txn-2",
      organizationId: "apex-demo",
      customerId: "cust-access-holdings",
      type: "revenue",
      amount: 22000000,
      currency: "NGN",
      status: "cleared",
      reference: "INV-2026-Q2-ACC",
      category: "Subscription",
      date: "2026-07-05",
      createdAt: "2026-07-05T00:00:00Z",
    });

    store.transactions.set("txn-3", {
      id: "txn-3",
      organizationId: "apex-demo",
      customerId: "cust-flour-mills",
      type: "cost",
      amount: 8500000,
      currency: "NGN",
      status: "cleared",
      reference: "EXP-INFRA-AUG",
      category: "Infrastructure Hosting",
      date: "2026-08-01",
      createdAt: "2026-08-01T00:00:00Z",
    });

    // 7. Documents — Tenant A
    store.documents.set("doc-1", {
      id: "doc-1",
      organizationId: "apex-demo",
      customerId: "cust-dangote",
      name: "Dangote_Master_Agreement_2025_2027.pdf",
      fileType: "pdf",
      category: "Contract",
      size: "4.2 MB",
      uploadedBy: "Elena Cho",
      storageKey: "documents/apex-demo/cust-dangote/contract-2025.pdf",
      status: "indexed",
      metadata: {
        pageCount: 38,
        fileSizeBytes: 4404019,
        mimeType: "application/pdf",
        storageUri: "blob://tenants/apex-demo/docs/doc-1.bin",
        extractedAt: "2026-01-11T10:00:00Z",
      },
      aiSummary: "Master multi-year telemetry contract with Dangote Group covering 4 industrial locations with quarterly indexation reviews.",
      extractedFields: [
        { label: "Annual Contract Value", value: "₦65,000,000", confidence: 99 },
        { label: "Governing Law", value: "Laws of the Federal Republic of Nigeria", confidence: 100 },
        { label: "Indexation Review", value: "Quarterly based on CBN FX corridor", confidence: 95 },
      ],
      tags: ["Contract", "Dangote", "Active"],
      createdAt: "2026-01-11T09:00:00Z",
      updatedAt: "2026-01-11T10:00:00Z",
    });

    store.documents.set("doc-2", {
      id: "doc-2",
      organizationId: "apex-demo",
      customerId: "cust-flour-mills",
      name: "FlourMills_SLA_Renewal_Notice.pdf",
      fileType: "pdf",
      category: "SLA Agreement",
      size: "1.8 MB",
      uploadedBy: "Elena Cho",
      storageKey: "documents/apex-demo/cust-flour-mills/sla-notice.pdf",
      status: "indexed",
      metadata: {
        pageCount: 12,
        fileSizeBytes: 1887436,
        mimeType: "application/pdf",
        storageUri: "blob://tenants/apex-demo/docs/doc-2.bin",
        extractedAt: "2026-01-16T12:00:00Z",
      },
      aiSummary: "Renewal notice citing lack of automated indexation and requesting revised dunning terms before Q3 close.",
      extractedFields: [
        { label: "Notice Period", value: "60 Days", confidence: 98 },
        { label: "Pending Clause", value: "Non-indexed fixed rate 2024", confidence: 94 },
      ],
      tags: ["SLA", "Renewal", "At-Risk"],
      createdAt: "2026-01-16T11:00:00Z",
      updatedAt: "2026-01-16T12:00:00Z",
    });

    // 8. Knowledge Items — Tenant A
    store.knowledge.set("know-1", {
      id: "know-1",
      organizationId: "apex-demo",
      title: "CBN FX Volatility Indexation Playbook",
      category: "Financial Regulation",
      content: "All enterprise contracts exceeding ₦50M must incorporate clause 14.2 indexing payments to official CBN closing rates if the FX band shifts by >5% in any quarter.",
      summary: "Regulatory guide for FX contract indexation clauses in Nigerian multi-year enterprise contracts.",
      author: "Marcus Thorne",
      tags: ["CBN", "Treasury", "Compliance", "Pricing"],
      isPublicPlatformKnowledge: false,
      version: 1,
      createdAt: "2026-01-05T00:00:00Z",
      updatedAt: "2026-01-05T00:00:00Z",
    });

    store.knowledge.set("know-2", {
      id: "know-2",
      organizationId: "apex-demo",
      title: "Automated Dunning & Invoicing Recovery Standard",
      category: "Playbook",
      content: "When failed card or billing telemetry is detected on accounts >₦10M, activate intelligent retry within 48h and trigger dedicated Relationship Manager notification.",
      summary: "Operational playbook for mitigating revenue leakage from payment gateway rejections.",
      author: "Elena Cho",
      tags: ["Billing", "Recovery", "Operations"],
      isPublicPlatformKnowledge: false,
      version: 1,
      createdAt: "2026-01-10T00:00:00Z",
      updatedAt: "2026-01-10T00:00:00Z",
    });

    // 9. Workflows — Tenant A
    store.workflows.set("wf-1", {
      id: "wf-1",
      organizationId: "apex-demo",
      name: "Automated Dunning & Leakage Recovery Pipeline",
      description: "Monitors payment failures across corporate billing gateways and executes smart retry loops with human-in-the-loop approvals for >₦5M invoices.",
      subsidiary: "Group Finance & Operations",
      status: "active",
      version: 1,
      nodes: [
        {
          id: "node-1",
          type: "trigger",
          title: "Failed Billing Signal Detected",
          configuration: { source: "payment_gateway", threshold: 1000000 },
          position: { x: 50, y: 100 },
        },
        {
          id: "node-2",
          type: "condition",
          title: "Evaluate Invoice Exposure",
          configuration: { field: "amount", operator: "greater_than", value: 5000000 },
          position: { x: 250, y: 100 },
        },
        {
          id: "node-3",
          type: "human_approval",
          title: "Require CFO / RM Approval",
          configuration: { approverRole: "CEO", timeoutHours: 24 },
          position: { x: 450, y: 50 },
        },
        {
          id: "node-4",
          type: "action",
          title: "Dispatch Smart Dunning Protocol",
          configuration: { retryCount: 3, channel: "direct_api" },
          position: { x: 650, y: 100 },
        },
      ],
      connections: [
        { id: "conn-1", fromNodeId: "node-1", toNodeId: "node-2" },
        { id: "conn-2", fromNodeId: "node-2", toNodeId: "node-3", conditionLabel: "High Value (>₦5M)" },
        { id: "conn-3", fromNodeId: "node-3", toNodeId: "node-4" },
      ],
      runsCount: 14,
      successRate: 92.8,
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    });

    // 10. Signals — Tenant A
    store.signals.set("sig-1", {
      id: "sig-1",
      organizationId: "apex-demo",
      category: "revenue",
      severity: "high",
      title: "Unindexed FX Volatility on Flour Mills Contract",
      description: "Contract-2 lacks CBN FX indexation clause while import operational expenses rose by 14.2%.",
      evidence: "Verified via Doc-2 and Contract-2 records: 42 days until expiration.",
      estimatedFinancialImpact: 14500000,
      status: "active",
      detectedAt: "2026-08-01T10:00:00Z",
    });

    store.signals.set("sig-2", {
      id: "sig-2",
      organizationId: "apex-demo",
      category: "capacity",
      severity: "medium",
      title: "Idle Compute Node Cluster in West Africa Hub",
      description: "Dedicated node cluster allocated for regional clearing running at only 35% utilization.",
      evidence: "Infrastructure telemetry logs show 650 unallocated node-hours in July 2026.",
      estimatedFinancialImpact: 9200000,
      status: "active",
      detectedAt: "2026-08-03T14:00:00Z",
    });

    // 11. Value Opportunities — Tenant A
    store.opportunities.set("opp-1", {
      id: "opp-1",
      organizationId: "apex-demo",
      title: "Automate Commercial FX Sweep Matching",
      category: "Revenue recovery",
      potentialValue: 24500000,
      confidence: 94,
      evidence: "Analysis of 3 active enterprise contracts and CBN closing spread telemetry.",
      sourceEntityId: "contract-2",
      sourceEntityType: "Contract",
      recommendedAction: "Deploy automated indexation sweep protocol on expiring contract renewals.",
      expectedOutcome: "Recover ₦24.5M in uncaptured currency arbitrage.",
      realizationSpeed: "Fastest",
      strategicImportance: "High",
      risk: "Low",
      status: "Approved",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
    });

    store.opportunities.set("opp-2", {
      id: "opp-2",
      organizationId: "apex-demo",
      title: "Dangote Group Multi-Plant Telemetry Expansion",
      category: "Customer expansion",
      potentialValue: 35000000,
      confidence: 88,
      evidence: "Customer health score 92 with 4 new plant logistics hubs coming online in Q3.",
      sourceEntityId: "cust-dangote",
      sourceEntityType: "Customer",
      recommendedAction: "Deliver executive value proposal for Group-wide real-time fleet analytics.",
      expectedOutcome: "Increase annual recurring revenue by ₦35.0M.",
      realizationSpeed: "Medium",
      strategicImportance: "High",
      risk: "Low",
      status: "Validated",
      createdAt: "2026-08-02T00:00:00Z",
      updatedAt: "2026-08-08T00:00:00Z",
    });

    // 12. Value Captured Records — Tenant A
    store.valueCaptured.set("cap-1", {
      id: "cap-1",
      organizationId: "apex-demo",
      opportunityId: "opp-1",
      opportunityTitle: "CBN Daily Liquidity Float Optimization",
      category: "Revenue recovered",
      capturedValue: 18200000,
      evidenceType: "Audited Ledger Reconciliation",
      evidenceDescription: "Reconciled treasury sweep matching CBN clearing window for July 2026.",
      realizationDate: "2026-07-31",
      certifiedBy: "Marcus Thorne (CEO)",
      auditTrail: [
        "Identified by Value Intelligence scan on 2026-06-15",
        "Approved by Executive committee on 2026-06-20",
        "Executed via Treasury workflow on 2026-07-01",
        "Audited & verified on 2026-07-31",
      ],
      createdAt: "2026-08-01T00:00:00Z",
    });

    // 13. Organizational Memory — Tenant A
    store.memory.set("mem-fact-1", {
      id: "mem-fact-1",
      organizationId: "apex-demo",
      type: "decision",
      title: "FY26 Enterprise Contract Pricing Thresholds",
      content: "Executive decision: Minimum ARR for dedicated SLA support set at ₦40,000,000 with mandatory quarterly review.",
      source: "Executive Committee Meeting Minutes",
      sourceReference: "doc-1",
      confidence: 100,
      effectiveAt: "2026-01-01T00:00:00Z",
      verified: true,
      createdAt: "2026-01-02T00:00:00Z",
    });

    // 14. Execution Actions — Tenant A
    store.actions.set("act-1", {
      id: "act-1",
      organizationId: "apex-demo",
      recommendation: "Execute Flour Mills Contract Renewal with FX Indexation Clause",
      owner: "Elena Cho",
      deadline: "2026-08-28",
      expectedValue: 14500000,
      status: "Approved",
      confidence: 94,
      automationType: "AI-assisted",
      requiresHumanApproval: true,
      insightSource: "Signal-1: Unindexed FX Volatility on Flour Mills Contract",
      decisionDetail: "Approved by CEO Marcus Thorne on Aug 10, 2026.",
      resultMetric: "Contract renewal with +12% indexation floor",
      approvedBy: "Marcus Thorne",
      logs: [
        "2026-08-01: Action recommended from telemetry scan.",
        "2026-08-10: Approved by Marcus Thorne.",
      ],
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
    });
  }
}
