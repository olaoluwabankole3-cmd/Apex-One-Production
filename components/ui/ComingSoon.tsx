"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import GlassCard from "./GlassCard";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70">
          Canary Point OS
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px]">
          {title}
        </h1>
      </motion.div>

      <GlassCard className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/[0.06] text-gold [&>svg]:h-[22px] [&>svg]:w-[22px]">
          {icon}
        </div>
        <div className="max-w-md">
          <p className="font-display text-[17px] font-bold text-ivory">{title} is in development</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ivory/45">{description}</p>
        </div>
        <span className="mt-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ivory/40">
          Prototype scope: Executive Dashboard
        </span>
      </GlassCard>
    </div>
  );
}
