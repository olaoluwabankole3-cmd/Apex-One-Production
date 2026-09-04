"use client";

import { useEffect, useState } from "react";
import { Bell, CircleAlert, Info, ShieldCheck } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { notificationRepository } from "@/lib/data/repositories";
import type { NotificationItem } from "@/lib/types";

const severityIcon = {
  critical: CircleAlert,
  warning: CircleAlert,
  info: Info,
  success: ShieldCheck,
} as const;

export default function NotificationsWorkspace() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    notificationRepository
      .getNotifications()
      .then((records) => {
        if (mounted) setNotifications(records);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-ivory/50">
          Notifications shown here originate from authorized organizational-memory records.
        </p>
      </header>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">
          Loading authorized notifications…
        </GlassCard>
      ) : notifications.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <Bell size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">
            No notification records
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ivory/45">
            APEX ONE has no authoritative notification records to show for this session.
            Synthetic signals, confidence scores and fictional assignees are not generated.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const Icon = severityIcon[notification.severity] || Info;
            return (
              <GlassCard key={notification.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-gold/70">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-sm font-bold text-ivory">
                        {notification.title}
                      </p>
                      <span className="text-[11px] text-ivory/35">{notification.time}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-ivory/50">
                      {notification.description}
                    </p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ivory/30">
                      Source: {notification.source}
                    </p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {failed && (
        <p className="text-sm text-crimson/80">
          The notification request could not be completed.
        </p>
      )}
    </div>
  );
}
