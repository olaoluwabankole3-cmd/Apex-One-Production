"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DatabaseZap } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { intelligenceRepository } from "@/lib/data/repositories";

export default function ExecutiveSummary() {
  const { role } = useRole();
  const [summary, setSummary] = useState("");
  const [generatedDate, setGeneratedDate] = useState("");

  useEffect(() => {
    setGeneratedDate(
      new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    intelligenceRepository
      .getExecutiveSummary(role)
      .then((text) => {
        if (mounted) setSummary(text);
      })
      .catch(() => {
        if (mounted) {
          setSummary("Executive briefing unavailable because the authoritative data request did not complete.");
        }
      });
    return () => {
      mounted = false;
    };
  }, [role]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-charcoal-light/90 to-charcoal/80 p-6 shadow-gold-glow"
    >
      <div className="absolute inset-0 bg-grain-radial pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <DatabaseZap size={18} strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-[15px] font-bold tracking-tight text-ivory">
              Executive Intelligence Briefing
            </p>
            <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-ivory/45">
              Deterministic · authorized records
            </span>
          </div>

          <p className="mt-2.5 min-h-[3.5em] text-[14px] leading-relaxed text-ivory/75">
            {summary || "Loading authorized enterprise records…"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-ivory/40">
            <span className="rounded-md bg-white/[0.03] px-2 py-1">
              Refreshed {generatedDate || "today"}
            </span>
            <span className="rounded-md bg-white/[0.03] px-2 py-1">
              No model-generated confidence label
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
