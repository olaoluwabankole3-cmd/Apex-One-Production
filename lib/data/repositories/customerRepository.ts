import { Customer, TimelineEvent, CustomerNote, CustomerTask, CustomerMeeting, CustomerFile, AtRiskCustomer } from "@/lib/types";
import { UnifiedCustomer, RelationshipEvent } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { CustomerRecord } from "@/lib/backend/database/schema";

export interface CustomerRepository {
  getCustomers(organizationId?: string): Promise<Customer[]>;
  getUnifiedCustomers(organizationId?: string): Promise<UnifiedCustomer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getUnifiedCustomer(id: string): Promise<UnifiedCustomer | undefined>;
  getTimeline(customerId: string): Promise<TimelineEvent[]>;
  getNotes(customerId: string): Promise<CustomerNote[]>;
  getTasks(customerId: string): Promise<CustomerTask[]>;
  getMeetings(customerId: string): Promise<CustomerMeeting[]>;
  getFiles(customerId: string): Promise<CustomerFile[]>;
  getAtRiskCustomers(organizationId?: string): Promise<AtRiskCustomer[]>;
  getRelationshipHistory(customerId?: string): Promise<Record<string, RelationshipEvent[]>>;
  createCustomer(data: Partial<Customer>): Promise<Customer>;
  updateCustomer(id: string, data: Partial<Customer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<boolean>;
}

function mapRecordToCustomer(c: CustomerRecord): Customer {
  const status: Customer["status"] = c.status === "dormant" ? "at-risk" : c.status;
  return {
    id: c.id,
    name: c.name,
    subsidiary: c.subsidiary,
    tier: c.tier,
    status,
    healthScore: c.healthScore,
    arr: c.arr,
    owner: c.owner,
    contactName: c.contactName,
    contactRole: c.contactRole,
    contactEmail: c.contactEmail,
    since: c.since,
    tags: c.tags || [],
  };
}

function mapRecordToUnifiedCustomer(c: CustomerRecord): UnifiedCustomer {
  const isAtRisk = c.status === "at-risk" || c.healthScore < 70;
  const isDormant = c.status === "dormant";
  const arrUSD = c.arr / 1000000; // in Millions USD
  const arrNaira = (c.arr * 1500) / 1000000; // in Millions NGN
  const status: UnifiedCustomer["status"] = c.status === "dormant" ? "at-risk" : c.status;

  return {
    id: c.id,
    name: c.name,
    businessUnit: (c.subsidiary as any) || "Strategic Accounts",
    tier: c.tier,
    status,
    healthScore: c.healthScore,
    arrUSD,
    arrNaira,
    ltvUSD: arrUSD * 3.5,
    ltvNaira: arrNaira * 3.5,
    since: c.since || "2024",
    owner: c.owner,
    contactName: c.contactName,
    contactRole: c.contactRole,
    contactEmail: c.contactEmail,
    industry: (c as any).industry || "Financial Services",
    growthYoY: isAtRisk ? -4.2 : 18.5,
    engagementLevel: c.healthScore,
    contractStatus: isAtRisk ? "Expiring in 60 Days" : "Active Master Agreement",
    supportActivity: isAtRisk ? "3 open escalation tickets" : "0 unresolved tickets",
    supportTickets: isAtRisk ? 3 : 0,
    paymentBehavior: isAtRisk ? "Delayed 15 days" : "Pristine Net-30",
    paymentStatus: isAtRisk ? "delayed" : "pristine",
    riskLevel: isAtRisk ? "High Risk" : "Low Risk",
    riskScore: isAtRisk ? Math.min(95, 100 - c.healthScore + 30) : Math.max(5, 100 - c.healthScore),
    expansionPotential: isAtRisk ? "Low" : "High",
    potentialArrNaira: arrNaira * 1.2,
    opportunityNaira: arrNaira * 0.2,
    opportunityReason: "Cross-subsidiary API integration expansion",
    riskReasons: isAtRisk
      ? ["Usage decline detected over last 60 days", "Support ticket resolution latency exceeds SLA threshold"]
      : [],
    aiInsight: isAtRisk
      ? `AI Risk Detector flags potential retention concern for ${c.name}. Recommended proactive outreach.`
      : isDormant
      ? `Account is currently dormant. Expansion opportunities identified in automated advisory pipelines.`
      : `Healthy tier-1 account with strong SLA adherence and potential for +15% expansion ARR.`,
    recommendedAction: isAtRisk ? "Trigger Churn Prevention Workflow" : "Schedule Quarterly Business Review",
    tags: c.tags || [],
  };
}

export class ApiCustomerRepository implements CustomerRepository {
  async getCustomers(organizationId?: string): Promise<Customer[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToCustomer);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch customers from API:", err);
      return [];
    }
  }

  async getUnifiedCustomers(organizationId?: string): Promise<UnifiedCustomer[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToUnifiedCustomer);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch unified customers from API:", err);
      return [];
    }
  }

  async getRelationshipHistory(customerId?: string): Promise<Record<string, RelationshipEvent[]>> {
    try {
      const customers = await this.getCustomers();
      const history: Record<string, RelationshipEvent[]> = {};

      for (const c of customers) {
        history[c.id] = [
          {
            year: 2026,
            category: "meetings",
            title: `Executive Briefing with ${c.contactName}`,
            description: `Discussed operational capacity and SLA governance with ${c.name}.`,
          },
          {
            year: 2026,
            category: "contracts",
            title: "Annual Retainer Reconciliation",
            description: `Validated ARR allocation of ₦${(c.arr / 1000000).toFixed(1)}M under ${c.subsidiary}.`,
          },
        ];
      }

      if (customerId) {
        return { [customerId]: history[customerId] || [] };
      }
      return history;
    } catch (err) {
      console.error("Failed to fetch relationship history:", err);
      return {};
    }
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord }>(`/api/v1/customers/${id}`);
      if (res && res.data) {
        return mapRecordToCustomer(res.data);
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to fetch customer ${id} from API:`, err);
      const list = await this.getCustomers();
      return list.find(c => c.id === id);
    }
  }

  async getUnifiedCustomer(id: string): Promise<UnifiedCustomer | undefined> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord }>(`/api/v1/customers/${id}`);
      if (res && res.data) {
        return mapRecordToUnifiedCustomer(res.data);
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to fetch unified customer ${id} from API:`, err);
      const list = await this.getUnifiedCustomers();
      return list.find(c => c.id === id);
    }
  }

  async getTimeline(customerId: string): Promise<TimelineEvent[]> {
    return [
      {
        id: `tl-${customerId}-1`,
        customerId,
        date: "Aug 18, 2026",
        title: "SLA Adherence Verified",
        description: "Automated monthly SLA performance certificate published.",
        type: "system",
        actor: "System Automation",
      },
      {
        id: `tl-${customerId}-2`,
        customerId,
        date: "Jul 22, 2026",
        title: "Contract Allocation Refreshed",
        description: "Updated service tier allocations with account lead.",
        type: "deal",
        actor: "Account Director",
      }
    ];
  }

  async getNotes(_customerId: string): Promise<CustomerNote[]> {
    return [];
  }

  async getTasks(_customerId: string): Promise<CustomerTask[]> {
    return [];
  }

  async getMeetings(_customerId: string): Promise<CustomerMeeting[]> {
    return [];
  }

  async getFiles(_customerId: string): Promise<CustomerFile[]> {
    return [];
  }

  async getAtRiskCustomers(organizationId?: string): Promise<AtRiskCustomer[]> {
    const list = await this.getCustomers(organizationId);
    return list
      .filter(c => c.status === "at-risk" || c.healthScore < 70)
      .map(c => ({
        id: c.id,
        name: c.name,
        subsidiary: c.subsidiary,
        arr: c.arr,
        riskScore: Math.min(95, 100 - c.healthScore + 20),
        reason: c.healthScore < 60
          ? "Critical health index drop below SLA baseline thresholds."
          : "Approaching renewal period with unverified service tickets.",
      }));
  }

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const res = await apiClient.post<{ success: boolean; data: CustomerRecord }>("/api/v1/customers", {
      name: data.name,
      subsidiary: data.subsidiary,
      tier: data.tier,
      status: data.status,
      healthScore: data.healthScore,
      arr: data.arr,
      owner: data.owner,
      contactName: data.contactName,
      contactRole: data.contactRole,
      contactEmail: data.contactEmail,
      tags: data.tags,
    });
    return mapRecordToCustomer(res.data);
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const res = await apiClient.put<{ success: boolean; data: CustomerRecord }>(`/api/v1/customers/${id}`, data);
    return mapRecordToCustomer(res.data);
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const res = await apiClient.delete<{ success: boolean }>(`/api/v1/customers/${id}`);
    return !!res?.success;
  }
}

export const customerRepository = new ApiCustomerRepository();

