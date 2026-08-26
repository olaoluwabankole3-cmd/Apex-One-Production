"use client";

import { useRef, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import clsx from "clsx";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  return (
    <div className="flex items-end gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 transition-colors duration-200 focus-within:border-gold/30">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autoGrow();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ask Apex Sync Intelligence anything about APEX ONE…"
        rows={1}
        disabled={disabled}
        className="max-h-[140px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ivory placeholder:text-ivory/30 outline-none disabled:opacity-50"
      />
      <button
        onClick={() => value.trim() && !disabled && onSend()}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          value.trim() && !disabled
            ? "bg-gold-gradient text-matte hover:shadow-gold-glow"
            : "bg-white/[0.05] text-ivory/25"
        )}
      >
        <ArrowUp size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
