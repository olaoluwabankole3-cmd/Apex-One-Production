"use client";

import { useState, useEffect } from "react";
import { FileText, ShieldAlert, ScanSearch, TrendingUp, Headset, ArrowRight, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { useRole } from "@/components/layout/RoleContext";
import { aiRepository } from "@/lib/data/repositories";
import { QuickAction } from "@/lib/types";

const iconMap: Record<string, typeof FileText> = {
  FileText,
  ShieldAlert,
  ScanSearch,
  TrendingUp,
  Headset,
};

export default function QuickActions() {
  const { role } = useRole();
  const [items, setItems] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    aiRepository.getQuickActions(role)
      .then((actions) => {
        if (isMounted) {
          setItems(actions);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load quick actions:", err);
        if (isMounted) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [role]);

  return (
    <GlassCard delay={0.25} className="p-5 lg:p-6">
      <p className="font-display text-[15px] font-bold text-ivory">Quick Actions</p>
      <p className="mt-0.5 text-[12px] text-ivory/40">Tailored to your role</p>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={16} />
            <span>Loading actions...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-ivory/40">
            No quick actions available.
          </div>
        ) : (
          items.map((action) => {
            const Icon = iconMap[action.icon] ?? FileText;
            return (
              <button
                key={action.id}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all duration-300 hover:border-gold/25 hover:bg-white/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-gold">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ivory/90">{action.label}</span>
                  <span className="block truncate text-[11.5px] text-ivory/40">{action.description}</span>
                </span>
                <ArrowRight
                  size={15}
                  className="shrink-0 text-ivory/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold"
                />
              </button>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

