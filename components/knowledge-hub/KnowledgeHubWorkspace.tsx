"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  History,
  Network,
  Cpu,
  Brain,
  HelpCircle,
  FileText,
  User,
  Users,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Pin,
  Clock,
  Briefcase,
  Layers,
  Scale,
  Calendar,
  Zap,
  BookOpenText,
  PlusCircle,
  X,
  Check,
  Loader2
} from "lucide-react";
import clsx from "clsx";
import KnowledgeHubHeader from "./KnowledgeHubHeader";
import { knowledgeRepository } from "@/lib/data/repositories";
import { KnowledgeSynapse, GraphNode, HistoricalEvent } from "@/lib/data/demo";

// Structured types for our memory layer
export type InstitutionalCategory =
  | "Policies"
  | "Playbooks"
  | "Contracts"
  | "Customer Knowledge"
  | "Operations"
  | "Compliance"
  | "Strategy"
  | "Decisions"
  | "Historical Intelligence";

interface SemanticSearchResult {
  query: string;
  answer: string;
  confidence: number;
  sources: string[];
  relevantDocs: string[];
  historicalRecords: string[];
  relatedDecisions: string[];
}

export default function KnowledgeHubWorkspace() {
  const [activeTab, setActiveTab] = useState<"assistant" | "graph" | "timeline" | "repository">("assistant");
  const [synapses, setSynapses] = useState<KnowledgeSynapse[]>([]);
  const [memoryTimeline, setMemoryTimeline] = useState<HistoricalEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Interactive Knowledge Graph Nodes
  const [selectedGraphNode, setSelectedGraphNode] = useState<string>("node-1");

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      knowledgeRepository.getSynapses(),
      knowledgeRepository.getHistoricalEvents()
    ]).then(([synData, timelineData]) => {
      if (isMounted) {
        setSynapses(synData);
        setMemoryTimeline(timelineData);
        if (synData.length > 0) {
          setSelectedSynapseId(synData[0].id);
        }
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Failed to fetch knowledge hub data:", err);
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const graphNodes: Record<string, GraphNode> = useMemo(() => {
    if (synapses.length === 0) {
      return {
        "node-1": {
          id: "node-1",
          label: "Strategic Accounts",
          type: "Customer",
          details: "Institutional knowledge graph anchor node.",
          connections: []
        }
      };
    }

    const map: Record<string, GraphNode> = {};
    synapses.forEach((s, idx) => {
      const typeMap: Record<string, any> = {
        Policies: "Policy",
        Playbooks: "Decision",
        Contracts: "Contract",
        "Customer Knowledge": "Customer",
        Operations: "Support",
        Compliance: "Policy",
        Strategy: "Decision",
        Decisions: "Decision",
        "Historical Intelligence": "Renewal"
      };

      const connections = synapses
        .filter((_, i) => i !== idx && Math.abs(i - idx) <= 2)
        .map((other) => other.id);

      map[s.id] = {
        id: s.id,
        label: s.title,
        type: typeMap[s.category] || "Policy",
        details: s.excerpt || s.title,
        connections
      };
    });

    return map;
  }, [synapses]);

  // Predefined Semantic Searches
  const semanticSearches: Record<string, SemanticSearchResult> = {
    "Meridian decline": {
      query: "What caused the decline in Meridian Logistics revenue last year?",
      answer: "The historical transaction logs show that the decline was primarily driven by two synchronized events: First, the departure of their primary sponsor in Q4. Second, their regional subsidiary delayed technical implementation of the automated gateway, reverting transaction payload back to manual ledgers.",
      confidence: 96,
      sources: ["Meridian Relationship Playbook", "Customer Note Archive #414", "Q2 Ops Sync Minutes"],
      relevantDocs: ["Master SLA Agreement", "Onboarding Playbook"],
      historicalRecords: ["Initial Integration Log", "Sponsor Change System Flag"],
      relatedDecisions: ["Interim RM Assignment to Elena Cho", "SLA Waiver Authorization"]
    },
    "Q3 decline": {
      query: "Why did revenue decline in Q3?",
      answer: "Aggregate Q3 variance was localized in the mid-market segment. While enterprise volume expanded, currency volatility margins combined with outdated SLA penalty indexations on legacy contracts caused a transient margin leakage. This has since been mitigated via the newly approved Naira Volatility Pricing Adjustment Policy.",
      confidence: 94,
      sources: ["Enterprise Pricing Rationalization Strategy", "Q3 Margin Telemetry Run", "SLA Compliance Ledger"],
      relevantDocs: ["Naira Indexation Policy", "Q3 Board Deck"],
      historicalRecords: ["Daily Settlement Rec Run", "Exchange SLA Parameter Audit"],
      relatedDecisions: ["Standard Pricing Adjustment on Mid-Market Contracts", "Reconciliation Exception automated logic deployment"]
    },
    "enterprise expansion": {
      query: "Which customers have historically expanded after renewal?",
      answer: "Analysis of the trailing client ledger reveals that customers utilizing the Automated Failover Gateway are 3.4x more likely to expand contract ARR during their renewal window. Prime examples include Halden & Cross Partners and Solace Home Insurance.",
      confidence: 91,
      sources: ["Halden & Cross Account Profile", "Gateway Volume Telemetry Logs", "SOP Triage Docs"],
      relevantDocs: ["Automated Failover Gateway Specs", "Upsell Pathing Playbook"],
      historicalRecords: ["Contract Expansion Milestone Report"],
      relatedDecisions: ["Automated Upsell Path Eligible Flag set active", "Strategic Accounts human advisor hour re-allocation"]
    },
    "pricing strategy": {
      query: "What was decided about enterprise pricing?",
      answer: "The Board approved a structural amendment to the enterprise pricing model. Future mid-market contracts enforce an immediate standard adjustment margin. For active enterprise accounts, standard pricing caps remain intact to protect renewal stability, with optional gateway upgrade paths.",
      confidence: 98,
      sources: ["Enterprise Pricing Rationalization Strategy", "Compliance Decree"],
      relevantDocs: ["Contract Pricing SLA Appendix B", "Gateway Core upgrade pricing schedule"],
      historicalRecords: ["Board Session transcript"],
      relatedDecisions: ["Naira Volatility Pricing Adjustment Policy ratification"]
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchResult, setActiveSearchResult] = useState<SemanticSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Repository Browsing State
  const [selectedSynapseId, setSelectedSynapseId] = useState("");
  const [repoCategory, setRepoCategory] = useState<"all" | InstitutionalCategory>("all");
  const [repoQuery, setRepoQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form State for new playbooks
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<InstitutionalCategory>("Playbooks");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formContent, setFormContent] = useState("");
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Trigger simulated search query
  const handleTriggerSearch = (key: string) => {
    setIsSearching(true);
    setActiveSearchResult(null);
    setTimeout(() => {
      setActiveSearchResult(semanticSearches[key]);
      setIsSearching(false);
    }, 600);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setActiveSearchResult(null);

    setTimeout(() => {
      const matchKey = Object.keys(semanticSearches).find(k => 
        searchQuery.toLowerCase().includes(semanticSearches[k].query.toLowerCase()) ||
        semanticSearches[k].query.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.toLowerCase().split(" ").some(word => searchQuery.toLowerCase().includes(word))
      );

      if (matchKey) {
        setActiveSearchResult(semanticSearches[matchKey]);
      } else {
        const matchingSynapse = synapses.find(s => 
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          s.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
        );

        setActiveSearchResult({
          query: searchQuery,
          answer: matchingSynapse 
            ? `${matchingSynapse.title}: ${matchingSynapse.excerpt}`
            : `Based on your query "${searchQuery}", the APEX ONE Institutional Knowledge base has analyzed matching documents. Historical records show consistent operations alignment across institutional boundaries.`,
          confidence: matchingSynapse ? 92 : 80,
          sources: matchingSynapse ? [matchingSynapse.title] : ["System Repository Match"],
          relevantDocs: ["Standard Operational SLA guidelines"],
          historicalRecords: ["Historical exception log indexes"],
          relatedDecisions: ["Strategic resource allocation memo"]
        });
      }
      setIsSearching(false);
    }, 600);
  };

  // Filter repository synapses
  const filteredSynapses = useMemo(() => {
    return synapses
      .filter((s) => repoCategory === "all" || s.category === repoCategory)
      .filter((s) => !repoQuery.trim() || s.title.toLowerCase().includes(repoQuery.toLowerCase()) || s.excerpt.toLowerCase().includes(repoQuery.toLowerCase()));
  }, [synapses, repoCategory, repoQuery]);

  const selectedSynapse = synapses.find(s => s.id === selectedSynapseId) || filteredSynapses[0] || synapses[0] || null;

  const handlePublishResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formExcerpt.trim() || !formContent.trim()) return;

    try {
      const categoryMap: Record<string, "Playbook" | "Policy" | "Onboarding" | "Product" | "Financial Regulation" | "Engineering Standard" | "Treasury Guideline"> = {
        Playbooks: "Playbook",
        Policies: "Policy",
        "Customer Knowledge": "Onboarding",
        Operations: "Engineering Standard",
        Compliance: "Financial Regulation",
        Strategy: "Product",
        Decisions: "Policy",
        "Historical Intelligence": "Treasury Guideline",
        Contracts: "Policy",
      };

      const created = await knowledgeRepository.createKnowledgeItem({
        title: formTitle,
        category: categoryMap[formCategory] || "Policy",
        summary: formExcerpt,
        content: formContent,
        author: "Current User"
      });

      setSynapses(prev => [created, ...prev]);
      setSelectedSynapseId(created.id);
      setPublishSuccess(true);
      
      // Reset
      setFormTitle("");
      setFormExcerpt("");
      setFormContent("");

      setTimeout(() => {
        setPublishSuccess(false);
        setShowForm(false);
        setActiveTab("repository");
      }, 1200);
    } catch (err) {
      console.error("Failed to publish knowledge item:", err);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1" id="institutional-knowledge-workspace">
      <KnowledgeHubHeader />

      {loading ? (
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-16 text-center shadow-glass flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-gold mb-3" size={28} />
          <p className="text-sm font-mono text-ivory/60">Loading institutional knowledge base...</p>
        </div>
      ) : (
        <>
          {/* CORE MEMORY NAVIGATION BAR */}
          <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-3">
            {[
              { id: "assistant", label: "AI Memory Assistant", icon: Brain },
              { id: "graph", label: "Institutional Graph", icon: Network },
              { id: "timeline", label: "Organizational Memory", icon: History },
              { id: "repository", label: "Synapse Library", icon: BookOpen }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono border",
                    activeTab === tab.id
                      ? "bg-gold/10 border-gold/30 text-gold shadow-gold-glow-soft"
                      : "bg-white/[0.01] border-transparent text-ivory/50 hover:bg-white/[0.03] hover:text-ivory/80"
                  )}
                >
                  <Icon size={14} className={clsx(activeTab === tab.id ? "text-gold" : "text-ivory/40")} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* MAIN DYNAMIC ARCHITECTURAL TIERS */}
          <div className="min-h-[580px]">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: AI MEMORY ASSISTANT & SEMANTIC SEARCH */}
              {activeTab === "assistant" && (
                <motion.div
                  key="assistant"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
                    
                    {/* Search query focus area */}
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
                        <div className="flex items-center gap-2 text-gold">
                          <Cpu size={15} />
                          <span className="text-[11.5px] uppercase font-mono tracking-widest font-bold">Semantic Engine Active</span>
                        </div>

                        <form onSubmit={handleCustomSearch} className="relative">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ivory/30" />
                          <input
                            type="text"
                            placeholder="Ask anything about the organization (e.g., pricing, Meridian decline, Q3 revenue)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-11 pr-32 py-3 text-[13px] text-ivory outline-none focus:border-gold/45 focus:bg-white/[0.03] placeholder:text-ivory/20"
                          />
                          <button
                            type="submit"
                            disabled={isSearching}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gold hover:bg-gold/90 text-matte px-4 py-1.5 text-[11.5px] font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isSearching ? "Searching..." : "Ask APEX ONE"}
                          </button>
                        </form>

                        {/* Pre-formatted prompt templates */}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-ivory/35 font-mono mb-2 flex items-center gap-1.5">
                            <Sparkles size={11} className="text-gold" />
                            Explore Organizational Synapses
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {Object.keys(semanticSearches).map((key) => {
                              const item = semanticSearches[key];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery(item.query);
                                    handleTriggerSearch(key);
                                  }}
                                  className="text-left rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-gold/25 p-3 transition-all flex flex-col justify-between items-start cursor-pointer group"
                                >
                                  <span className="text-[12px] font-bold text-ivory group-hover:text-gold transition-colors line-clamp-1">
                                    &ldquo;{item.query}&rdquo;
                                  </span>
                                  <span className="text-[10px] text-ivory/40 font-mono mt-1 flex items-center gap-1">
                                    Confidence: {item.confidence}% <ArrowRight size={8} className="text-gold" />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* SEARCH RESULTS OUTPUT */}
                      <AnimatePresence mode="wait">
                        {isSearching && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="rounded-2xl border border-white/[0.06] bg-charcoal/20 p-12 text-center"
                          >
                            <Brain className="mx-auto h-8 w-8 text-gold animate-pulse mb-3" />
                            <p className="text-[12.5px] font-mono text-gold/80 animate-pulse">Scanning decentralized synapses across contracts and policies...</p>
                          </motion.div>
                        )}

                        {activeSearchResult && !isSearching && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-5"
                          >
                            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald" />
                                <p className="text-[11px] font-mono font-bold text-emerald uppercase tracking-wider">Semantic Query Decoded</p>
                              </div>
                              <span className="text-[10.5px] font-mono text-gold bg-gold/15 border border-gold/20 px-2.5 py-0.5 rounded-full">
                                Confidence: {activeSearchResult.confidence}%
                              </span>
                            </div>

                            {/* Query Answer */}
                            <div className="space-y-1.5">
                              <p className="text-[11.5px] uppercase font-mono text-ivory/35">Synthesized Answer</p>
                              <p className="text-[13.5px] text-ivory leading-relaxed bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">
                                {activeSearchResult.answer}
                              </p>
                            </div>

                            {/* Evidence & Mapped Synaptic Connections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-mono text-ivory/40 block">Referenced Synapse Sources</span>
                                <div className="space-y-1.5">
                                  {activeSearchResult.sources.map((src, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11.5px] text-gold/95 bg-gold/[0.02] border border-gold/10 px-2.5 py-1.5 rounded-lg font-mono">
                                      <FileText size={11} className="text-gold" />
                                      <span className="truncate">{src}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-mono text-ivory/40 block">Relevant Contract Files</span>
                                <div className="space-y-1.5">
                                  {activeSearchResult.relevantDocs.map((doc, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11.5px] text-ivory/75 bg-white/[0.02] border border-white/[0.05] px-2.5 py-1.5 rounded-lg">
                                      <Briefcase size={11} className="text-ivory/40" />
                                      <span className="truncate">{doc}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Historical Context & Board Decisions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/[0.04] pt-4">
                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-mono text-ivory/40 block">Historical Memory Trace</span>
                                <div className="space-y-1.5">
                                  {activeSearchResult.historicalRecords.map((rec, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11.5px] text-ivory/60 bg-white/[0.01] border border-white/[0.03] px-2.5 py-1.5 rounded-lg">
                                      <History size={11} className="text-ivory/30" />
                                      <span className="truncate">{rec}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-mono text-ivory/40 block">Compounding Board Decisions</span>
                                <div className="space-y-1.5">
                                  {activeSearchResult.relatedDecisions.map((dec, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11.5px] text-emerald bg-emerald-500/[0.02] border border-emerald-500/10 px-2.5 py-1.5 rounded-lg font-medium">
                                      <ShieldCheck size={11} className="text-emerald/70" />
                                      <span className="truncate">{dec}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>

                    {/* RIGHT COLUMN: ASSISTANT SIDE STATISTICS */}
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-4.5">
                        <p className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
                          <HelpCircle size={13} className="text-gold" />
                          Cognitive Synergy Info
                        </p>

                        <div className="rounded-lg bg-gold/[0.01] border border-gold/15 p-3.5 space-y-2 text-[12px]">
                          <p className="font-bold text-ivory">APEX ONE remembers.</p>
                          <p className="text-ivory/50 leading-relaxed">
                            Every client renewal, technical support escalation, and organizational decision is indexed here to refine downstream operational workflows.
                          </p>
                        </div>

                        <div className="space-y-2.5 text-[11.5px]">
                          <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                            <span className="text-ivory/60">Semantic Synapses</span>
                            <span className="font-mono font-bold text-gold">{synapses.length} Synapses</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                            <span className="text-ivory/60">Timeline Events</span>
                            <span className="font-mono font-bold text-ivory">{memoryTimeline.length} Events</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                            <span className="text-ivory/60">Decision Logs</span>
                            <span className="font-mono font-bold text-emerald">100% Audit Trace</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowForm(true)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gold text-matte font-mono font-bold text-[11.5px] py-2.5 hover:bg-gold/95 cursor-pointer"
                        >
                          <PlusCircle size={13} />
                          Publish New Playbook
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* TAB 2: KNOWLEDGE GRAPH VISUALIZATION */}
              {activeTab === "graph" && (
                <motion.div
                  key="graph"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
                    
                    {/* Interactive graph pane */}
                    <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[500px]">
                      <div>
                        <p className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                          <Network size={13} className="text-gold animate-pulse" />
                          Dynamic Synapse Explorer
                        </p>
                        <p className="text-[12px] text-ivory/40 mt-0.5">Click any node to explore its surrounding relationship constraints.</p>
                      </div>

                      {/* Render node matrix */}
                      <div className="relative w-full h-[360px] bg-[#070b12]/50 border border-white/[0.03] rounded-xl flex items-center justify-center overflow-hidden">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 w-full max-h-full overflow-y-auto">
                          {Object.values(graphNodes).map((node) => {
                            const isActive = selectedGraphNode === node.id;
                            return (
                              <button
                                key={node.id}
                                onClick={() => setSelectedGraphNode(node.id)}
                                className={clsx(
                                  "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer",
                                  isActive 
                                    ? "border-gold bg-gold/10 text-gold shadow-gold-glow-soft" 
                                    : "border-white/[0.06] bg-white/[0.02] text-ivory/80 hover:bg-white/[0.04]"
                                )}
                              >
                                <span className="text-[12px] font-bold truncate w-full">{node.label}</span>
                                <span className="text-[9px] uppercase font-mono text-ivory/40 mt-1">{node.type}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Flow chart layout label mapping */}
                      <div className="flex justify-between border-t border-white/[0.04] pt-3.5 text-[10px] font-mono text-ivory/30">
                        <span>ORGANIZATIONAL DOMAIN</span>
                        <span>→ POLICY / SLA INTEGRATION</span>
                        <span>→ DEPLOYED WORKFLOW</span>
                      </div>

                    </div>

                    {/* RIGHT COLUMN: GRAPH METADATA DETAIL */}
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
                        <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
                          <Layers size={13} />
                          Connected Node Attributes
                        </p>

                        {(() => {
                          const activeNode = graphNodes[selectedGraphNode] || Object.values(graphNodes)[0];
                          if (!activeNode) return <p className="text-xs text-ivory/40">Select a node</p>;
                          return (
                            <div className="space-y-4">
                              <div>
                                <span className="text-[10px] uppercase font-mono text-ivory/30">Node Identifier</span>
                                <p className="text-[14px] font-bold text-ivory mt-0.5">{activeNode.label}</p>
                                <span className="inline-flex rounded px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] text-[9.5px] font-mono text-gold mt-1.5 uppercase font-bold">
                                  Type: {activeNode.type}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-mono text-ivory/30 block mb-1">Synaptic Payload</span>
                                <div className="p-3.5 bg-white/[0.01] border border-white/[0.05] rounded-xl text-[12.5px] text-ivory/80 leading-relaxed">
                                  {activeNode.details}
                                </div>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-mono text-ivory/30 block mb-1.5">Direct Intersect Relationships ({activeNode.connections.length})</span>
                                <div className="space-y-2">
                                  {activeNode.connections.map((connId) => {
                                    const target = graphNodes[connId];
                                    if (!target) return null;
                                    return (
                                      <button
                                        key={connId}
                                        onClick={() => setSelectedGraphNode(connId)}
                                        className="w-full text-left p-2 rounded-lg border border-white/[0.03] bg-white/[0.005] hover:bg-white/[0.03] hover:border-gold/20 transition-all flex justify-between items-center text-[11.5px]"
                                      >
                                        <span className="text-ivory/80 font-bold font-mono truncate">{target.label}</span>
                                        <span className="text-[10px] text-gold uppercase font-mono tracking-wider font-bold">({target.type})</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* TAB 3: ORGANIZATIONAL MEMORY TIMELINE */}
              {activeTab === "timeline" && (
                <motion.div
                  key="timeline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-6">
                    <div>
                      <h3 className="text-[16px] font-bold text-ivory uppercase tracking-tight">ORGANIZATIONAL MEMORY TIMELINE</h3>
                      <p className="text-[13px] text-ivory/45 mt-0.5">Explore active decisions, customer contracts, and historical events that refine APEX ONE operational context.</p>
                    </div>

                    <div className="relative pl-6 border-l border-white/[0.07] space-y-8 py-2">
                      {memoryTimeline.map((item, index) => (
                        <div key={index} className="relative group">
                          
                          {/* Pulsing year node anchor */}
                          <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-charcoal border-2 border-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-ping" />
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
                            <div className="pt-0.5">
                              <span className="font-mono text-[16px] font-bold text-gold tracking-tight">{item.year}</span>
                              <span className="block text-[9.5px] uppercase font-mono text-ivory/35 tracking-wider mt-1">{item.category}</span>
                            </div>

                            <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.005] group-hover:bg-white/[0.015] group-hover:border-gold/15 transition-all space-y-3">
                              <div className="flex justify-between items-start flex-wrap gap-2">
                                <h4 className="text-[14px] font-bold text-ivory">{item.title}</h4>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald border border-emerald-500/10">
                                  Impact: {item.impactValue}
                                </span>
                              </div>

                              <p className="text-[13.5px] text-ivory/70 leading-relaxed">
                                {item.description}
                              </p>

                              <div className="pt-2 border-t border-white/[0.03] flex items-center gap-2 text-[11px] font-mono text-ivory/40">
                                <span className="uppercase text-gold">Archived Evidence:</span>
                                <span className="truncate">{item.evidence}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: SYNAPSE LIBRARY / REPOSITORY */}
              {activeTab === "repository" && (
                <motion.div
                  key="repository"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
                    
                    {/* Left side browser list */}
                    <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass flex flex-col justify-between h-[520px] overflow-hidden">
                      <div className="space-y-3 h-full overflow-hidden flex flex-col">
                        
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30" />
                          <input
                            type="text"
                            placeholder="Filter playbooks..."
                            value={repoQuery}
                            onChange={(e) => setRepoQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-8.5 pr-3 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30 placeholder:text-ivory/25"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                          {filteredSynapses.map((syn) => {
                            const isSelected = (selectedSynapse?.id === syn.id);
                            return (
                              <button
                                key={syn.id}
                                onClick={() => setSelectedSynapseId(syn.id)}
                                className={clsx(
                                  "w-full text-left p-3 rounded-xl border transition-all cursor-pointer block",
                                  isSelected
                                    ? "border-gold/35 bg-white/[0.05]"
                                    : "border-transparent hover:bg-white/[0.02]"
                                )}
                              >
                                <div className="flex justify-between items-start gap-1">
                                  <span className="text-[12.5px] font-bold text-ivory line-clamp-1">{syn.title}</span>
                                  {syn.pinned && <Pin size={11} className="text-gold shrink-0 mt-0.5" />}
                                </div>
                                <p className="text-[11px] text-ivory/40 line-clamp-2 mt-1">{syn.excerpt}</p>
                                <div className="flex items-center gap-2 text-[9.5px] font-mono text-ivory/30 mt-2">
                                  <span className="bg-white/[0.04] px-1.5 py-0.5 rounded text-gold/80">{syn.category}</span>
                                  <span>·</span>
                                  <span>{syn.readTime}m read</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    </div>

                    {/* Right side reader dossier */}
                    <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass">
                      {selectedSynapse ? (
                        <div className="space-y-5">
                          <div className="border-b border-white/[0.04] pb-4">
                            <div className="flex items-center gap-2 text-[10.5px] font-mono text-gold mb-1.5">
                              <span className="uppercase">{selectedSynapse.category}</span>
                              <span>·</span>
                              <span>{selectedSynapse.date}</span>
                              <span>·</span>
                              <span>Author: {selectedSynapse.author}</span>
                            </div>
                            <h2 className="text-[20px] font-bold text-ivory">{selectedSynapse.title}</h2>
                          </div>

                          <div className="prose prose-invert max-w-none text-[13.5px] text-ivory/80 space-y-3 leading-relaxed">
                            {selectedSynapse.content.map((p, idx) => (
                              <p key={idx} className="bg-white/[0.01] p-3.5 rounded-xl border border-white/[0.03]">{p}</p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-20 text-ivory/40 font-mono text-xs">
                          No synapse selected
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* OVERLAY: FORM DRAWER FOR PUBLISHING RESOURCES */}
          <AnimatePresence>
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-matte/85 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="relative w-full max-w-[550px] rounded-2xl border border-white/[0.08] bg-charcoal p-6 shadow-glass space-y-4"
                >
                  <button
                    onClick={() => setShowForm(false)}
                    className="absolute right-4 top-4 text-ivory/30 hover:text-ivory cursor-pointer"
                  >
                    <X size={15} />
                  </button>

                  <div className="flex items-center gap-2 mb-2 border-b border-white/[0.05] pb-2">
                    <BookOpenText size={16} className="text-gold" />
                    <h3 className="font-display text-[15px] font-bold text-ivory uppercase tracking-wider">Publish Synapse Memory</h3>
                  </div>

                  {publishSuccess ? (
                    <div className="py-12 text-center space-y-3">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald border border-emerald-500/20">
                        <Check size={20} />
                      </span>
                      <p className="text-[14.5px] font-semibold text-emerald">Memory Synapse Connected!</p>
                      <p className="text-[12px] text-ivory/45">Propagating knowledge state vectors across organizational graph...</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePublishResource} className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-ivory/40 font-mono">Resource Title</label>
                        <input
                          required
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="E.g. Q3 Strategic Account Upsell Directives"
                          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-ivory outline-none focus:border-gold/30"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-ivory/40 font-mono">Synaptic Category</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as InstitutionalCategory)}
                          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1.5 text-[12.5px] text-ivory outline-none"
                        >
                          <option value="Policies">Policies</option>
                          <option value="Playbooks">Playbooks</option>
                          <option value="Contracts">Contracts</option>
                          <option value="Customer Knowledge">Customer Knowledge</option>
                          <option value="Operations">Operations</option>
                          <option value="Compliance">Compliance</option>
                          <option value="Strategy">Strategy</option>
                          <option value="Decisions">Decisions</option>
                          <option value="Historical Intelligence">Historical Intelligence</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-ivory/40 font-mono">Summary / Excerpt</label>
                        <input
                          required
                          type="text"
                          value={formExcerpt}
                          onChange={(e) => setFormExcerpt(e.target.value)}
                          placeholder="E.g. Procedural roadmap for expanding client ARR under extreme volatility."
                          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-ivory outline-none focus:border-gold/30"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-ivory/40 font-mono">Content Body (Separate paragraphs with double newlines)</label>
                        <textarea
                          required
                          rows={5}
                          value={formContent}
                          onChange={(e) => setFormContent(e.target.value)}
                          placeholder="Provide precise guidelines, historical trace indexes, and evidence benchmarks..."
                          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-ivory outline-none focus:border-gold/30 resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.05]">
                        <button
                          type="button"
                          onClick={() => setShowForm(false)}
                          className="rounded-lg px-3.5 py-1.5 text-[11.5px] font-mono text-ivory/45 hover:bg-white/[0.03]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-gold px-5 py-1.5 text-[11.5px] font-mono font-bold text-matte transition-colors hover:bg-gold/90"
                        >
                          Broadcast Synapse
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </>
      )}

    </div>
  );
}
