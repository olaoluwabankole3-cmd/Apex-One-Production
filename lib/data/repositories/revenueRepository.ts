import { KpiDatum, RevenuePoint, PortfolioSlice, SubsidiaryRevenuePoint, RevenueBySubsidiaryPoint, CustomerGrowthPoint, SegmentBreakdown, SubsidiaryPerformance, AnalyticsSummaryStats } from "@/lib/types";
import { CustomerRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData } from "./httpCollection";

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
  private async getCustomerRecords(): Promise<CustomerRecord[]> {
    return collectAllCollectionData<CustomerRecord>("/api/v1/customers");
  }

  async getKpis(_organizationId?: string): Promise<KpiDatum[]> {
    const customers = await this.getCustomerRecords();
    const totalArrUSD = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const totalArrM = (totalArrUSD / 1000000).toFixed(1);
    const atRiskCount = customers.filter((c) => c.status === "at-risk" || c.healthScore < 70).length;

    const totalArrVal = parseFloat(totalArrM) || 0;
    const avgHealth = customers.length
      ? Math.round(customers.reduce((sum, c) => sum + c.healthScore, 0) / customers.length)
      : 0;

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
  }

  async getRevenueSeries(_organizationId?: string): Promise<RevenuePoint[]> {
    // BACKEND CAPABILITY REQUIRED: Historical monthly revenue time-series service.
    return [];
  }

  async getPortfolioBreakdown(_organizationId?: string): Promise<PortfolioSlice[]> {
    const customers = await this.getCustomerRecords();
    const subMap: Record<string, number> = {};

    for (const customer of customers) {
      const subsidiary = customer.subsidiary || "Unassigned";
      subMap[subsidiary] = (subMap[subsidiary] || 0) + (customer.arr || 0);
    }

    const colors = ["#C9A961", "#8E6A2B", "#4A8068", "#9B4E4E", "#607274"];
    return Object.entries(subMap).map(([name, value], index) => ({
      name,
      value: Math.round(value / 1000000),
      color: colors[index % colors.length],
    }));
  }

  async getRevenueBySubsidiary(_organizationId?: string): Promise<SubsidiaryRevenuePoint[]> {
    const customers = await this.getCustomerRecords();
    const subMap: Record<string, number> = {};

    for (const customer of customers) {
      const subsidiary = customer.subsidiary || "Unassigned";
      subMap[subsidiary] = (subMap[subsidiary] || 0) + (customer.arr || 0);
    }

    return Object.entries(subMap).map(([name, value]) => ({
      name,
      revenue: +(value / 1000000).toFixed(1),
      target: +(value / 1000000).toFixed(1),
      margin: 0,
    }));
  }

  async getRevenueBySubsidiaryMonthly(_organizationId?: string): Promise<RevenueBySubsidiaryPoint[]> {
    return [];
  }

  async getCustomerGrowth(_organizationId?: string): Promise<CustomerGrowthPoint[]> {
    return [];
  }

  async getSegmentBreakdown(_organizationId?: string): Promise<SegmentBreakdown[]> {
    const customers = await this.getCustomerRecords();
    const enterprise = customers.filter((c) => c.tier === "Enterprise");
    const midMarket = customers.filter((c) => c.tier === "Mid-Market");
    const smb = customers.filter((c) => c.tier === "SMB");

    return [
      {
        segment: "Enterprise",
        arr: +(enterprise.reduce((sum, c) => sum + (c.arr || 0), 0) / 1000000).toFixed(1),
        customers: enterprise.length,
        color: "#C9A961",
      },
      {
        segment: "Mid-Market",
        arr: +(midMarket.reduce((sum, c) => sum + (c.arr || 0), 0) / 1000000).toFixed(1),
        customers: midMarket.length,
        color: "#8E6A2B",
      },
      {
        segment: "SMB",
        arr: +(smb.reduce((sum, c) => sum + (c.arr || 0), 0) / 1000000).toFixed(1),
        customers: smb.length,
        color: "#4A8068",
      },
    ];
  }

  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }

  async getAnalyticsStats(_organizationId?: string): Promise<AnalyticsSummaryStats> {
    const customers = await this.getCustomerRecords();
    const totalRevenue = +(customers.reduce((sum, c) => sum + (c.arr || 0), 0) / 1000000).toFixed(1);
    return {
      totalRevenue,
      netNewArr: 0,
      netRevenueRetention: 100,
      grossChurnRate: 0,
    };
  }
}

export const revenueRepository = new ApiRevenueRepository();
