"use client";

import clsx from "clsx";
import { Sparkles, ListTree, MessageCircleQuestion } from "lucide-react";

export type DocumentTabId = "summary" | "extracted" | "ask";

interface DocumentTabsProps {
  active: DocumentTabId;
  onChange: (tab: DocumentTabId) => void;
  extractedCount: number;
  disabled?: boolean;
}

const tabs: Array<{ id: DocumentTabId; label: string; icon: typeof Sparkles }> = [
  { id: "summary", label: "AI Summary", icon: Sparkles },
  { id: "extracted", label: "Extracted Data", icon: ListTree },
  { id: "ask", label: "Ask a Question", icon: MessageCircleQuestion },
];

export default function DocumentTabs({ active, onChange, extractedCount, disabled }: DocumentTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => !disabled && onChange(tab.id)}
            disabled={disabled}
            className={clsx(
              "relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors duration-200",
              disabled ? "cursor-not-allowed text-ivory/20" : isActive ? "text-ivory" : "text-ivory/40 hover:text-ivory/70"
            )}
          >
            <Icon size={14} />
            {tab.label}
            {tab.id === "extracted" && !disabled && (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                  isActive ? "bg-gold/15 text-gold" : "bg-white/[0.05] text-ivory/35"
                )}
              >
                {extractedCount}
              </span>
            )}
            {isActive && !disabled && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gold-gradient" />
            )}
          </button>
        );
      })}
    </div>
  );
}
