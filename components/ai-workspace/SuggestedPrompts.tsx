"use client";

import { useState, useEffect } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { aiRepository } from "@/lib/data/repositories";
import { SuggestedPrompt } from "@/lib/types";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  variant?: "grid" | "list";
}

export default function SuggestedPrompts({ onSelect, variant = "list" }: SuggestedPromptsProps) {
  const { role } = useRole();
  const [items, setItems] = useState<SuggestedPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    aiRepository.getSuggestedPrompts(role)
      .then((prompts) => {
        if (isMounted) {
          setItems(prompts.slice(0, variant === "grid" ? 4 : 6));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load suggested prompts:", err);
        if (isMounted) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [role, variant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-ivory/40 gap-2 text-xs">
        <Loader2 className="animate-spin" size={14} />
        <span>Loading prompts...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.label)}
            className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left text-[13px] text-ivory/75 transition-all duration-300 hover:border-gold/25 hover:bg-white/[0.04] hover:text-ivory"
          >
            <Wand2 size={14} className="shrink-0 text-gold/70" strokeWidth={1.75} />
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.label)}
          className="flex w-full items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-[12.5px] leading-snug text-ivory/65 transition-all duration-300 hover:border-gold/25 hover:bg-white/[0.04] hover:text-ivory/90"
        >
          <Wand2 size={13} className="mt-0.5 shrink-0 text-gold/60" strokeWidth={1.75} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

