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
    ltvUSD: arrUSD,
    ltvNaira: arrNaira,
    since: c.since || "2024",
    owner: c.owner,
    contactName: c.contactName,
    contactRole: c.contactRole,
    contactEmail: c.contactEmail,
    industry: (c as any).industry || "Enterprise",
    growthYoY: 0,
    engagementLevel: c.healthScore,
    contractStatus: "Active",
    supportActivity: "Not available",
    supportTickets: 0,
    paymentBehavior: "Not available",
    paymentStatus: "standard",
    riskLevel: isAtRisk ? "At Risk" : "Healthy",
    riskScore: Math.max(0, 100 - c.healthScore),
    expansionPotential: "Low",
    potentialArrNaira: arrNaira,
    opportunityNaira: 0,
    opportunityReason: "Not available",
    riskReasons: isAtRisk ? ["Account health score below target threshold"] : [],
    aiInsight: isAtRisk ? "Account health score is below the target threshold." : "",
    recommendedAction: isAtRisk ? "Review account health" : "No action required",
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
    // Relationship event history requires a dedicated customer audit/activity endpoint
    return {};
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

  async getTimeline(_customerId: string): Promise<TimelineEvent[]> {
    return [];
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
        riskScore: Math.max(0, 100 - c.healthScore),
        reason: "Customer health score below baseline threshold",
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

