"use client";

import clsx from "clsx";
import { History, StickyNote, CheckSquare, CalendarDays, Paperclip } from "lucide-react";

export type CustomerTabId = "timeline" | "notes" | "tasks" | "meetings" | "files";

interface CustomerTabsProps {
  active: CustomerTabId;
  onChange: (tab: CustomerTabId) => void;
  counts: Record<CustomerTabId, number>;
}

const tabs: Array<{ id: CustomerTabId; label: string; icon: typeof History }> = [
  { id: "timeline", label: "Timeline", icon: History },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "meetings", label: "Meetings", icon: CalendarDays },
  { id: "files", label: "Files", icon: Paperclip },
];

export default function CustomerTabs({ active, onChange, counts }: CustomerTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors duration-200",
              isActive ? "text-ivory" : "text-ivory/40 hover:text-ivory/70"
            )}
          >
            <Icon size={14} />
            {tab.label}
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                isActive ? "bg-gold/15 text-gold" : "bg-white/[0.05] text-ivory/35"
              )}
            >
              {counts[tab.id]}
            </span>
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gold-gradient" />
            )}
          </button>
        );
      })}
    </div>
  );
}
