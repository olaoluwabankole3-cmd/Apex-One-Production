"use client";

import { motion } from "framer-motion";
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Download } from "lucide-react";
import { CustomerFile } from "@/lib/types";

const typeIcon: Record<CustomerFile["type"], typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  xlsx: FileSpreadsheet,
  image: FileImage,
};

const typeColor: Record<CustomerFile["type"], string> = {
  pdf: "text-crimson bg-crimson/10",
  doc: "text-gold bg-gold/10",
  xlsx: "text-emerald bg-emerald/10",
  image: "text-ivory/70 bg-white/[0.06]",
};

interface FilesTabProps {
  files: CustomerFile[];
}

export default function FilesTab({ files }: FilesTabProps) {
  if (files.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No files attached.</p>;
  }

  return (
    <div className="space-y-2 py-1">
      {files.map((file, i) => {
        const Icon = typeIcon[file.type] ?? FileIcon;
        return (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeColor[file.type]}`}>
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ivory/85">{file.name}</p>
              <p className="mt-0.5 text-[11px] text-ivory/40">
                {file.size} · {file.uploadedBy} · {file.date}
              </p>
            </div>
            <button
              aria-label="Download file"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-ivory/50 transition-colors duration-200 hover:border-gold/30 hover:text-gold"
            >
              <Download size={13} />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
