"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck, Database, Sparkles, Search, AlertTriangle } from "lucide-react";
import { aiRepository } from "@/lib/data/repositories/aiRepository";
import type { AiIntelligenceResponse } from "@/lib/backend/domains/ai/aiOrchestratorService";

const MODES = ["Executive", "Revenue", "Customers", "Operations", "Capacity", "Leakage", "Opportunities", "Strategy"] as const;

type Mode = (typeof MODES)[number];

interface Turn {
  id: string;
  prompt: string;
  response: AiIntelligenceResponse;
}

function EvidenceBadge({ label, state }: { label: string; state: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ivory/55">
      {label}: {state}
    </span>
  );
}

export default function TrustedAiWorkspace() {
  const [mode, setMode] = useState<Mode>("Executive");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await aiRepository.askTrusted(prompt, mode);
      setTurns((current) => [...current, { id: `${Date.now()}-${current.length}`, prompt, response }]);
      setInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-charcoal px-4 py-6 text-ivory lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.07] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold/80">
              <ShieldCheck className="h-4 w-4" /> Stage 8 trust boundary
            </div>
            <h1 className="font-display text-3xl font-semibold">APEX ONE Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm text-ivory/50">
              Deterministic repository facts and their provenance are shown separately from AI-generated synthesis.
              Model prose is never automatically verified or certified.
            </p>
          </div>
          <label className="text-xs text-ivory/45">
            Query mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as Mode)}
              className="mt-1 block rounded-lg border border-white/10 bg-charcoal-light px-3 py-2 text-sm text-ivory outline-none"
            >
              {MODES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </header>

        <div className="space-y-6">
          {turns.length === 0 && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center">
              <Search className="mx-auto h-7 w-7 text-gold/70" />
              <h2 className="mt-3 text-lg font-medium">Ask a scoped enterprise question</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-ivory/45">
                The application selects a bounded, permission-checked data scope before any model call. The model cannot request arbitrary tools or tenant data.
              </p>
            </section>
          )}

          {turns.map((turn) => (
            <article key={turn.id} className="space-y-4">
              <div className="ml-auto max-w-3xl rounded-2xl rounded-tr-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm">
                {turn.prompt}
              </div>

              <section className="rounded-2xl border border-white/[0.08] bg-charcoal-light/65 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-gold" />
                    <h3 className="text-sm font-semibold">Deterministic facts</h3>
                  </div>
                  <div className="text-[11px] text-ivory/40">
                    {turn.response.retrieval.recordsRetrieved} records retrieved • max {turn.response.retrieval.recordLimitPerTool}/tool
                  </div>
                </div>

                {turn.response.facts.length === 0 ? (
                  <p className="text-sm text-ivory/45">No deterministic facts were available in the authorized query scope.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {turn.response.facts.map((fact) => (
                      <div key={fact.id} className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-ivory/40">{fact.id}</div>
                        <div className="mt-1 text-sm text-ivory/70">{fact.label}</div>
                        <div className="mt-2 text-xl font-semibold text-gold">{fact.displayValue}</div>
                        <p className="mt-2 text-xs leading-relaxed text-ivory/40">{fact.calculation}</p>
                        <p className="mt-2 text-[11px] text-ivory/35">
                          Scope: {fact.scope.recordsRetrieved}/{fact.scope.totalMatched} records {fact.scope.complete ? "(complete)" : "(bounded sample)"}
                        </p>
                        {fact.provenance.length > 0 && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-gold/70">Source provenance ({fact.provenance.length})</summary>
                            <div className="mt-2 space-y-2">
                              {fact.provenance.map((source) => (
                                <div key={`${source.entityType}-${source.entityId}`} className="rounded-lg border border-white/[0.06] p-2 text-[11px] text-ivory/50">
                                  <div className="font-medium text-ivory/65">{source.entityType} / {source.entityId}</div>
                                  <div className="mt-1 break-all text-ivory/35">{source.sourceReference}</div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <EvidenceBadge label="verification" state={source.verificationState} />
                                    <EvidenceBadge label="certification" state={source.certificationState} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gold/15 bg-gold/[0.025] p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-semibold">AI-generated synthesis</h3>
                  <EvidenceBadge label="verification" state={turn.response.modelProse.verificationState} />
                  <EvidenceBadge label="certification" state={turn.response.modelProse.certificationState} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-ivory/75">{turn.response.modelProse.text}</p>
                <p className="mt-3 text-[11px] text-ivory/35">{turn.response.modelProse.notice}</p>
              </section>

              <section className="rounded-xl border border-white/[0.06] px-4 py-3 text-xs text-ivory/45">
                <div className="font-medium text-ivory/60">Retrieval & provenance trace</div>
                <div className="mt-2">Executed tools: {turn.response.retrieval.executedTools.join(", ") || "none"}</div>
                {turn.response.retrieval.deniedTools.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 text-amber-200/70">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Access not granted for: {turn.response.retrieval.deniedTools.map((item) => `${item.tool} (${item.requiredPermission})`).join(", ")}.
                      No records from those scopes were provided to the model.
                    </span>
                  </div>
                )}
              </section>
            </article>
          ))}
        </div>

        <form onSubmit={submit} className="sticky bottom-0 mt-6 border-t border-white/[0.07] bg-charcoal/95 py-4 backdrop-blur">
          {error && <div className="mb-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-200/80">{error}</div>}
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Ask about customers, contracts, value opportunities, operations, documents, or institutional memory…"
              className="min-h-[58px] flex-1 resize-none rounded-xl border border-white/10 bg-charcoal-light px-4 py-3 text-sm text-ivory outline-none placeholder:text-ivory/25 focus:border-gold/30"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              className="rounded-xl bg-gold px-5 text-sm font-semibold text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Retrieving…" : "Ask"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
