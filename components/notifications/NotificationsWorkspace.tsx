"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Sliders,
  Check,
  Clock,
  UserCheck,
  Play,
  Trash2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Search,
  User,
  Calendar,
  ExternalLink,
  Sparkles,
  Filter,
  Info,
  ShieldCheck,
  Zap,
  RefreshCcw,
  Plus
} from "lucide-react";
import clsx from "clsx";
import NotificationsHeader from "./NotificationsHeader";
import { notificationRepository } from "@/lib/data/repositories";

type SignalCategory =
  | "Critical"
  | "Risks"
  | "Opportunities"
  | "Decisions"
  | "Customer Signals"
  | "Revenue Signals"
  | "Operations"
  | "Workflow"
  | "AI Insights";

interface IntelligenceSignal {
  id: string;
  category: SignalCategory;
  title: string;
  timestamp: string;
  source: string;
  businessArea: string;
  urgency: "Critical" | "Urgent" | "Normal";
  confidence: number; // Percentage
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "active" | "investigating" | "understood" | "assigned";
  assignee?: string;
  
  // High-fidelity structural panels requested
  whatHappened: string;
  whyItMatters: string;
  potentialImpact: string; // naira value
  recommendedAction: string;

  // Evidence metadata
  evidenceLogs: string[];
}

