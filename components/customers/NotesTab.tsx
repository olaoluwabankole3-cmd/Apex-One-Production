"use client";

import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import clsx from "clsx";
import { CustomerNote } from "@/lib/types";

interface NotesTabProps {
  notes: CustomerNote[];
}

export default function NotesTab({ notes }: NotesTabProps) {
  if (notes.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No notes yet.</p>;
  }

  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="space-y-3 py-1">
      {sorted.map((note, i) => (
        <motion.div
          key={note.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.04 }}
          className={clsx(
            "rounded-xl border p-4",
            note.pinned ? "border-gold/25 bg-gold/[0.04]" : "border-white/[0.07] bg-white/[0.02]"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-ivory/85">{note.author}</p>
            <div className="flex items-center gap-2">
              {note.pinned && <Pin size={12} className="text-gold" />}
              <span className="font-mono text-[10.5px] text-ivory/35">{note.date}</span>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ivory/60">{note.content}</p>
        </motion.div>
      ))}
    </div>
  );
}
