import { KpiDatum, RevenuePoint, PortfolioSlice, SubsidiaryRevenuePoint, SegmentBreakdown } from "@/lib/types";

export const demoKpis: KpiDatum[] = [];
export const demoRevenueSeries: RevenuePoint[] = [];
export const demoPortfolioBreakdown: PortfolioSlice[] = [];
export const demoRevenueBySubsidiary: SubsidiaryRevenuePoint[] = [];
export const demoRevenueBySubsidiaryMonthly: { month: string; enterpriseOps: number; commercialOps: number; strategicAccounts: number; customerOps: number }[] = [];
export const demoCustomerGrowth: { month: string; customers: number }[] = [];
export const demoSegmentBreakdown: SegmentBreakdown[] = [];

export function sliceByRange<T>(data: T[], range: "30D" | "90D" | "YTD" | "12M"): T[] {
  const counts: Record<string, number> = { "30D": 1, "90D": 3, YTD: 7, "12M": data.length };
  const count = Math.min(counts[range] ?? data.length, data.length);
  return data.slice(data.length - count);
}
