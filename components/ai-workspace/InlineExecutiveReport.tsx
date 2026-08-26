"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Loader2 } from "lucide-react";
import { aiRepository } from "@/lib/data/repositories";
import { ReportSection } from "@/lib/types";

export default function InlineExecutiveReport() {
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );

    let isMounted = true;
    aiRepository.getReportSections()
      .then((res) => {
        if (isMounted) {
          setSections(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load report sections:", err);
        if (isMounted) {
          setSections([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className="mt-3 overflow-hidden rounded-xl border border-gold/20 bg-charcoal-light/60"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
            <FileText size={15} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-display text-[13.5px] font-bold text-ivory">
              Executive Briefing & Strategic Report
            </p>
            <p className="text-[11px] text-ivory/40">Generated {today}</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-medium text-ivory/70 transition-colors duration-200 hover:border-gold/30 hover:text-ivory">
          <Download size={13} />
          Export
        </button>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-ivory/40 gap-2 text-xs">
            <Loader2 className="animate-spin" size={14} />
            <span>Loading report sections...</span>
          </div>
        ) : sections.length === 0 ? (
          <div className="py-6 text-center text-xs text-ivory/40">
            No report data currently available.
          </div>
        ) : (
          sections.map((section, i) => (
            <div key={section.id} className="px-4 py-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-gold/70">
                {String(i + 1).padStart(2, "0")} · {section.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ivory/65">{section.summary}</p>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

