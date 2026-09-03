"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import RoleSwitcher from "./RoleSwitcher";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "./OrganizationContext";
import { primaryNavigation, valueNavigation, isNavigationItemActive } from "./navigation";

export default function Topbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  const { organization, isFeatureEnabled } = useOrganization();

  const userInitials = user?.name
    ? user.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("")
    : "--";

  const visiblePrimary = primaryNavigation.filter((item) => {
    if (!hasPermission(item.permission)) return false;
    return item.feature ? isFeatureEnabled(item.feature) : true;
  });

  const visibleValue = valueNavigation.filter((item) => {
    if (!hasPermission(item.permission)) return false;
    return item.feature ? isFeatureEnabled(item.feature) : true;
  });

  useEffect(() => setIsMobileMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-10 -mt-[10px]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors hover:border-gold/30 hover:text-ivory lg:hidden"
            aria-label="Open APEX ONE navigation"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>

          <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="APEX ONE home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 font-display text-[11px] font-bold text-gold">A1</span>
            <span className="font-display text-sm font-bold text-ivory">APEX ONE</span>
          </Link>

          <div className="hidden lg:block">
            <p className="font-display text-sm font-semibold text-ivory/80">Enterprise Intelligence Workspace</p>
            <p className="mt-0.5 text-[11px] text-ivory/35">{organization.displayName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <RoleSwitcher />
          {hasPermission("org:read") && (
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors hover:border-gold/30 hover:text-ivory"
            >
              <Bell size={16} strokeWidth={1.75} />
            </Link>
          )}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-gradient font-display text-[12px] font-bold text-matte"
            aria-label={user ? `Authenticated user: ${user.name}` : "Authenticated user"}
            title={user?.name || "Authenticated user"}
          >
            {userInitials}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-matte/80 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 top-0 flex w-[280px] flex-col border-r border-white/[0.08] bg-charcoal p-5 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-6">
                <div>
                  <p className="font-display text-[17px] font-bold text-ivory">APEX ONE</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-gold">Executive Intelligence OS</p>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-ivory/60 transition-colors hover:border-gold/30 hover:text-ivory"
                  aria-label="Close navigation"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto pr-1" aria-label="APEX ONE mobile navigation">
                {visiblePrimary.map((item) => {
                  const active = isNavigationItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                        active ? "bg-white/[0.04] text-ivory" : "text-ivory/50 hover:bg-white/[0.02] hover:text-ivory/90"
                      )}
                    >
                      <Icon size={17} strokeWidth={1.75} className={active ? "text-gold" : "text-ivory/40"} />
                      {item.label}
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
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                            active ? "bg-white/[0.04] text-ivory" : "text-ivory/50 hover:bg-white/[0.02] hover:text-ivory/90"
                          )}
                        >
                          <Icon size={17} strokeWidth={1.75} className={active ? "text-gold" : "text-ivory/40"} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </>
                )}
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
