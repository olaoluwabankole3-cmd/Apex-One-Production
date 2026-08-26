"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { Handshake, CalendarDays, StickyNote, LifeBuoy, Cpu } from "lucide-react";
import { TimelineEvent } from "@/lib/types";

const typeIcon: Record<TimelineEvent["type"], typeof Handshake> = {
  deal: Handshake,
  meeting: CalendarDays,
  note: StickyNote,
  support: LifeBuoy,
  system: Cpu,
};

const typeColor: Record<TimelineEvent["type"], string> = {
  deal: "text-emerald bg-emerald/10 border-emerald/25",
  meeting: "text-gold bg-gold/10 border-gold/25",
  note: "text-ivory/70 bg-white/[0.05] border-white/[0.1]",
  support: "text-crimson bg-crimson/10 border-crimson/25",
  system: "text-amber bg-amber/10 border-amber/25",
};

interface TimelineTabProps {
  events: TimelineEvent[];
}

export default function TimelineTab({ events }: TimelineTabProps) {
  if (events.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No activity recorded yet.</p>;
  }

  return (
    <div className="relative space-y-5 py-1">
      <span className="absolute left-[15px] top-2 bottom-2 w-px bg-white/[0.07]" aria-hidden />
      {events.map((event, i) => {
        const Icon = typeIcon[event.type];
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="relative flex gap-4 pl-0"
          >
            <span
              className={clsx(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                typeColor[event.type]
              )}
            >
              <Icon size={14} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-[13px] font-medium text-ivory/90">{event.title}</p>
                <span className="font-mono text-[10.5px] text-ivory/35">{event.date}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ivory/50">{event.description}</p>
              <p className="mt-1 text-[11px] text-ivory/35">{event.actor}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
