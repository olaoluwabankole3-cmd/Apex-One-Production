"use client";

import { useMemo, useState } from "react";
import { Search, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import clsx from "clsx";
import { DocumentItem, DocumentCategory } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const categories: Array<{ id: "all" | DocumentCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "Contract", label: "Contracts" },
  { id: "Financial Statement", label: "Financials" },
  { id: "Compliance Filing", label: "Compliance" },
  { id: "Claims Report", label: "Claims" },
];

const fileIcon = (fileType: DocumentItem["fileType"]) => (fileType === "xlsx" ? FileSpreadsheet : FileText);

const fileColor: Record<DocumentItem["fileType"], string> = {
  pdf: "text-crimson bg-crimson/10",
  doc: "text-gold bg-gold/10",
  xlsx: "text-emerald bg-emerald/10",
};

export default function DocumentList({ documents, selectedId, onSelect }: DocumentListProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | DocumentCategory>("all");

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchesCategory = category === "all" || d.category === category;
      const matchesQuery =
        !query.trim() ||
        d.name.toLowerCase().includes(query.toLowerCase()) ||
        d.subsidiary.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [documents, query, category]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal/40 shadow-glass">
      <div className="border-b border-white/[0.06] p-4">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Smart search documents…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-[12.5px] text-ivory placeholder:text-ivory/30 outline-none transition-colors duration-200 focus:border-gold/30"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                category === c.id
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/[0.08] text-ivory/45 hover:text-ivory/70"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-ivory/35">No documents match.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((doc) => {
              const Icon = fileIcon(doc.fileType);
              return (
                <button
                  key={doc.id}
                  onClick={() => onSelect(doc.id)}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
                    selectedId === doc.id
                      ? "border border-gold/25 bg-white/[0.06]"
                      : "border border-transparent hover:bg-white/[0.03]"
                  )}
                >
                  <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", fileColor[doc.fileType])}>
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12px] font-medium leading-snug text-ivory/90">{doc.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ivory/40">
                      {doc.status === "processing" ? (
                        <>
                          <Loader2 size={10} className="animate-spin text-gold" />
                          Processing
                        </>
                      ) : (
                        <>
                          {doc.category} · {doc.subsidiary}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
