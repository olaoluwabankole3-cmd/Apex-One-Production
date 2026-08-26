"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DocumentItem } from "@/lib/types";

interface ExtractedDataTabProps {
  doc: DocumentItem;
}

export default function ExtractedDataTab({ doc }: ExtractedDataTabProps) {
  if (doc.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Loader2 size={22} className="animate-spin text-gold" />
        <p className="text-[13px] text-ivory/45">Extracting fields from this document…</p>
      </div>
    );
  }

  if (doc.extractedFields.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No structured fields extracted.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {doc.extractedFields.map((field, i) => (
        <motion.div
          key={field.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04 }}
          className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
        >
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-ivory/40">{field.label}</p>
          <p className="mt-1 text-[13.5px] font-medium text-ivory/90">{field.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
