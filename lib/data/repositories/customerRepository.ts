import { Customer, TimelineEvent, CustomerNote, CustomerTask, CustomerMeeting, CustomerFile, AtRiskCustomer } from "@/lib/types";
import { demoCustomers, UnifiedCustomer, RelationshipEvent, demoRelationshipHistory } from "@/lib/data/demo";

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
}

export class MockCustomerRepository implements CustomerRepository {
  async getCustomers(_organizationId?: string): Promise<Customer[]> {
    return demoCustomers.map(c => ({
      id: c.id,
      name: c.name,
      subsidiary: c.businessUnit,
      tier: c.tier,
      status: c.status,
      healthScore: c.healthScore,
      arr: c.arrUSD,
      owner: c.owner,
      contactName: c.contactName,
      contactRole: c.contactRole,
      contactEmail: c.contactEmail,
      since: c.since,
      tags: c.tags || []
    }));
  }

  async getUnifiedCustomers(_organizationId?: string): Promise<UnifiedCustomer[]> {
    return demoCustomers;
  }

  async getRelationshipHistory(customerId?: string): Promise<Record<string, RelationshipEvent[]>> {
    if (customerId) {
      return { [customerId]: demoRelationshipHistory[customerId] || [] };
    }
    return demoRelationshipHistory;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const list = await this.getCustomers();
    return list.find(c => c.id === id);
  }

  async getUnifiedCustomer(id: string): Promise<UnifiedCustomer | undefined> {
    return demoCustomers.find(c => c.id === id);
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

  async getAtRiskCustomers(_organizationId?: string): Promise<AtRiskCustomer[]> {
    return demoCustomers
      .filter(c => c.status === "at-risk")
      .map(c => ({
        id: c.id,
        name: c.name,
        subsidiary: c.businessUnit,
        arr: c.arrUSD,
        riskScore: c.riskScore,
        reason: c.riskReasons[0] || c.aiInsight
      }));
  }
}

export const customerRepository = new MockCustomerRepository();
