"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";

interface NotificationsHeaderProps {
  activeDigestCount: number;
}

export default function NotificationsHeader({ activeDigestCount }: NotificationsHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"
    >
      <div>
        <p className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-gold/70 flex items-center gap-2">
          <Radar size={13} className="text-gold animate-pulse" />
          APEX ONE — APEX SYNC
        </p>
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[34px] uppercase">
          INTELLIGENCE SIGNALS
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/50">
          The organization&apos;s most important changes, risks, opportunities and decisions — prioritized by impact.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald animate-pulse" />
        <span className="text-[11.5px] font-mono text-emerald/90 uppercase tracking-wider font-semibold">
          Canary Radar System Live
        </span>
      </div>
    </motion.div>
  );
}