export default function NotificationsWorkspace() {
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchSignals = async () => {
      try {
        const loaded = await notificationRepository.getIntelligenceSignals();
        if (isMounted && loaded) {
          setSignals(loaded as IntelligenceSignal[]);
        }
      } catch (err) {
        console.error("Failed to load intelligence signals:", err);
      }
    };
    fetchSignals();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters State
  const [activeCategory, setActiveCategory] = useState<"all" | SignalCategory>("all");
  const [activeUrgency, setActiveUrgency] = useState<"all" | "Critical" | "Urgent" | "Normal">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Detailed Modal / Evidence Overlays State
  const [investigatingSignalId, setInvestigatingSignalId] = useState<string | null>(null);
  const [assigningSignalId, setAssigningSignalId] = useState<string | null>(null);
  const [workflowCreatedId, setWorkflowCreatedId] = useState<string | null>(null);
  const [schedulingSignalId, setSchedulingSignalId] = useState<string | null>(null);

  // Status updates info feedback
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Custom Signal Creator form
  const [showCreator, setShowCreator] = useState(false);
  const [creatorCat, setCreatorCat] = useState<SignalCategory>("Risks");
  const [creatorTitle, setCreatorTitle] = useState("");
  const [creatorWhat, setCreatorWhat] = useState("");
  const [creatorWhy, setCreatorWhy] = useState("");
  const [creatorImpact, setCreatorImpact] = useState("₦5.0M");
  const [creatorAction, setCreatorAction] = useState("");

  // Handler: Dismiss
  const handleDismiss = (id: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== id));
    triggerFeedback("Signal dismissed from active radar");
  };

  // Handler: Mark Understood
  const handleMarkUnderstood = (id: string) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "understood" } : s))
    );
    triggerFeedback("Signal marked understood");
  };

  // Handler: Assign
  const handleAssign = (id: string, name: string) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "assigned", assignee: name } : s))
    );
    setAssigningSignalId(null);
    triggerFeedback(`Signal successfully routed to ${name}`);
  };

  // Handler: Create Workflow
  const handleCreateWorkflow = (id: string) => {
    setWorkflowCreatedId(id);
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "investigating" } : s))
    );
    setTimeout(() => setWorkflowCreatedId(null), 4000);
  };

  // Helper: Trigger custom status feedback toast
  const triggerFeedback = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  // Create customized signal manually
  const handleCreateSignal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorTitle.trim()) return;

    const newSig: IntelligenceSignal = {
      id: `custom-sig-${Date.now()}`,
      category: creatorCat,
      title: creatorTitle,
      timestamp: "Just now",
      source: "Manual Intelligence Dispatch",
      businessArea: "Strategic Accounts",
      urgency: "Urgent",
      confidence: 95,
      priority: "HIGH",
      status: "active",
      whatHappened: creatorWhat || "Client activity telemetry dropped below critical parameter constraints.",
      whyItMatters: creatorWhy || "Fails safety rules in general operational guidelines.",
      potentialImpact: creatorImpact || "₦5.0M",
      recommendedAction: creatorAction || "Compile executive briefing and contact owner.",
      evidenceLogs: ["Manual telemetry check completed by CEO."]
    };

    setSignals((prev) => [newSig, ...prev]);
    setShowCreator(false);
    setCreatorTitle("");
    setCreatorWhat("");
    setCreatorWhy("");
    setCreatorAction("");
    triggerFeedback("Live Intelligence Signal broadcasted");
  };

  // Calculations for executive digest
  const digestMetrics = useMemo(() => {
    const activeSigs = signals.filter((s) => s.status === "active" || s.status === "assigned");
    const customerRisksCount = activeSigs.filter(
      (s) => s.category === "Risks" || s.category === "Customer Signals"
    ).length;
    const revenueOppsCount = activeSigs.filter(
      (s) => s.category === "Opportunities" || s.category === "Revenue Signals"
    ).length;
    const operationsCount = activeSigs.filter(
      (s) => s.category === "Operations" || s.category === "Decisions"
    ).length;

    return {
      total: activeSigs.length,
      customerRisks: customerRisksCount,
      revenueOpps: revenueOppsCount,
      opsIssues: operationsCount
    };
  }, [signals]);

  // Filtering Logic
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      const matchCategory = activeCategory === "all" || s.category === activeCategory;
      const matchUrgency = activeUrgency === "all" || s.urgency === activeUrgency;
      const matchSearch =
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.whatHappened.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.businessArea.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchUrgency && matchSearch;
    });
  }, [signals, activeCategory, activeUrgency, searchTerm]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1" id="intelligence-signals-dashboard">
      <NotificationsHeader activeDigestCount={digestMetrics.total} />

      {/* FEEDBACK STATUS TOAST */}
      <AnimatePresence>
        {statusFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[12px] font-mono font-bold text-emerald shadow-emerald-glow"
          >
            <CheckCircle2 size={15} />
            <span>{statusFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        
        {/* LEFT COLUMN: ACTIVE RADER & TIMELINE CHRONOLOGY */}
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS CONTROLLER */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-3.5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
              
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30" />
                <input
                  type="text"
                  placeholder="Query telemetry feed (e.g. Meridian, failure logs)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-9.5 pr-4 py-2 text-[12px] text-ivory outline-none focus:border-gold/30 placeholder:text-ivory/25"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {(["all", "Critical", "Urgent", "Normal"] as const).map((urg) => (
                  <button
                    key={urg}
                    onClick={() => setActiveUrgency(urg)}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-[11px] font-mono font-bold uppercase transition-all",
                      activeUrgency === urg
                        ? "bg-gold text-matte shadow-gold-glow-soft"
                        : "text-ivory/50 bg-white/[0.01] hover:bg-white/[0.03]"
                    )}
                  >
                    {urg === "all" ? "All Severities" : urg}
                  </button>
                ))}
              </div>

            </div>

            {/* SECONDARY CATEGORY ROW */}
            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3.5">
              <button
                onClick={() => setActiveCategory("all")}
                className={clsx(
                  "rounded-full px-3 py-1 text-[11px] font-medium transition-all",
                  activeCategory === "all"
                    ? "bg-white/10 text-ivory border border-white/20"
                    : "text-ivory/45 hover:text-ivory/70 border border-transparent"
                )}
              >
                All Categories
              </button>
              {(
                [
                  "Critical",
                  "Risks",
                  "Opportunities",
                  "Decisions",
                  "Customer Signals",
                  "Revenue Signals",
                  "Operations",
                  "Workflow",
                  "AI Insights"
                ] as SignalCategory[]
              ).map((cat) => {
                const count = signals.filter((s) => s.category === cat).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={clsx(
                      "rounded-full px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1.5",
                      activeCategory === cat
                        ? "bg-gold/10 text-gold border border-gold/30"
                        : "text-ivory/45 hover:text-ivory/70 border border-transparent"
                    )}
                  >
                    <span>{cat}</span>
                    <span className="font-mono text-[9px] opacity-50">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SIMULATION & BROADCAST DISPATCHER CONTAINER */}
          <div className="rounded-2xl border border-gold/15 bg-gold/[0.01] p-4 shadow-glass">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-gold" />
                <p className="text-[12.5px] font-bold text-ivory">Signal Broadcast Trigger</p>
              </div>
              <button
                onClick={() => setShowCreator(!showCreator)}
                className="text-[11px] font-mono text-gold font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus size={12} />
                Broadcast Custom Signal
              </button>
            </div>

            {showCreator && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                onSubmit={handleCreateSignal}
                className="mt-4 border-t border-white/[0.05] pt-4 space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">Signal Category</label>
                    <select
                      value={creatorCat}
                      onChange={(e) => setCreatorCat(e.target.value as SignalCategory)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    >
                      <option value="Risks">Risks</option>
                      <option value="Opportunities">Opportunities</option>
                      <option value="Decisions">Decisions</option>
                      <option value="Customer Signals">Customer Signals</option>
                      <option value="Revenue Signals">Revenue Signals</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">Impact Metric</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. ₦18.4M"
                      value={creatorImpact}
                      onChange={(e) => setCreatorImpact(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">Signal Summary</label>
                    <input
                      required
                      type="text"
                      placeholder="E.g. Meridian Logistics purchasing contraction"
                      value={creatorTitle}
                      onChange={(e) => setCreatorTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">What Happened</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Explain raw facts clearly..."
                      value={creatorWhat}
                      onChange={(e) => setCreatorWhat(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">Why It Matters</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Operational or client-specific ramifications..."
                      value={creatorWhy}
                      onChange={(e) => setCreatorWhy(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] uppercase font-mono tracking-wider text-ivory/45">Recommended Action</label>
                    <input
                      required
                      type="text"
                      placeholder="E.g. Schedule review in 48 hours."
                      value={creatorAction}
                      onChange={(e) => setCreatorAction(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreator(false)}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-mono text-ivory/50 hover:bg-white/[0.03]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-gold px-4 py-1.5 text-[11px] font-mono font-bold text-matte hover:bg-gold/90 transition-colors"
                  >
                    Broadcast Signal
                  </button>
                </div>
              </motion.form>
            )}
          </div>

          {/* ACTIVE CHRONOLOGICAL FEED */}
          <div className="space-y-4">
            {filteredSignals.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass flex flex-col items-center justify-center min-h-[360px]">
                <div className="h-14 w-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                  <Radar size={26} />
                </div>
                <h3 className="font-display text-lg font-bold text-ivory">
                  {signals.length === 0 ? "Intelligence Radar on Standby" : "No Signals Match Filter"}
                </h3>
                <p className="mt-2 text-[13px] text-ivory/50 max-w-md leading-relaxed">
                  {signals.length === 0
                    ? "No anomaly signals or critical risk alerts detected across operational channels. All parameters are operating within baseline limits."
                    : "Try adjusting your category, urgency level, or search query to view other telemetry records."}
                </p>
                {signals.length === 0 && (
                  <button
                    onClick={() => setShowCreator(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2 text-[12px] font-mono font-bold text-matte hover:brightness-110 transition-all shadow-gold-glow-soft cursor-pointer"
                  >
                    <Plus size={14} />
                    Broadcast Operational Signal
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignals.map((sig) => {
                  const isCritical = sig.urgency === "Critical";
                  const isUrgent = sig.urgency === "Urgent";
                  const isUnderstood = sig.status === "understood";
                  const isAssigned = sig.status === "assigned";

                  return (
                    <motion.div
                      layout
                      key={sig.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={clsx(
                        "rounded-xl border p-5 text-left relative overflow-hidden transition-all shadow-glass",
                        isUnderstood
                          ? "bg-white/[0.01] border-white/[0.03] opacity-60"
                          : isCritical
                            ? "bg-red-500/[0.015] border-red-500/20"
                            : isUrgent
                              ? "bg-amber-500/[0.015] border-amber-500/20"
                              : "bg-white/[0.01] border-white/[0.06]"
                      )}
                    >
                      {/* Left warning stripe */}
                      <div
                        className={clsx(
                          "absolute left-0 top-0 bottom-0 w-[3px]",
                          isCritical
                            ? "bg-red-500"
                            : isUrgent
                              ? "bg-amber"
                              : sig.category === "Opportunities"
                                ? "bg-emerald"
                                : "bg-gold"
                        )}
                      />

                      {/* Header Section */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-white/[0.03] pb-3.5 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-ivory/40">{sig.timestamp}</span>
                          <span className="text-[10px] text-ivory/30">·</span>
                          <span className="font-mono text-[10px] text-gold/80">{sig.source}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border",
                              isCritical
                                ? "bg-red-500/15 border-red-500/20 text-red-400"
                                : isUrgent
                                  ? "bg-amber-500/15 border-amber-500/20 text-amber-400"
                                  : "bg-white/5 border-white/10 text-ivory/60"
                            )}
                          >
                            {sig.urgency}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/[0.03] border border-white/[0.05] text-ivory/50">
                            Confidence: {sig.confidence}%
                          </span>
                          {isAssigned && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald">
                              Assigned: {sig.assignee}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Signal Core: 4-Segment Card Specification */}
                      <div className="space-y-4">
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest font-mono text-gold font-bold">What Happened</span>
                          </div>
                          <h3 className="mt-1 text-[14.5px] font-bold text-ivory leading-snug">{sig.title}</h3>
                          <p className="mt-1 text-[12.5px] text-ivory/80 leading-relaxed">{sig.whatHappened}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.005] border border-white/[0.04] p-3 rounded-lg">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-ivory/40 block mb-0.5">Why It Matters</span>
                            <p className="text-[11.5px] text-ivory/70 leading-relaxed">{sig.whyItMatters}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-ivory/40 block mb-0.5">Potential Impact</span>
                            <p className="text-[13px] font-mono font-bold text-gold">{sig.potentialImpact}</p>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-mono text-emerald font-bold block mb-1">Recommended Action</span>
                          <p className="text-[12px] text-emerald/90 leading-relaxed bg-emerald-500/[0.02] border border-emerald-500/10 p-2.5 rounded-lg">
                            {sig.recommendedAction}
                          </p>
                        </div>

                      </div>

                      {/* Interactive Action Triggers */}
                      <div className="mt-5 pt-3.5 border-t border-white/[0.03] flex flex-wrap gap-2 justify-between items-center text-[11px]">
                        <span className="font-mono text-ivory/40 truncate">
                          Area: <strong className="text-ivory/70">{sig.businessArea}</strong>
                        </span>

                        <div className="flex flex-wrap gap-1.5">
                          
                          <button
                            onClick={() => setInvestigatingSignalId(sig.id)}
                            className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-2.5 py-1 text-ivory/70 hover:border-gold/30 hover:text-gold transition-colors font-mono text-[10.5px] cursor-pointer"
                          >
                            View Evidence
                          </button>

                          <button
                            onClick={() => setAssigningSignalId(sig.id)}
                            className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-2.5 py-1 text-ivory/70 hover:border-gold/30 hover:text-gold transition-colors font-mono text-[10.5px] cursor-pointer"
                          >
                            Assign RM
                          </button>

                          <button
                            onClick={() => setSchedulingSignalId(sig.id)}
                            className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-2.5 py-1 text-ivory/70 hover:border-gold/30 hover:text-gold transition-colors font-mono text-[10.5px] cursor-pointer"
                          >
                            Schedule Review
                          </button>

                          <button
                            onClick={() => handleCreateWorkflow(sig.id)}
                            className="rounded-lg bg-gold/15 border border-gold/20 px-2.5 py-1 text-gold hover:bg-gold/20 transition-colors font-mono text-[10.5px] cursor-pointer flex items-center gap-1 font-bold"
                          >
                            <Zap size={10} />
                            Deploy Workflow
                          </button>

                          {!isUnderstood && (
                            <button
                              onClick={() => handleMarkUnderstood(sig.id)}
                              className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald hover:bg-emerald-500/20 transition-all font-mono text-[10.5px] cursor-pointer"
                            >
                              Understand
                            </button>
                          )}

                          <button
                            onClick={() => handleDismiss(sig.id)}
                            className="rounded-lg bg-white/[0.01] px-1.5 py-1 text-ivory/30 hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
                            title="Dismiss signal"
                          >
                            <Trash2 size={11} />
                          </button>

                        </div>

                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: EXECUTIVE SIGNAL DIGEST & PRIORITY RADAR */}
        <div className="space-y-4">
          
          {/* RADER RADIAL DEVIATION INDICATOR */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass text-center relative overflow-hidden">
            <p className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider mb-4 text-left flex items-center gap-1.5">
              <Radar className="text-gold animate-spin-slow" size={13} />
              Live Priorities Radar Space
            </p>

            <div className="relative mx-auto h-40 w-40 rounded-full border border-white/[0.05] flex items-center justify-center">
              {/* Concentric circles */}
              <div className="absolute h-28 w-28 rounded-full border border-white/[0.03] flex items-center justify-center">
                <div className="absolute h-16 w-16 rounded-full border border-white/[0.02]" />
              </div>

              {/* Spinning sweep arm */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-gold/10 to-transparent rounded-full animate-radar-sweep pointer-events-none" />

              {/* Ping particles for critical signals */}
              {signals.slice(0, 3).map((sig, i) => {
                const colors = ["bg-red-500 shadow-red-glow", "bg-amber shadow-amber-glow", "bg-emerald shadow-emerald-glow"];
                const positions = [
                  "top-10 left-12",
                  "bottom-12 right-10",
                  "top-1/2 left-1/2 -translate-x-4 -translate-y-6"
                ];
                return (
                  <div
                    key={i}
                    className={clsx(
                      "absolute h-2.5 w-2.5 rounded-full animate-pulse",
                      colors[i % colors.length],
                      positions[i % positions.length]
                    )}
                  />
                );
              })}

              <Radar size={20} className="text-gold/40 z-10" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-white/[0.04] pt-3.5">
              <div>
                <p className="text-[10px] font-mono text-ivory/30 uppercase">Impact Score</p>
                <p className="text-[13.5px] font-bold text-gold font-mono">{signals.length > 0 ? "96%" : "0%"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-ivory/30 uppercase">System Drift</p>
                <p className="text-[13.5px] font-bold text-ivory font-mono">{signals.length > 0 ? "0.02" : "0.00"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-ivory/30 uppercase">Canary Confidence</p>
                <p className="text-[13.5px] font-bold text-emerald font-mono">99.9%</p>
              </div>
            </div>
          </div>

          {/* EXECUTIVE SIGNAL DIGEST */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
              <TrendingUp size={13} className="text-gold" />
              <p className="font-display text-[12px] font-bold text-ivory uppercase tracking-wider">Executive Signal Digest</p>
            </div>

            <div className="p-3 bg-gold/[0.02] border border-gold/10 rounded-lg">
              <p className="text-[13px] font-bold text-ivory">
                {digestMetrics.total === 0 ? "All operational streams normal." : `${digestMetrics.total} signals require attention today.`}
              </p>
              <p className="text-[11px] text-ivory/45 mt-0.5 leading-relaxed">
                {digestMetrics.total === 0
                  ? "APEX ONE telemetry radar is actively monitoring all integrated services."
                  : "APEX ONE has consolidated active data streams into structured priority pathways."}
              </p>
            </div>

            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                <span className="text-ivory/70">Customer SLA Risks</span>
                <span className="font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/15 px-2 py-0.5 rounded">
                  {digestMetrics.customerRisks} Active
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                <span className="text-ivory/70">Revenue Opportunities</span>
                <span className="font-mono font-bold text-emerald bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded">
                  {digestMetrics.revenueOpps} Detected
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                <span className="text-ivory/70">Operational Decisions</span>
                <span className="font-mono font-bold text-amber bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded">
                  {digestMetrics.opsIssues} Pending
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setActiveUrgency("Critical");
                }}
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] text-center py-2 text-[11px] font-mono text-ivory/70 hover:border-gold/20 hover:text-gold cursor-pointer"
              >
                Isolate High Priority Radar
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* OVERLAY: VIEW EVIDENCE / DETAILED INVESTIGATION */}
      <AnimatePresence>
        {investigatingSignalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-charcoal p-5.5 shadow-gold-glow-soft space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
                <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} />
                  Detailed Telemetry Logs & Evidence
                </p>
                <button
                  onClick={() => setInvestigatingSignalId(null)}
                  className="text-ivory/40 hover:text-ivory"
                >
                  <X size={14} />
                </button>
              </div>

              {(() => {
                const activeSig = signals.find((s) => s.id === investigatingSignalId);
                if (!activeSig) return null;
                return (
                  <div className="space-y-3.5">
                    <div>
                      <p className="text-[10px] font-mono text-ivory/30 uppercase">Source Identifier</p>
                      <p className="text-[12.5px] font-bold text-ivory">{activeSig.source}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-mono text-ivory/30 uppercase mb-1.5">Evidence Logs (Raw Payload)</p>
                      <div className="rounded-lg bg-white/[0.01] border border-white/[0.06] p-3 font-mono text-[11px] text-gold/90 space-y-2">
                        {activeSig.evidenceLogs.map((log, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-ivory/20">[{idx + 1}]</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-500/[0.02] border border-emerald-500/10 p-3">
                      <p className="text-[11px] font-mono text-emerald uppercase font-bold">Automatic Decision Pathing</p>
                      <p className="text-[11.5px] text-ivory/70 mt-1 leading-relaxed">
                        Audit compliance guidelines verify this signal meets requirements for immediate action escalation.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 border-t border-white/[0.05] pt-3.5">
                <button
                  onClick={() => setInvestigatingSignalId(null)}
                  className="rounded-lg bg-gold px-4 py-1.5 text-[11px] font-mono font-bold text-matte hover:bg-gold/90 cursor-pointer"
                >
                  Understand & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY: ASSIGN RM MODAL */}
      <AnimatePresence>
        {assigningSignalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-charcoal p-5 shadow-gold-glow-soft space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/[0.05] pb-2.5">
                <p className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={13} />
                  Route Signal Ownership
                </p>
                <button
                  onClick={() => setAssigningSignalId(null)}
                  className="text-ivory/40 hover:text-ivory"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { name: "Elena Cho", role: "Principal RM - Strategic Accounts" },
                  { name: "Marcus Webb", role: "Director - Enterprise Operations" },
                  { name: "Sarah Below", role: "Lead - Commercial Operations" },
                  { name: "Tom Reyes", role: "Engineering Lead" },
                  { name: "Nina Torres", role: "Compliance Officer" }
                ].map((member) => (
                  <button
                    key={member.name}
                    onClick={() => handleAssign(assigningSignalId, member.name)}
                    className="w-full text-left p-2.5 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.04] hover:border-gold/20 transition-all flex justify-between items-center"
                  >
                    <div>
                      <p className="text-[12px] font-bold text-ivory">{member.name}</p>
                      <p className="text-[10px] text-ivory/40">{member.role}</p>
                    </div>
                    <ChevronRight size={12} className="text-gold/60" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY: COGNITIVE WORKFLOW DEPLOY CONFIRMATION */}
      <AnimatePresence>
        {workflowCreatedId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-charcoal p-5 shadow-emerald-glow text-center space-y-3"
            >
              <Zap size={28} className="mx-auto text-emerald animate-bounce" />
              <p className="text-[13px] font-mono font-bold text-emerald uppercase tracking-wider">
                Automated Workflow Deployed
              </p>
              <p className="text-[11.5px] text-ivory/70 leading-relaxed">
                APEX ONE has successfully synthesized a target workflow for signal:
                <br />
                <strong className="text-ivory">
                  {signals.find((s) => s.id === workflowCreatedId)?.title}
                </strong>
                . Action owners have been notified via Apex Sync.
              </p>
              <button
                onClick={() => setWorkflowCreatedId(null)}
                className="mt-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald font-mono text-[11px] font-bold px-4 py-1.5 cursor-pointer"
              >
                Monitor Execution Trace
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY: SCHEDULE REVIEW SLOT */}
      <AnimatePresence>
        {schedulingSignalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-charcoal p-5 shadow-gold-glow-soft space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/[0.05] pb-2.5">
                <p className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} />
                  Schedule Review Matrix
                </p>
                <button
                  onClick={() => setSchedulingSignalId(null)}
                  className="text-ivory/40 hover:text-ivory"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-[11.5px] text-ivory/60 leading-relaxed">
                Automatically allocate a strategic conflict-free window on August 18, 2026.
              </p>

              <div className="space-y-1.5">
                {[
                  { slot: "11:00 AM - 11:30 AM", free: "Conflict Free" },
                  { slot: "02:00 PM - 02:30 PM", free: "Conflict Free" },
                  { slot: "04:30 PM - 05:00 PM", free: "Conflict Free" }
                ].map((s) => (
                  <button
                    key={s.slot}
                    onClick={() => {
                      setSchedulingSignalId(null);
                      triggerFeedback(`Review meeting booked for ${s.slot} on Aug 18.`);
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.04] hover:border-gold/20 transition-all flex justify-between items-center"
                  >
                    <div>
                      <p className="text-[12px] font-bold text-ivory">{s.slot}</p>
                      <p className="text-[10px] text-emerald font-mono">{s.free}</p>
                    </div>
                    <ChevronRight size={12} className="text-gold/60" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Simple absolute close SVG helper since Lucide X is used
function X({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
