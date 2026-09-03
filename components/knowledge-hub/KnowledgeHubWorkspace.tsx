"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Clock3, Search } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { knowledgeRepository } from "@/lib/data/repositories";

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string[];
  author: string;
  date: string;
  readTime: number;
}

interface MemoryEvent {
  year: string;
  title: string;
  category: string;
  description: string;
  evidence: string;
  impactValue: string;
}

export default function KnowledgeHubWorkspace() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [history, setHistory] = useState<MemoryEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      knowledgeRepository.getSynapses(),
      knowledgeRepository.getHistoricalEvents(),
    ])
      .then(([knowledge, memory]) => {
        if (!mounted) return;
        setItems(knowledge as KnowledgeItem[]);
        setHistory(memory as MemoryEvent[]);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.title, item.category, item.excerpt, item.author]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [items, query]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Organizational Memory
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Knowledge Hub
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Published knowledge and organizational-memory records are shown directly from
          authorized backend sources. This view does not invent semantic answers,
          confidence scores or historical evidence.
        </p>
      </header>

      <div className="relative max-w-xl">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search authorized knowledge…"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2.5 pl-9 pr-3 text-sm text-ivory outline-none placeholder:text-ivory/30 focus:border-gold/30"
        />
      </div>

      {loading ? (
        <GlassCard className="p-8 text-center text-sm text-ivory/45">
          Loading authorized knowledge…
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <BookOpenText size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">
            {items.length === 0 ? "No published knowledge records" : "No matching knowledge"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ivory/45">
            {items.length === 0
              ? "Published knowledge will appear here after authorized records are created and approved."
              : "Try a different search term."}
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => (
            <GlassCard key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-bold text-ivory">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gold/60">
                    {item.category}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-ivory/35">
                  <Clock3 size={12} /> {item.readTime} min
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ivory/50">{item.excerpt}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ivory/35">
                <span>{item.author}</span>
                <span>{item.date}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassCard className="p-6">
        <p className="font-display text-lg font-bold text-ivory">
          Organizational memory records
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ivory/45">
            No authorized historical-memory records are available.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {history.slice(0, 8).map((event, index) => (
              <div
                key={`${event.year}-${event.title}-${index}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="text-sm font-semibold text-ivory">{event.title}</p>
                <p className="mt-1 text-xs text-ivory/45">{event.description}</p>
                <p className="mt-2 font-mono text-[10px] text-ivory/30">{event.evidence}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {failed && (
        <p className="text-sm text-crimson/80">
          The knowledge request could not be completed.
        </p>
      )}
    </div>
  );
}
