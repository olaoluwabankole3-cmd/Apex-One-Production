import { Customer, TimelineEvent, CustomerNote, CustomerTask, CustomerMeeting, CustomerFile, AtRiskCustomer, UnifiedCustomer, RelationshipEvent } from "@/lib/types";
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
    subsidiary: c.subsidiary ?? "",
    tier: c.tier,
    status,
    healthScore: c.healthScore,
    arr: c.arr,
    owner: c.owner,
    contactName: c.contactName,
    contactRole: c.contactRole,
    contactEmail: c.contactEmail,
    since: c.since ?? null,
    tags: c.tags || [],
    riskScore: c.riskScore ?? null,
    riskReason: c.riskReason ?? null,
  };
}

function mapRecordToUnifiedCustomer(c: CustomerRecord): UnifiedCustomer {
  const status: UnifiedCustomer["status"] = c.status === "dormant" ? "at-risk" : c.status;

  return {
    id: c.id,
    name: c.name,
    businessUnit: c.subsidiary ?? null,
    tier: c.tier,
    status,
    healthScore: c.healthScore,
    arr: c.arr,
    arrUSD: null,
    arrNaira: null,
    ltvUSD: null,
    ltvNaira: null,
    since: c.since ?? null,
    owner: c.owner,
    contactName: c.contactName,
    contactRole: c.contactRole,
    contactEmail: c.contactEmail,
    industry: c.industry ?? null,
    growthYoY: c.growthYoY ?? null,
    engagementLevel: c.engagementLevel ?? null,
    contractStatus: c.contractStatus ?? null,
    supportActivity: c.supportActivity ?? null,
    supportTickets: c.supportTickets ?? null,
    paymentBehavior: c.paymentBehavior ?? null,
    paymentStatus: c.paymentStatus ?? null,
    riskLevel: c.riskLevel ?? null,
    riskScore: c.riskScore ?? null,
    expansionPotential: c.expansionPotential ?? null,
    potentialArrNaira: c.potentialArrNaira ?? null,
    opportunityNaira: c.opportunityNaira ?? null,
    opportunityReason: c.opportunityReason ?? null,
    riskReasons: c.riskReasons ?? [],
    aiInsight: c.aiInsight ?? null,
    recommendedAction: c.recommendedAction ?? null,
    tags: c.tags || [],
  };
}

export class ApiCustomerRepository implements CustomerRepository {
  async getCustomers(organizationId?: string): Promise<Customer[]> {
    const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
    if (res && Array.isArray(res.data)) {
      return res.data.map(mapRecordToCustomer);
    }
    return [];
  }

  async getUnifiedCustomers(organizationId?: string): Promise<UnifiedCustomer[]> {
    const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
    if (res && Array.isArray(res.data)) {
      return res.data.map(mapRecordToUnifiedCustomer);
    }
    return [];
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
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes("404") || err?.message?.toLowerCase().includes("not found")) {
        return undefined;
      }
      throw err;
    }
  }

  async getUnifiedCustomer(id: string): Promise<UnifiedCustomer | undefined> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord }>(`/api/v1/customers/${id}`);
      if (res && res.data) {
        return mapRecordToUnifiedCustomer(res.data);
      }
      return undefined;
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes("404") || err?.message?.toLowerCase().includes("not found")) {
        return undefined;
      }
      throw err;
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
        riskScore: c.riskScore ?? null,
        reason: c.riskReason ?? null,
        filterMatchReason:
          c.status === "at-risk"
            ? "Account status flagged at-risk"
            : c.healthScore < 70
            ? "Health score below 70 threshold"
            : undefined,
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

