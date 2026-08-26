"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { ChatMessage } from "@/lib/types";
import AiOrb from "./AiOrb";
import InlinePerformanceStats from "./InlinePerformanceStats";
import InlineExecutiveReport from "./InlineExecutiveReport";
import InlineAtRiskCustomers from "./InlineAtRiskCustomers";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSettled?: () => void;
}

export default function ChatMessageBubble({ message, onSettled }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const [displayed, setDisplayed] = useState(isUser || !message.animate ? message.content : "");
  const [done, setDone] = useState(isUser || !message.animate);
  const timer = useRef<number>();

  useEffect(() => {
    if (isUser || !message.animate) return;
    let i = 0;
    const step = () => {
      i += 2;
      setDisplayed(message.content.slice(0, i));
      if (i < message.content.length) {
        timer.current = window.setTimeout(step, 12);
      } else {
        setDone(true);
        onSettled?.();
      }
    };
    step();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex justify-end"
      >
        <div className="max-w-[75%] rounded-2xl rounded-tr-md bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[13.5px] leading-relaxed text-ivory/90">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-start gap-3"
    >
      <AiOrb size="sm" />
      <div className="min-w-0 max-w-[85%] flex-1">
        <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-charcoal-light/70 px-4 py-2.5">
          <p className="text-[13.5px] leading-relaxed text-ivory/85">
            {displayed}
            {!done && (
              <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-gold/70 align-middle" />
            )}
          </p>
        </div>
        {done && message.richContent === "performance-stats" && <InlinePerformanceStats />}
        {done && message.richContent === "executive-report" && <InlineExecutiveReport />}
        {done && message.richContent === "at-risk-customers" && <InlineAtRiskCustomers />}
      </div>
    </motion.div>
  );
}
