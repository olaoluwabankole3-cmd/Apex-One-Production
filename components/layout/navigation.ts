import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  BrainCircuit,
  BookOpenText,
  FileStack,
  Target,
  Workflow,
  ShieldCheck,
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
 * CORTEX financial-institution release.
 *
 * Navigation represents source-backed intelligence journeys, not every
 * backend domain or experimental screen. Detailed records remain reachable
 * within their authorized workspaces; they are not a second sidebar.
 * All visibility is gated by session-derived permissions.
 */
export const primaryNavigation: AppNavigationItem[] = [
  { href: "/", label: "Command Center", icon: LayoutGrid, permission: "org:read" },
  { href: "/ai-workspace", label: "CORTEX Intelligence", icon: BrainCircuit, permission: "ai:execute", feature: "aiWorkspace" },
  { href: "/knowledge-hub", label: "Institutional Memory", icon: BookOpenText, permission: "knowledge:read" },
  { href: "/documents", label: "Documents & Evidence", icon: FileStack, permission: "document:read" },
  { href: "/value-intelligence", label: "Value & Risk", icon: Target, permission: "value:read", feature: "valueIntelligence" },
  { href: "/workflows", label: "Action Center", icon: Workflow, permission: "workflow:read", feature: "workflowIntelligence" },
  { href: "/value-intelligence/captured", label: "Recorded Outcomes", icon: ShieldCheck, permission: "value:read", feature: "valueIntelligence" },
];

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Captured outcomes is a separate journey from value/risk opportunities.
  if (href === "/value-intelligence") {
    return (
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      !(
        pathname === "/value-intelligence/captured" ||
        pathname.startsWith("/value-intelligence/captured/")
      )
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
