"use client";

import { useAuth } from "@/components/auth/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ExecutiveSummary from "@/components/dashboard/ExecutiveSummary";
import KpiGrid from "@/components/dashboard/KpiGrid";
import RevenueChart from "@/components/dashboard/RevenueChart";
import PortfolioBreakdown from "@/components/dashboard/PortfolioBreakdown";
import RecentActivity from "@/components/dashboard/RecentActivity";
import QuickActions from "@/components/dashboard/QuickActions";
import ApexConnectDashboard from "@/components/dashboard/ApexConnectDashboard";

export default function DashboardPage() {
  const { isLoading, hasPermission } = useAuth();

  // Do not render either environment until the server-backed session is resolved.
  if (isLoading) {
    return null;
  }

  // APEX ONE staff experience is selected from authenticated session capabilities,
  // never from RoleContext or client-selectable role state.
  if (!hasPermission("org:read")) {
    return <ApexConnectDashboard />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <DashboardHeader />

      <div className="space-y-6">
        <ExecutiveSummary />

        <KpiGrid />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 mt-[13px]">
          <div className="xl:col-span-2">
            <RevenueChart />
          </div>
          <PortfolioBreakdown />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RecentActivity />
          </div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
