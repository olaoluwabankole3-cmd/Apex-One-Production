"use client";

import { motion } from "framer-motion";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import clsx from "clsx";
import { DocumentItem } from "@/lib/types";

const fileColor: Record<DocumentItem["fileType"], string> = {
  pdf: "text-crimson bg-crimson/10",
  doc: "text-gold bg-gold/10",
  xlsx: "text-emerald bg-emerald/10",
};

interface DocumentViewerHeaderProps {
  doc: DocumentItem;
}

export default function DocumentViewerHeader({ doc }: DocumentViewerHeaderProps) {
  const Icon = doc.fileType === "xlsx" ? FileSpreadsheet : FileText;

  return (
    <motion.div
      key={doc.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass lg:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", fileColor[doc.fileType])}>
            <Icon size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-snug text-ivory">{doc.name}</h2>
            <p className="mt-1 text-[12.5px] text-ivory/45">
              {doc.subsidiary} · {doc.category} · {doc.pages} pages · {doc.size}
            </p>
            <p className="mt-1 text-[11.5px] text-ivory/35">
              Uploaded by {doc.uploadedBy} on {doc.date}
            </p>
          </div>
        </div>

        <span
          className={clsx(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold capitalize",
            doc.status === "processed"
              ? "border-emerald/25 bg-emerald/10 text-emerald"
              : "border-gold/25 bg-gold/10 text-gold"
          )}
        >
          {doc.status === "processing" && <Loader2 size={11} className="animate-spin" />}
          {doc.status}
        </span>
      </div>
    </motion.div>
  );
}
