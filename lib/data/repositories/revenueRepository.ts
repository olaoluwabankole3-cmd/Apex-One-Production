import { KpiDatum, RevenuePoint, PortfolioSlice, SubsidiaryRevenuePoint, RevenueBySubsidiaryPoint, CustomerGrowthPoint, SegmentBreakdown, SubsidiaryPerformance, AnalyticsSummaryStats } from "@/lib/types";
import { demoKpis, demoRevenueSeries, demoPortfolioBreakdown, demoRevenueBySubsidiary, demoRevenueBySubsidiaryMonthly, demoCustomerGrowth, demoSegmentBreakdown } from "@/lib/data/demo";

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

export class MockRevenueRepository implements RevenueRepository {
  async getKpis(_organizationId?: string): Promise<KpiDatum[]> {
    return demoKpis;
  }
  async getRevenueSeries(_organizationId?: string): Promise<RevenuePoint[]> {
    return demoRevenueSeries;
  }
  async getPortfolioBreakdown(_organizationId?: string): Promise<PortfolioSlice[]> {
    return demoPortfolioBreakdown;
  }
  async getRevenueBySubsidiary(_organizationId?: string): Promise<SubsidiaryRevenuePoint[]> {
    return demoRevenueBySubsidiary;
  }
  async getRevenueBySubsidiaryMonthly(_organizationId?: string): Promise<RevenueBySubsidiaryPoint[]> {
    return demoRevenueBySubsidiaryMonthly;
  }
  async getCustomerGrowth(_organizationId?: string): Promise<CustomerGrowthPoint[]> {
    return demoCustomerGrowth;
  }
  async getSegmentBreakdown(_organizationId?: string): Promise<SegmentBreakdown[]> {
    return demoSegmentBreakdown;
  }
  async getSubsidiaryPerformance(_organizationId?: string): Promise<SubsidiaryPerformance[]> {
    return [];
  }
  async getAnalyticsStats(_organizationId?: string): Promise<AnalyticsSummaryStats> {
    return {
      totalRevenue: 0,
      netNewArr: 0,
      netRevenueRetention: 0,
      grossChurnRate: 0,
    };
  }
}

export const revenueRepository = new MockRevenueRepository();
