"use client";

import clsx from "clsx";
import { TimeRange } from "@/lib/types";

const ranges: TimeRange[] = ["30D", "90D", "YTD", "12M"];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors duration-200",
            value === r ? "bg-gold-gradient text-matte" : "text-ivory/50 hover:text-ivory/80"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
