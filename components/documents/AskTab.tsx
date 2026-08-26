"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { documentRepository } from "@/lib/data/repositories";
import { ChatMessage, DocumentItem } from "@/lib/types";

import AiOrb from "@/components/ai-workspace/AiOrb";
import ChatMessageBubble from "@/components/ai-workspace/ChatMessageBubble";
import ChatInput from "@/components/ai-workspace/ChatInput";
import TypingIndicator from "@/components/ai-workspace/TypingIndicator";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `docmsg-${idCounter}`;
}

interface AskTabProps {
  doc: DocumentItem;
}

export default function AskTab({ doc }: AskTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  if (doc.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Loader2 size={22} className="animate-spin text-gold" />
        <p className="text-[13px] text-ivory/45">
          Q&A will be available once this document finishes processing.
        </p>
      </div>
    );
  }

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }]);
    setInput("");
    setThinking(true);

    const delay = 400 + Math.random() * 200;
    window.setTimeout(async () => {
      const answer = await documentRepository.getDocumentAnswer(trimmed, doc);
      setThinking(false);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: answer, animate: true }]);
    }, delay);

  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="max-h-[340px] min-h-[160px] flex-1 overflow-y-auto pb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AiOrb size="md" pulsing />
            <p className="text-[13px] text-ivory/50">Ask anything about this document.</p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {doc.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11.5px] text-ivory/65 transition-colors duration-200 hover:border-gold/25 hover:text-ivory"
                >
                  <Wand2 size={11} className="text-gold/60" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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

      <div className="border-t border-white/[0.06] pt-3">
        <ChatInput value={input} onChange={setInput} onSend={() => send(input)} disabled={thinking} />
      </div>
    </div>
  );
}
