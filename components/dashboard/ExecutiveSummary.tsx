"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { intelligenceRepository } from "@/lib/data/repositories";

export default function ExecutiveSummary() {
  const { role } = useRole();
  const [summary, setSummary] = useState("");
  const [displayed, setDisplayed] = useState("");
  const frame = useRef<number>();

  const [generatedDate, setGeneratedDate] = useState("");

  useEffect(() => {
    setGeneratedDate(
      new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }, []);

  useEffect(() => {
    async function loadSummary() {
      const text = await intelligenceRepository.getExecutiveSummary(role);
      setSummary(text);
    }
    loadSummary();
  }, [role]);

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const step = () => {
      i += 2;
      setDisplayed(summary.slice(0, i));
      if (i < summary.length) {
        frame.current = window.setTimeout(step, 14);
      }
    };
    if (summary) {
      step();
    }
    return () => {
      if (frame.current) clearTimeout(frame.current);
    };
  }, [summary]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-charcoal-light/90 to-charcoal/80 p-6 shadow-gold-glow mt-0 pt-[19px]"
    >
      {/* ambient scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-gold/[0.06] to-transparent animate-scan-line" />
      </div>
      <div className="absolute inset-0 bg-grain-radial pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-gold/20 animate-pulse-slow" />
          <span className="absolute inset-[3px] rounded-full border border-gold/40" />
          <Sparkles size={18} className="relative z-10 text-gold" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[15px] font-bold tracking-tight text-ivory">
              AI Executive Summary
            </p>
            <AnimatePresence mode="wait">
              <motion.span
                key={role}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-gold"
              >
                {role} briefing
              </motion.span>
            </AnimatePresence>
          </div>

          <p className="mt-2.5 min-h-[4.5em] text-[14px] leading-relaxed text-ivory/75">
            {displayed}
            <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-gold/70 align-middle" />
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-ivory/40">
            <span className="rounded-md bg-white/[0.03] px-2 py-1">
              Generated {generatedDate || "today"}
            </span>
            <span className="rounded-md bg-white/[0.03] px-2 py-1">Source: 4 subsidiaries</span>
            <span className="rounded-md bg-white/[0.03] px-2 py-1">Confidence: High</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
