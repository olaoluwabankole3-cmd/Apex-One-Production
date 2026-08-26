"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChatMessage } from "@/lib/types";
import AiOrb from "./AiOrb";
import ChatMessageBubble from "./ChatMessageBubble";
import ChatInput from "./ChatInput";
import SuggestedPrompts from "./SuggestedPrompts";
import TypingIndicator from "./TypingIndicator";

interface ChatWindowProps {
  messages: ChatMessage[];
  input: string;
  thinking: boolean;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
}

export default function ChatWindow({ messages, input, thinking, onInputChange, onSend }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal/40 shadow-glass">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <AiOrb size="lg" pulsing />
              <h2 className="mt-5 font-display text-[22px] font-bold tracking-tight text-ivory">
                How can I help you run APEX ONE today?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13.5px] text-ivory/45">
                Ask about performance, generate reports, or surface accounts that need attention —
                Apex Sync Intelligence has live context across all four business units.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 w-full max-w-lg"
            >
              <SuggestedPrompts onSelect={onSend} variant="grid" />
            </motion.div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m) => (
              <ChatMessageBubble key={m.id} message={m} />
            ))}
            {thinking && (
              <div className="flex items-start gap-3">
                <AiOrb size="sm" />
                <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-charcoal-light/70 px-4 py-2.5">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-4 lg:p-5">
        <ChatInput value={input} onChange={onInputChange} onSend={() => onSend(input)} disabled={thinking} />
        <p className="mt-2 px-1 text-[11px] text-ivory/30">
          Apex Sync Intelligence uses simulated data in this prototype. Responses are illustrative.
        </p>
      </div>
    </div>
  );
}
