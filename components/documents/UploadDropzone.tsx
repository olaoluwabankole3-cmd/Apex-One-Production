"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Loader2 } from "lucide-react";
import clsx from "clsx";

interface UploadDropzoneProps {
  onSimulateUpload: () => void;
  uploading: boolean;
}

export default function UploadDropzone({ onSimulateUpload, uploading }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) onSimulateUpload();
      }}
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-300",
        dragOver ? "border-gold/50 bg-gold/[0.04]" : "border-white/[0.1] bg-white/[0.015]"
      )}
    >
      <span
        className={clsx(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          uploading ? "bg-gold/15 text-gold" : "bg-white/[0.05] text-ivory/50"
        )}
      >
        {uploading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} strokeWidth={1.75} />}
      </span>
      <div>
        <p className="text-[13.5px] font-medium text-ivory/85">
          {uploading ? "Processing document…" : "Drag and drop a document, or"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ivory/40">
          {uploading
            ? "Apex Sync Intelligence is extracting fields and generating a summary."
            : "PDF, Word, or Excel — analyzed automatically on upload."}
        </p>
      </div>
      {!uploading && (
        <button
          onClick={onSimulateUpload}
          className="mt-1 rounded-lg bg-gold-gradient px-4 py-2 text-[12.5px] font-semibold text-matte transition-shadow duration-200 hover:shadow-gold-glow"
        >
          Simulate Upload
        </button>
      )}
    </motion.div>
  );
}
