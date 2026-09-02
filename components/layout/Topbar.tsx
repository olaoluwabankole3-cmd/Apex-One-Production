"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Menu,
  X,
  LayoutGrid,
  Sparkles,
  Users,
  Cog,
  FileStack,
  BarChart3,
  Workflow,
  CalendarDays,
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
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import RoleSwitcher from "./RoleSwitcher";

import { useRole } from "./RoleContext";
import { useOrganization } from "./OrganizationContext";
import { useAuth } from "@/components/auth/AuthContext";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/ai-workspace", label: "AI Workspace", icon: Sparkles, feature: "aiWorkspace" },
  { href: "/customers", label: "Customers", icon: Users, feature: "customerIntelligence" },
  { href: "/operations", label: "Operations", icon: Cog },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/analytics", label: "Analytics", icon: BarChart3, feature: "revenueIntelligence" },
  { href: "/workflows", label: "Workflows", icon: Workflow, feature: "workflowIntelligence" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/knowledge-hub", label: "Knowledge Hub", icon: BookOpenText },
  { href: "/settings", label: "Settings", icon: Settings },
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

export default function Topbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { role, notifications } = useRole();
  const { organization, isFeatureEnabled } = useOrganization();
  const { user } = useAuth();

  const isCustomer = role === "Customer / Investor";
  const unreadCount = notifications ? notifications.length : 0;
  const userInitials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "--";

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

  // Close mobile menu on path changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-10 -mt-[10px]">
        {/* Left mobile: Hamburger + Logo */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors duration-200 hover:border-gold/30 hover:text-ivory"
            aria-label="Open navigation menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          
          <Link href="/" className="flex items-center">
            <Image
              src="https://lh3.googleusercontent.com/d/1nh8nRjbyrZc6S5Q64YtxbCUcCxVyGxuF"
              alt="Canary Point Logo"
              width={110}
              height={26}
              className="object-contain shrink-0"
              referrerPolicy="no-referrer"
              priority
            />
          </Link>
        </div>

        {/* Desktop search */}
        <div className="relative hidden max-w-sm flex-1 lg:block">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30"
          />
          <input
            type="text"
            placeholder="Search customers, documents, workflows…"
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] py-2 pl-9 pr-3 text-[13px] text-ivory placeholder:text-ivory/30 outline-none transition-colors duration-200 focus:border-gold/30"
          />
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <RoleSwitcher />
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors duration-200 hover:border-gold/30 hover:text-ivory"
          >
            <Bell size={16} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-crimson" />
            )}
          </Link>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-gradient font-display text-[12px] font-bold text-matte"
            aria-label={user ? `Authenticated user: ${user.name}` : "No authenticated user"}
            title={user?.name || "Unauthenticated"}
          >
            {userInitials}
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-matte/80 backdrop-blur-sm"
            />

            {/* Drawer panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 flex w-[280px] flex-col border-r border-white/[0.08] bg-charcoal p-5 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-white/[0.06] mb-5">
                <div className="leading-tight">
                  <Image
                    src="https://lh3.googleusercontent.com/d/1nh8nRjbyrZc6S5Q64YtxbCUcCxVyGxuF"
                    alt="Canary Point Logo"
                    width={130}
                    height={30}
                    className="object-contain shrink-0 mb-0.5"
                    referrerPolicy="no-referrer"
                    priority
                  />
                  <p className="text-[9px] uppercase font-bold tracking-[0.14em] text-gold mt-1">
                    {isCustomer ? "APEX CONNECT" : "APEX ONE OS"}
                  </p>
                  <p className="text-[8px] uppercase tracking-[0.1em] text-ivory/30 mt-0.5">
                    by {organization.shortName || "Apex Sync"} Intelligence
                  </p>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors duration-200 hover:border-gold/30 hover:text-ivory"
                  aria-label="Close menu"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
                {visibleNavItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={clsx(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-300",
                        active
                          ? "text-ivory bg-white/[0.04]"
                          : "text-ivory/50 hover:text-ivory/90 hover:bg-white/[0.02]"
                      )}
                    >
                      <Icon
                        size={17}
                        strokeWidth={1.75}
                        className={clsx(
                          "transition-colors duration-300",
                          active ? "text-gold" : "text-ivory/40 group-hover:text-ivory/70"
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {!isCustomer && isFeatureEnabled("valueIntelligence") && (
                  <>
                    <div className="pt-4 pb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-gold/60 font-mono">
                      Value Intelligence
                    </div>
                    {visibleValueNavItems.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={clsx(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-300",
                            active
                              ? "text-ivory bg-white/[0.04]"
                              : "text-ivory/50 hover:text-ivory/90 hover:bg-white/[0.02]"
                          )}
                        >
                          <Icon
                            size={17}
                            strokeWidth={1.75}
                            className={clsx(
                              "transition-colors duration-300",
                              active ? "text-gold" : "text-ivory/40 group-hover:text-ivory/70"
                            )}
                          />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </nav>

              {/* Footer environment card */}
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-gold/60 font-semibold font-mono">
                  {isCustomer ? "CLIENT ENVIRONMENT" : "STAFF ENVIRONMENT"}
                </p>
                <p className="mt-0.5 font-display text-[12.5px] font-semibold text-ivory/80">
                  {organization.displayName}
                </p>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
