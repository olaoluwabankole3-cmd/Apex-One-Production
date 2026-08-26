"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
import clsx from "clsx";
import { motion } from "framer-motion";

import { useRole } from "./RoleContext";
import { useOrganization } from "./OrganizationContext";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutGrid, externalOnly: false },
  { href: "/ai-workspace", label: "AI Workspace", icon: Sparkles, externalOnly: false, feature: "aiWorkspace" },
  { href: "/customers", label: "Customers", icon: Users, externalOnly: false, feature: "customerIntelligence" },
  { href: "/operations", label: "Operations", icon: Cog, externalOnly: false },
  { href: "/documents", label: "Documents", icon: FileStack, externalOnly: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3, externalOnly: false, feature: "revenueIntelligence" },
  { href: "/workflows", label: "Workflows", icon: Workflow, externalOnly: false, feature: "workflowIntelligence" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, externalOnly: false },
  { href: "/notifications", label: "Notifications", icon: Bell, externalOnly: false },
  { href: "/knowledge-hub", label: "Knowledge Hub", icon: BookOpenText, externalOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, externalOnly: false },
];

const valueNavItems = [
  { href: "/value-intelligence", label: "Intelligence Overview", icon: LayoutGrid },
  { href: "/value-intelligence/opportunities", label: "Value Opportunities", icon: Gem },
  { href: "/value-intelligence/leakage", label: "Revenue Leakage", icon: ShieldAlert },
  { href: "/value-intelligence/customer", label: "Customer Value", icon: UserCheck },
  { href: "/value-intelligence/capacity", label: "Capacity Intelligence", icon: Gauge, feature: "capacityIntelligence" },
  { href: "/value-intelligence/captured", label: "Value Captured", icon: Trophy },
  { href: "/value-intelligence/execution", label: "Execution Center", icon: Zap },
  { href: "/value-intelligence/ai-analyst", label: "AI Value Analyst", icon: Brain },
  { href: "/value-intelligence/simulator", label: "Value Simulator", icon: Sliders },
  { href: "/value-intelligence/reports", label: "Executive Value Reports", icon: LineChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const { organization, isFeatureEnabled } = useOrganization();

  const isCustomer = role === "Customer / Investor";

  // Filter navigation for the Customer / Investor role (APEX CONNECT)
  const visibleNavItems = navItems.filter((item) => {
    if (item.feature && !isFeatureEnabled(item.feature as any)) {
      return false;
    }
    if (isCustomer) {
      return ["/", "/notifications", "/knowledge-hub", "/settings"].includes(item.href);
    }
    return true;
  });

  const visibleValueNavItems = valueNavItems.filter((item) => {
    if (item.feature && !isFeatureEnabled(item.feature as any)) {
      return false;
    }
    return true;
  });

  return (
    <aside className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-charcoal/60 px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 pb-8">
        <div className="leading-tight">
          <Image
            src="https://lh3.googleusercontent.com/d/1nh8nRjbyrZc6S5Q64YtxbCUcCxVyGxuF"
            alt="Canary Point Logo"
            width={150}
            height={36}
            className="object-contain shrink-0 mb-1"
            referrerPolicy="no-referrer"
            priority
          />
          <p className="text-[10px] uppercase font-bold tracking-[0.14em] text-gold mt-1.5">
            {isCustomer ? "APEX CONNECT" : "APEX ONE OS"}
          </p>
          <p className="text-[8.5px] uppercase tracking-[0.1em] text-ivory/30 mt-0.5">
            Enterprise Operating System
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
        {visibleNavItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-300",
                active
                  ? "text-ivory"
                  : "text-ivory/50 hover:text-ivory/90"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-white/[0.05] border border-gold/20"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon
                size={17}
                strokeWidth={1.75}
                className={clsx(
                  "relative z-10 transition-colors duration-300",
                  active ? "text-gold" : "text-ivory/40 group-hover:text-ivory/70"
                )}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}

        {!isCustomer && isFeatureEnabled("valueIntelligence") && (
          <>
            <div className="pt-5 pb-2 px-3 text-[9.5px] font-bold uppercase tracking-[0.14em] text-gold/60 font-mono">
              Value Intelligence
            </div>
            {visibleValueNavItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-300",
                    active
                      ? "text-ivory"
                      : "text-ivory/50 hover:text-ivory/90"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-white/[0.05] border border-gold/20"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className={clsx(
                      "relative z-10 transition-colors duration-300",
                      active ? "text-gold" : "text-ivory/40 group-hover:text-ivory/70"
                    )}
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
        <p className="text-[10px] uppercase tracking-[0.12em] text-gold/60 font-semibold font-mono">
          {isCustomer ? "CLIENT ENVIRONMENT" : "STAFF ENVIRONMENT"}
        </p>
        <p className="mt-0.5 font-display text-[12.5px] font-semibold text-ivory/80">
          {organization.displayName}
        </p>
      </div>
    </aside>
  );
}
