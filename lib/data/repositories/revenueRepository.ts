import { KpiDatum, RevenuePoint, PortfolioSlice, SubsidiaryRevenuePoint, RevenueBySubsidiaryPoint, CustomerGrowthPoint, SegmentBreakdown, SubsidiaryPerformance, AnalyticsSummaryStats } from "@/lib/types";
import { apiClient } from "@/lib/apiClient";
import { CustomerRecord } from "@/lib/backend/database/schema";

export interface RevenueRepository {
  getKpis(organizationId?: string): Promise<KpiDatum[]>;
  getRevenueSeries(organizationId?: string): Promise<RevenuePoint[]>;
  getPortfolioBreakdown(organizationId?: string): Promise<PortfolioSlice[]>;
  getRevenueBySubsidiary(organizationId?: string): Promise<SubsidiaryRevenuePoint[]>;
  getRevenueBySubsidiaryMonthly(organizationId?: string): Promise<RevenueBySubsidiaryPoint[]>;
  getCustomerGrowth(organizationId?: string): Promise<CustomerGrowthPoint[]>;
  getSegmentBreakdown(organizationId?: string): Promise<SegmentBreakdown[]>;
  getSubsidiaryPerformance(organizationId?: string): Promise<SubsidiaryPerformance[]>;
  getAnalyticsStats(organizationId?: string): Promise<AnalyticsSummaryStats>;
}

export class ApiRevenueRepository implements RevenueRepository {
  async getKpis(_organizationId?: string): Promise<KpiDatum[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      const customers = res?.data || [];
      const totalArrUSD = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
      const totalArrM = (totalArrUSD / 1000000).toFixed(1);
      const atRiskCount = customers.filter(c => c.status === "at-risk" || c.healthScore < 70).length;

      const totalArrVal = parseFloat(totalArrM) || 0;
      const avgHealth = customers.length ? Math.round(customers.reduce((s, c) => s + c.healthScore, 0) / customers.length) : 0;

      return [
        {
          id: "kpi-arr",
          label: "Total Group ARR",
          value: totalArrVal,
          prefix: "$",
          suffix: "M",
          decimals: 1,
          delta: 0,
          deltaLabel: "Live Portfolio",
          trend: "flat",
          sparkline: [],
          roles: ["CEO", "Relationship Manager", "Operations"],
        },
        {
          id: "kpi-accounts",
          label: "Active Enterprise Accounts",
          value: customers.length,
          decimals: 0,
          delta: 0,
          deltaLabel: "Live Portfolio",
          trend: "flat",
          sparkline: [],
          roles: ["CEO", "Relationship Manager"],
        },
        {
          id: "kpi-health",
          label: "Average Health Score",
          value: avgHealth,
          suffix: "%",
          decimals: 0,
          delta: 0,
          deltaLabel: "Live Index",
          trend: "flat",
          sparkline: [],
          roles: ["CEO", "Customer Service", "Relationship Manager"],
        },
        {
          id: "kpi-risk",
          label: "At-Risk Exposure",
          value: atRiskCount,
          suffix: " Accounts",
          decimals: 0,
          delta: 0,
          deltaLabel: atRiskCount > 0 ? "Action required" : "Zero flagged",
          trend: atRiskCount > 0 ? "down" : "flat",
          sparkline: [],
          roles: ["CEO", "Compliance", "Relationship Manager"],
        },
      ];
    } catch (err) {
      console.error("Failed to load KPIs:", err);
      return [];
    }
  }

  async getRevenueSeries(_organizationId?: string): Promise<RevenuePoint[]> {
    // BACKEND CAPABILITY REQUIRED: Historical monthly revenue time-series service
    return [];
  }

  async getPortfolioBreakdown(_organizationId?: string): Promise<PortfolioSlice[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      const customers = res?.data || [];
      const subMap: Record<string, number> = {};

      for (const c of customers) {
        const sub = c.subsidiary || "Strategic Accounts";
        subMap[sub] = (subMap[sub] || 0) + (c.arr || 0);
      }

      const colors = ["#C9A961", "#8E6A2B", "#4A8068", "#9B4E4E", "#607274"];
      return Object.entries(subMap).map(([name, val], i) => ({
        name,
        value: Math.round(val / 1000000),
        color: colors[i % colors.length],
      }));
    } catch (err) {
      console.error("Failed to load portfolio breakdown:", err);
      return [];
    }
  }

  async getRevenueBySubsidiary(_organizationId?: string): Promise<SubsidiaryRevenuePoint[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      const customers = res?.data || [];
      const subMap: Record<string, number> = {};

      for (const c of customers) {
        const sub = c.subsidiary || "Strategic Accounts";
        subMap[sub] = (subMap[sub] || 0) + (c.arr || 0);
      }

      return Object.entries(subMap).map(([name, val]) => ({
        name,
        revenue: +(val / 1000000).toFixed(1),
        target: +(val / 1000000).toFixed(1),
        margin: 0,
      }));
    } catch (err) {
      console.error("Failed to load revenue by subsidiary:", err);
      return [];
    }
  }

  async getRevenueBySubsidiaryMonthly(_organizationId?: string): Promise<RevenueBySubsidiaryPoint[]> {
    return [];
  }

  async getCustomerGrowth(_organizationId?: string): Promise<CustomerGrowthPoint[]> {
    return [];
  }

  async getSegmentBreakdown(_organizationId?: string): Promise<SegmentBreakdown[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      const customers = res?.data || [];
      const ent = customers.filter(c => c.tier === "Enterprise");
      const mid = customers.filter(c => c.tier === "Mid-Market");
      const smb = customers.filter(c => c.tier === "SMB");

      return [
        { segment: "Enterprise", arr: +(ent.reduce((s, c) => s + (c.arr || 0), 0) / 1000000).toFixed(1), customers: ent.length, color: "#C9A961" },
        { segment: "Mid-Market", arr: +(mid.reduce((s, c) => s + (c.arr || 0), 0) / 1000000).toFixed(1), customers: mid.length, color: "#8E6A2B" },
        { segment: "SMB", arr: +(smb.reduce((s, c) => s + (c.arr || 0), 0) / 1000000).toFixed(1), customers: smb.length, color: "#4A8068" },
      ];
    } catch (err) {
      console.error("Failed to load segment breakdown:", err);
      return [];
    }
  }

  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }

  async getAnalyticsStats(_organizationId?: string): Promise<AnalyticsSummaryStats> {
    try {
      const res = await apiClient.get<{ success: boolean; data: CustomerRecord[] }>("/api/v1/customers");
      const customers = res?.data || [];
      const totalRevenue = +(customers.reduce((s, c) => s + (c.arr || 0), 0) / 1000000).toFixed(1);
      return {
        totalRevenue,
        netNewArr: 0,
        netRevenueRetention: 100,
        grossChurnRate: 0,
      };
    } catch (err) {
      return {
        totalRevenue: 0,
        netNewArr: 0,
        netRevenueRetention: 100,
        grossChurnRate: 0,
      };
    }
  }
}

export const revenueRepository = new ApiRevenueRepository();

