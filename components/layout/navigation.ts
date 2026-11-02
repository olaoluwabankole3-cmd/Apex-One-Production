import type { LucideIcon } from "lucide-react";
import { House, FileStack, MessageSquareText, Target, ListChecks } from "lucide-react";
import type { OrganizationConfig } from "@/lib/organizationConfig";

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  feature?: keyof OrganizationConfig["features"];
}

/**
 * Five straightforward entry points for first-time financial operators.
 * Knowledge and recorded outcomes stay available contextually without
 * taking permanent space in the sidebar.
 * Visibility remains derived from authenticated session capabilities.
 */
export const primaryNavigation: AppNavigationItem[] = [
  { href: "/", label: "Home", icon: House, permission: "org:read" },
  { href: "/documents", label: "Documents", icon: FileStack, permission: "document:read" },
  { href: "/value-intelligence", label: "Value & Risk", icon: Target, permission: "value:read", feature: "valueIntelligence" },
  { href: "/ai-workspace", label: "Ask CORTEX", icon: MessageSquareText, permission: "ai:execute", feature: "aiWorkspace" },
  { href: "/workflows", label: "Actions", icon: ListChecks, permission: "workflow:read", feature: "workflowIntelligence" },
];

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/value-intelligence") {
    return (
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      !(pathname === "/value-intelligence/captured" ||
        pathname.startsWith("/value-intelligence/captured/"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
