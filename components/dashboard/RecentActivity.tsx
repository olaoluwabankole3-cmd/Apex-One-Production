"use client";

import { Handshake, ShieldAlert, ScanEye, Cpu, UserPlus } from "lucide-react";
import clsx from "clsx";
import GlassCard from "@/components/ui/GlassCard";
import { useRole } from "@/components/layout/RoleContext";
import { ActivityItem } from "@/lib/types";

const iconMap: Record<ActivityItem["type"], { icon: typeof Handshake; className: string }> = {
  deal: { icon: Handshake, className: "text-gold bg-gold/10" },
  risk: { icon: ShieldAlert, className: "text-crimson bg-crimson/10" },
  compliance: { icon: ScanEye, className: "text-amber bg-amber/10" },
  system: { icon: Cpu, className: "text-ivory/60 bg-white/5" },
  customer: { icon: UserPlus, className: "text-emerald bg-emerald/10" },
};

export default function RecentActivity() {
  const { activities } = useRole();
  const visibleActivities = activities.slice(0, 6);

  return (
    <GlassCard delay={0.2} className="p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-bold text-ivory">Recent Activity</p>
        <button className="text-[12px] text-gold/80 transition-colors hover:text-gold">
          View all
        </button>
      </div>

      <div className="mt-4 space-y-1">
        {visibleActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.05] bg-white/[0.002] py-14 flex flex-col items-center justify-center text-center">
            <span className="text-[12px] font-bold text-ivory/60 uppercase tracking-wider block font-mono">No Systemic Activities</span>
            <p className="text-[11px] text-ivory/35 max-w-xs mt-1.5 leading-relaxed">
              System telemetry is quiet. Action-driven activities will compile as ecosystem operations run.
            </p>
          </div>
        ) : (
          visibleActivities.map((item, idx) => {
            const { icon: Icon, className } = iconMap[item.type];
            return (
              <div
                key={item.id}
                className={clsx(
                  "flex items-start gap-3 py-2.5",
                  idx !== visibleActivities.length - 1 && "border-b border-white/[0.04]"
                )}
              >
                <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", className)}>
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ivory/80">
                    <span className="font-medium text-ivory">{item.actor}</span> {item.action}{" "}
                    <span className="font-medium text-ivory">{item.target}</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ivory/35">{item.time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
