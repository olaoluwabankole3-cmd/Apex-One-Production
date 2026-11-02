import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid, ArrowLeftRight, ClipboardList, ShieldCheck,
  FileStack, ChartNoAxesCombined, Settings2,
} from "lucide-react";
import type { OrganizationConfig } from "@/lib/organizationConfig";

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  feature?: keyof OrganizationConfig["features"];
}

/**
 * CORTEX financial-operations MVP.
 * Seven tasks, not seven dashboards. Hide journeys that are not authorized
 * by the active session. Legacy modules remain reachable only through their
 * permission-checked context, not additional primary nav destinations.
 */
export const primaryNavigation: AppNavigationItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid, permission: "org:read" },
  { href: "/reconciliation", label: "Reconciliation", icon: ArrowLeftRight, permission: "financial:read" },
  { href: "/work/cases", label: "Cases", icon: ClipboardList, permission: "case:read" },
  { href: "/reviews", label: "Reviews", icon: ShieldCheck, permission: "case:approve" },
  { href: "/documents", label: "Evidence", icon: FileStack, permission: "document:read" },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombined, permission: "case:read" },
  { href: "/settings", label: "Administration", icon: Settings2, permission: "org:admin" },
];

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
