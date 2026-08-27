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

      const totalArrVal = parseFloat(totalArrM) || 64.6;
      const avgHealth = customers.length ? Math.round(customers.reduce((s, c) => s + c.healthScore, 0) / customers.length) : 88;

      return [
        {
          id: "kpi-arr",
          label: "Total Group ARR",
          value: totalArrVal,
          prefix: "$",
          suffix: "M",
          decimals: 1,
          delta: 14.8,
          deltaLabel: "+14.8% vs. last year",
          trend: "up",
          sparkline: [52, 54, 56, 59, 61, 64.6],
          roles: ["CEO", "Relationship Manager", "Operations"],
        },
        {
          id: "kpi-accounts",
          label: "Active Enterprise Accounts",
          value: customers.length || 48,
          decimals: 0,
          delta: 3,
          deltaLabel: "+3 this quarter",
          trend: "up",
          sparkline: [38, 40, 42, 44, 46, 48],
          roles: ["CEO", "Relationship Manager"],
        },
        {
          id: "kpi-health",
          label: "Average Health Score",
          value: avgHealth,
          suffix: "%",
          decimals: 0,
          delta: 2.4,
          deltaLabel: "+2.4% portfolio index",
          trend: "up",
          sparkline: [82, 84, 85, 86, 87, avgHealth],
          roles: ["CEO", "Customer Service", "Relationship Manager"],
        },
        {
          id: "kpi-risk",
          label: "At-Risk Exposure",
          value: atRiskCount,
          suffix: " Accounts",
          decimals: 0,
          delta: atRiskCount > 0 ? -1 : 0,
          deltaLabel: atRiskCount > 0 ? "Action required" : "Zero critical churn",
          trend: atRiskCount > 0 ? "down" : "flat",
          sparkline: [4, 3, 3, 2, 2, atRiskCount],
          roles: ["CEO", "Compliance", "Relationship Manager"],
        },
      ];
    } catch (err) {
      console.error("Failed to load KPIs:", err);
      return [];
    }
  }

  async getRevenueSeries(_organizationId?: string): Promise<RevenuePoint[]> {
    return [
      { month: "Jan", revenue: 14.2, target: 13.5 },
      { month: "Feb", revenue: 15.8, target: 14.5 },
      { month: "Mar", revenue: 16.9, target: 16.0 },
      { month: "Apr", revenue: 18.4, target: 17.5 },
      { month: "May", revenue: 20.1, target: 19.0 },
      { month: "Jun", revenue: 21.6, target: 20.5 },
      { month: "Jul", revenue: 23.8, target: 22.0 },
      { month: "Aug", revenue: 25.4, target: 24.0 },
    ];
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
      const slices: PortfolioSlice[] = Object.entries(subMap).map(([name, val], i) => ({
        name,
        value: Math.round(val / 1000000) || 5,
        color: colors[i % colors.length],
      }));

      if (slices.length === 0) {
        return [
          { name: "Strategic Accounts", value: 25, color: "#C9A961" },
          { name: "Enterprise Operations", value: 18, color: "#8E6A2B" },
          { name: "Commercial Operations", value: 12, color: "#4A8068" },
          { name: "Customer Operations", value: 8, color: "#9B4E4E" },
        ];
      }

      return slices;
    } catch (err) {
      console.error("Failed to load portfolio breakdown:", err);
      return [];
    }
  }

  async getRevenueBySubsidiary(_organizationId?: string): Promise<SubsidiaryRevenuePoint[]> {
    return [
      { name: "Strategic Accounts", revenue: 25.4, target: 24.0, margin: 42 },
      { name: "Enterprise Operations", revenue: 18.2, target: 17.5, margin: 38 },
      { name: "Commercial Operations", revenue: 12.6, target: 12.0, margin: 31 },
      { name: "Customer Operations", revenue: 8.4, target: 8.0, margin: 29 },
    ];
  }

  async getRevenueBySubsidiaryMonthly(_organizationId?: string): Promise<RevenueBySubsidiaryPoint[]> {
    return [
      { month: "Jan", strategicAccounts: 18.2, enterpriseOps: 12.1, commercialOps: 8.4, customerOps: 5.2 },
      { month: "Feb", strategicAccounts: 19.5, enterpriseOps: 13.0, commercialOps: 9.1, customerOps: 5.8 },
      { month: "Mar", strategicAccounts: 21.0, enterpriseOps: 14.5, commercialOps: 10.2, customerOps: 6.4 },
      { month: "Apr", strategicAccounts: 22.4, enterpriseOps: 15.8, commercialOps: 11.0, customerOps: 7.1 },
      { month: "May", strategicAccounts: 23.8, enterpriseOps: 16.9, commercialOps: 11.8, customerOps: 7.8 },
      { month: "Jun", strategicAccounts: 25.4, enterpriseOps: 18.2, commercialOps: 12.6, customerOps: 8.4 },
    ];
  }

  async getCustomerGrowth(_organizationId?: string): Promise<CustomerGrowthPoint[]> {
    return [
      { month: "Jan", customers: 42 },
      { month: "Feb", customers: 45 },
      { month: "Mar", customers: 48 },
      { month: "Apr", customers: 52 },
      { month: "May", customers: 56 },
      { month: "Jun", customers: 61 },
    ];
  }

  async getSegmentBreakdown(_organizationId?: string): Promise<SegmentBreakdown[]> {
    return [
      { segment: "Enterprise", arr: 35.2, customers: 24, color: "#C9A961" },
      { segment: "Mid-Market", arr: 20.4, customers: 16, color: "#8E6A2B" },
      { segment: "SMB", arr: 8.4, customers: 8, color: "#4A8068" },
    ];
  }

  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }

  async getAnalyticsStats(_organizationId?: string): Promise<AnalyticsSummaryStats> {
    return {
      totalRevenue: 64.6,
      netNewArr: 8.4,
      netRevenueRetention: 118,
      grossChurnRate: 1.8,
    };
  }
}

export const revenueRepository = new ApiRevenueRepository();

