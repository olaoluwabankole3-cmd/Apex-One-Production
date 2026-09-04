"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "./OrganizationContext";
import { primaryNavigation, valueNavigation, isNavigationItemActive } from "./navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { organization, isFeatureEnabled } = useOrganization();

  const visiblePrimary = primaryNavigation.filter((item) => {
    if (!hasPermission(item.permission)) return false;
    return item.feature ? isFeatureEnabled(item.feature) : true;
  });

  const visibleValue = valueNavigation.filter((item) => {
    if (!hasPermission(item.permission)) return false;
    return item.feature ? isFeatureEnabled(item.feature) : true;
  });

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-charcoal/60 px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-2 pb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 font-display text-sm font-bold text-gold">
          A1
        </div>
        <div className="leading-tight">
          <p className="font-display text-[17px] font-bold tracking-tight text-ivory">APEX ONE</p>
          <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.12em] text-ivory/35">
            Executive Intelligence OS
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1" aria-label="APEX ONE navigation">
        {visiblePrimary.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-300",
                active ? "text-ivory" : "text-ivory/50 hover:text-ivory/90"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg border border-gold/20 bg-white/[0.05]"
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

        {visibleValue.length > 0 && isFeatureEnabled("valueIntelligence") && (
          <>
            <div className="px-3 pb-2 pt-5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-gold/60">
              Value Intelligence
            </div>
            {visibleValue.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-300",
                    active ? "text-ivory" : "text-ivory/50 hover:text-ivory/90"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg border border-gold/20 bg-white/[0.05]"
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
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gold/60">
          Enterprise workspace
        </p>
        <p className="mt-0.5 font-display text-[12.5px] font-semibold text-ivory/80">
          {organization.displayName}
        </p>
      </div>
    </aside>
  );
}
