import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Sparkles,
  Users,
  Cog,
  FileStack,
  BarChart3,
  Workflow,
  CalendarDays,
  Bell,
  BookOpenText,
  Settings,
  Gem,
  ShieldAlert,
  UserCheck,
  Gauge,
  Zap,
  Trophy,
  Brain,
  Sliders,
  LineChart,
} from "lucide-react";
import type { OrganizationConfig } from "@/lib/organizationConfig";

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  feature?: keyof OrganizationConfig["features"];
}

export const primaryNavigation: AppNavigationItem[] = [
  { href: "/", label: "Executive Overview", icon: LayoutGrid, permission: "org:read" },
  { href: "/ai-workspace", label: "AI Workspace", icon: Sparkles, permission: "ai:execute", feature: "aiWorkspace" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customer:read", feature: "customerIntelligence" },
  { href: "/operations", label: "Operations", icon: Cog, permission: "org:read" },
  { href: "/documents", label: "Documents", icon: FileStack, permission: "document:read" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "financial:read", feature: "revenueIntelligence" },
  { href: "/workflows", label: "Workflows", icon: Workflow, permission: "workflow:read", feature: "workflowIntelligence" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, permission: "org:read" },
  { href: "/notifications", label: "Notifications", icon: Bell, permission: "org:read" },
  { href: "/knowledge-hub", label: "Knowledge Hub", icon: BookOpenText, permission: "knowledge:read" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "org:admin" },
];

export const valueNavigation: AppNavigationItem[] = [
  { href: "/value-intelligence", label: "Value Overview", icon: LayoutGrid, permission: "value:read" },
  { href: "/value-intelligence/opportunities", label: "Value Opportunities", icon: Gem, permission: "value:read" },
  { href: "/value-intelligence/leakage", label: "Revenue Leakage", icon: ShieldAlert, permission: "value:read" },
  { href: "/value-intelligence/customer", label: "Customer Value", icon: UserCheck, permission: "value:read" },
  { href: "/value-intelligence/capacity", label: "Capacity Intelligence", icon: Gauge, permission: "value:read", feature: "capacityIntelligence" },
  { href: "/value-intelligence/captured", label: "Value Captured", icon: Trophy, permission: "value:read" },
  { href: "/value-intelligence/execution", label: "Execution Center", icon: Zap, permission: "value:read" },
  { href: "/value-intelligence/ai-analyst", label: "AI Value Analyst", icon: Brain, permission: "ai:execute" },
  { href: "/value-intelligence/simulator", label: "Value Simulator", icon: Sliders, permission: "value:read" },
  { href: "/value-intelligence/reports", label: "Executive Value Reports", icon: LineChart, permission: "value:read" },
];

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
