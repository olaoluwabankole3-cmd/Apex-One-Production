"use client";

import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { DocumentItem } from "@/lib/types";

interface SummaryTabProps {
  doc: DocumentItem;
}

export default function SummaryTab({ doc }: SummaryTabProps) {
  if (doc.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Loader2 size={22} className="animate-spin text-gold" />
        <p className="text-[13px] text-ivory/45">
          Apex Sync Intelligence is still reading this document — summary will appear here shortly.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-gold/15 bg-gold/[0.03] p-5"
    >
      <div className="flex items-center gap-2 text-gold">
        <Sparkles size={14} />
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em]">AI Summary</p>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ivory/75">{doc.aiSummary}</p>
    </motion.div>
  );
}
