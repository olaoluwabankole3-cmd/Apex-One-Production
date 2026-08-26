"use client";

import { useState, useMemo } from "react";
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
  Check
} from "lucide-react";
import clsx from "clsx";
import { isDemoMode } from "@/lib/demo";
import KnowledgeHubHeader from "./KnowledgeHubHeader";

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

interface KnowledgeSynapse {
  id: string;
  title: string;
  category: InstitutionalCategory;
  excerpt: string;
  content: string[];
  author: string;
  date: string;
  readTime: number;
  pinned?: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  type: "Customer" | "Contract" | "Meeting" | "Support" | "Renewal" | "Decision" | "Revenue" | "Policy";
  details: string;
  connections: string[]; // Node IDs this connects to
}

interface HistoricalEvent {
  year: string;
  title: string;
  category: string;
  description: string;
  evidence: string;
  impactValue: string;
}

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

  // Expanded high-fidelity knowledge library matching our 9 categories
  const [synapses, setSynapses] = useState<KnowledgeSynapse[]>([
    {
      id: "syn-1",
      title: "Enterprise Revenue Margin Volatility & Escalation Protocol",
      category: "Policies",
      excerpt: "Official policy governing minimum operating margin triggers and Naira pricing adjustment margins.",
      content: [
        "In events where extreme macroeconomic fluctuations cause a direct operational margin degradation of >3%, Relationship Managers must invoke the Naira pricing indexation formula specified in Clause 4.2 of client contracts.",
        "Under no circumstances should the legacy flat rates be maintained if the 30-day volatility index crosses standard deviation boundaries.",
        "All updates must be audited by Priya Shah's compliance team and ratified by the CEO within 4 days."
      ],
      author: "Priya Shah",
      date: "Aug 12, 2026",
      readTime: 4,
      pinned: true
    },
    {
      id: "syn-2",
      title: "Meridian Logistics Relationship & Onboarding Playbook",
      category: "Playbooks",
      excerpt: "Strategic instructions for managing regional sponsors and mitigating onboarding churn risks.",
      content: [
        "When an enterprise account flags high churn telemetry (such as a 38% decrease in buying activity), the primary RM must conduct an urgent stakeholder audit.",
        "Assess whether the friction stems from technical integration lag or regional executive turnover. In the case of Meridian, the departure of the VP of Finance is the leading cause.",
        "Execute immediate onboarding failover paths, and assign an interim Relationship Director to re-anchor contract expectations."
      ],
      author: "Elena Cho",
      date: "Aug 15, 2026",
      readTime: 3,
      pinned: true
    },
    {
      id: "syn-3",
      title: "Brightwell Regional Bank Core Infrastructure Contract",
      category: "Contracts",
      excerpt: "Original contract provisions, service level agreements, and peak hour capacity failover rates.",
      content: [
        "Brightwell Regional Bank is entitled to 99.95% transaction uptime across our payment gateway pathways.",
        "If throughput exceed limits on their legacy Tier-2 configuration, they are automatically eligible for priority failover upgrades at pre-negotiated volume margins of ₦11.2M contract uplift.",
        "SLA compliance margins are reported automatically to the Enterprise Operations dashboard on a trailing 24-hour cycle."
      ],
      author: "Legal & Compliance Team",
      date: "Jan 14, 2025",
      readTime: 5
    },
    {
      id: "syn-4",
      title: "Solace Home Insurance Support Escalation History",
      category: "Customer Knowledge",
      excerpt: "Deep context surrounding recurring claims processing bottlenecks and resolution timelines.",
      content: [
        "Solace Home Insurance has flagged persistent delays in batch claims settlement since early Q2 2026.",
        "Investigation reveals the issue is not platform latency, but rather their internal legacy SOAP integration failing to handle modern Webhook retry patterns.",
        "The recommended fix is upgrading Solace to our automated claims intake triage pipeline."
      ],
      author: "Jordan Lee",
      date: "Jul 22, 2026",
      readTime: 3
    },
    {
      id: "syn-5",
      title: "Q3 2026 Enterprise Pricing Rationalization Strategy",
      category: "Strategy",
      excerpt: "Board decision memo establishing updated pricing frameworks across all commercial subsidiaries.",
      content: [
        "To offset currency volatility and SLA buffer costs, the board has approved a standard 12% pricing adjustment on all newly initiated mid-market contracts.",
        "Legacy enterprise contracts remain locked under historical caps until their respective renewal dates.",
        "RMs should utilize the custom 'Enterprise Gateway upgrade path' as the primary strategy to migrate clients to higher margin packages without friction."
      ],
      author: "Leadership Team",
      date: "Aug 02, 2026",
      readTime: 6
    },
    {
      id: "syn-6",
      title: "Automated Reconciliation Exception Guidelines",
      category: "Operations",
      excerpt: "Operations playbook for managing system discrepancies and resolving daily exceptions.",
      content: [
        "Reconciliation runs execute automatically at 23:55 daily across all active operational ledgers.",
        "Any variance >₦500k must trigger an automated compliance incident, routing directly to the on-call Operations Specialist.",
        "Historical data indicates that 92% of variances stem from standard settlement cutoff delay offsets rather than actual transaction discrepancies."
      ],
      author: "Marcus Webb",
      date: "Jul 29, 2026",
      readTime: 4
    }
  ]);

  // Interactive Knowledge Graph Nodes
  const [selectedGraphNode, setSelectedGraphNode] = useState<string>("node-1");
  const graphNodes: Record<string, GraphNode> = {
    "node-1": {
      id: "node-1",
      label: "Meridian Logistics Group",
      type: "Customer",
      details: "Enterprise Customer. Strategic relationship established Mar 2023. Currently flagged At-Risk due to buying patterns drop and sponsor exit.",
      connections: ["node-2", "node-3", "node-4"]
    },
    "node-2": {
      id: "node-2",
      label: "Master SLA Agreement (2025)",
      type: "Contract",
      details: "₦18.4M Annual Contract. Governs operational turnaround SLAs and regional transaction processing caps.",
      connections: ["node-1", "node-5"]
    },
    "node-3": {
      id: "node-3",
      label: "Q2 Operations Review Sync",
      type: "Meeting",
      details: "Historical sync between Marcus Fenwick and Elena Cho regarding technical onboarding milestones.",
      connections: ["node-1", "node-6"]
    },
    "node-4": {
      id: "node-4",
      label: "Onboarding SLA Slip Exception",
      type: "Support",
      details: "Support ticket #90214. Operational delay flagged in setting up regional subsidiary access ports.",
      connections: ["node-1", "node-5", "node-7"]
    },
    "node-5": {
      id: "node-5",
      label: "Sponsor Transition Decision Memo",
      type: "Decision",
      details: "Board ruling to assign interim RM and bypass standard SLA audit steps during executive onboarding.",
      connections: ["node-2", "node-4", "node-8"]
    },
    "node-6": {
      id: "node-6",
      label: "Naira Indexation Policy",
      type: "Policy",
      details: "Standard Compliance policy forcing exchange-rate linked pricing variables under high volatility.",
      connections: ["node-3", "node-8"]
    },
    "node-7": {
      id: "node-7",
      label: "₦18.4M Annual Recurring Revenue",
      type: "Revenue",
      details: "Active financial run rate of the Meridian relationship, mapped against target expansion projections.",
      connections: ["node-4", "node-8"]
    },
    "node-8": {
      id: "node-8",
      label: "Apex Sync Priority Onboarding Pathway",
      type: "Decision",
      details: "The core cognitive automation that routes resources to critical onboarding steps.",
      connections: ["node-5", "node-6", "node-7"]
    }
  };

  // Memory Timeline
  const memoryTimeline: HistoricalEvent[] = [
    {
      year: "2024",
      title: "Major Customer Acquisition Phase",
      category: "Historical Intelligence",
      description: "Meridian Logistics Group and Halden & Cross successfully onboarded onto our cognitive ledgers. Established original SLA baselines.",
      evidence: "Board Meeting Minutes (Mar 2024), Contract Sign-offs",
      impactValue: "₦22.5M Initial ARR"
    },
    {
      year: "2025",
      title: "Contract Expansion & Automation Launch",
      category: "Strategy",
      description: "Deployed the first iteration of the Automated failover bypass gateway. 14 mid-market accounts successfully transitioned.",
      evidence: "Engineering Release Log v1.4, Upgraded SLA contracts",
      impactValue: "₦14.2M Margin Uplift"
    },
    {
      year: "2026 (Q1)",
      title: "Strategic Support Escalation Peak",
      category: "Operations",
      description: "Surge in strategic transaction volume led to advisor resource squeeze. Prompted development of Apex Routing Optimizer.",
      evidence: "Ops Resolution Report (Apr 2026), Audit exception logs",
      impactValue: "98.4% SLA Preservation"
    },
    {
      year: "2026 (Q3)",
      title: "Naira Indexation & Real-Time Synapse Deploy",
      category: "Compliance",
      description: "Integration of real-time currency buffers across contracts to hedge volatility and prevent margin leaks.",
      evidence: "Compliance Audit Decree #44, Live Synapse Telemetry",
      impactValue: "₦15.0M Leakage Mitigated"
    }
  ];

  // Predefined Semantic Searches
  const semanticSearches: Record<string, SemanticSearchResult> = {
    "Meridian decline": {
      query: "What caused the decline in Meridian Logistics revenue last year?",
      answer: "The historical transaction logs show that the decline was primarily driven by two synchronized events: First, the departure of their primary sponsor (Marcus Fenwick, VP of Finance) in Q4, which created an executive relationship vacuum. Second, their regional subsidiary delayed technical implementation of our automated gateway, reverting 38% of their transaction payload back to legacy manual ledgers.",
      confidence: 96,
      sources: ["Meridian Relationship Playbook (syn-2)", "Customer Note Archive #414", "Q2 Ops Sync Minutes"],
      relevantDocs: ["Master SLA Agreement (2025)", "Onboarding Playbook"],
      historicalRecords: ["2024 Initial Integration Log", "Sponsor Change System Flag"],
      relatedDecisions: ["Interim RM Assignment to Elena Cho", "SLA Waiver Authorization"]
    },
    "Q3 decline": {
      query: "Why did revenue decline in Q3?",
      answer: "Aggregate Q3 decline was heavily localized in the mid-market segment. While enterprise volume expanded by 12%, currency volatility margins combined with outdated SLA penalty indexations on 14 contracts caused a direct margin leakage. This has since been mitigated via the newly approved Naira Volatility Pricing Adjustment Policy.",
      confidence: 94,
      sources: ["Enterprise Pricing Rationalization Strategy (syn-5)", "Q3 Margin Telemetry Run", "SLA Compliance Ledger"],
      relevantDocs: ["Naira Indexation Policy", "Q3 Board Deck"],
      historicalRecords: ["Daily Settlement Rec Run (Sep 2025)", "Exchange SLA Parameter Audit"],
      relatedDecisions: ["12% Standard Pricing Adjustment on Mid-Market Contracts", "Reconciliation Exception automated logic deployment"]
    },
    "enterprise expansion": {
      query: "Which customers have historically expanded after renewal?",
      answer: "Analysis of the trailing 24-month client ledger reveals that customers utilizing the Automated Failover Gateway are 3.4x more likely to expand contract ARR during their renewal window. Prime examples include Halden & Cross Partners (expanded by 18% following support auto-routing upgrades) and Solace Home Insurance, which is currently eligible for an upsell to automated triage.",
      confidence: 91,
      sources: ["Halden & Cross Account Profile", "Gateway Volume Telemetry Logs", "SOP Triage Docs"],
      relevantDocs: ["Automated Failover Gateway Specs", "Upsell Pathing Playbook"],
      historicalRecords: ["2025 Contract Expansion Milestone Report"],
      relatedDecisions: ["Automated Upsell Path Eligible Flag set active", "Strategic Accounts human advisor hour re-allocation"]
    },
    "pricing strategy": {
      query: "What was decided about enterprise pricing?",
      answer: "On August 2, 2026, the Board approved a structural amendment to the enterprise pricing model. Future mid-market contracts will enforce an immediate 12% standard adjustment margin. For active enterprise accounts, standard pricing caps remain intact to protect renewal stability, but RMs are instructed to offer the 'Premium automated gateway' upgrade path as a value-add up-charge option.",
      confidence: 98,
      sources: ["Q3 2026 Enterprise Pricing Rationalization Strategy (syn-5)", "Compliance Decree #44"],
      relevantDocs: ["Contract Pricing SLA Appendix B", "Gateway Core upgrade pricing schedule"],
      historicalRecords: ["Aug 2 Board Session transcript"],
      relatedDecisions: ["Naira Volatility Pricing Adjustment Policy ratification"]
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchResult, setActiveSearchResult] = useState<SemanticSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Repository Browsing State
  const [selectedSynapseId, setSelectedSynapseId] = useState("syn-1");
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
    }, 800);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setActiveSearchResult(null);

    // Dynamic match fallback
    setTimeout(() => {
      const matchKey = Object.keys(semanticSearches).find(k => 
        searchQuery.toLowerCase().includes(semanticSearches[k].query.toLowerCase()) ||
        semanticSearches[k].query.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.toLowerCase().split(" ").some(word => searchQuery.toLowerCase().includes(word))
      );

      if (matchKey) {
        setActiveSearchResult(semanticSearches[matchKey]);
      } else {
        // Generative mock fallback utilizing available synapses as source
        setActiveSearchResult({
          query: searchQuery,
          answer: `Based on your query "${searchQuery}", the APEX ONE Institutional Knowledge base has analyzed matching documents. We have retrieved historical records showing consistent operations alignment, though some exact telemetry parameters are still undergoing index reconciliation. We recommend reviewing the Enterprise Revenue Volatility policy (syn-1) or contacting Priya Shah's compliance team for direct confirmation.`,
          confidence: 84,
          sources: ["System Repository Match", "Enterprise Volatility Policy (syn-1)"],
          relevantDocs: ["Standard Operational SLA guidelines"],
          historicalRecords: ["Historical exception log indexes"],
          relatedDecisions: ["Strategic hour allocation memo"]
        });
      }
      setIsSearching(false);
    }, 1000);
  };

  // Filter repository synapses
  const filteredSynapses = useMemo(() => {
    return synapses
      .filter((s) => repoCategory === "all" || s.category === repoCategory)
      .filter((s) => !repoQuery.trim() || s.title.toLowerCase().includes(repoQuery.toLowerCase()) || s.excerpt.toLowerCase().includes(repoQuery.toLowerCase()));
  }, [synapses, repoCategory, repoQuery]);

  const selectedSynapse = synapses.find(s => s.id === selectedSynapseId) || synapses[0];

  const handlePublishResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formExcerpt.trim() || !formContent.trim()) return;

    const newSyn: KnowledgeSynapse = {
      id: `custom-syn-${Date.now()}`,
      title: formTitle,
      category: formCategory,
      excerpt: formExcerpt,
      content: formContent.split("\n\n").filter(p => p.trim()),
      author: "Ola Adekunle",
      date: "Just now",
      readTime: Math.max(1, Math.ceil(formContent.split(/\s+/).length / 220))
    };

    setSynapses(prev => [newSyn, ...prev]);
    setSelectedSynapseId(newSyn.id);
    setPublishSuccess(true);
    
    // Reset
    setFormTitle("");
    setFormExcerpt("");
    setFormContent("");

    setTimeout(() => {
      setPublishSuccess(false);
      setShowForm(false);
      setActiveTab("repository");
    }, 1800);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1" id="institutional-knowledge-workspace">
      <KnowledgeHubHeader />

      {!isDemoMode() ? (
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass max-w-2xl mx-auto my-12" id="knowledge-empty-state">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/5 border border-gold/15 text-gold mb-5">
            <BookOpenText size={24} className="animate-pulse" />
          </div>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-ivory uppercase">
            Institutional knowledge not connected
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ivory/55">
            Connect organizational sources (confluence, company wikis, policies, procedures, and historical decision registries) to build the core knowledge base and empower AI query engines.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
              Synapse Index Offline
            </span>
            <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
              0 Synapses Mapped
            </span>
          </div>
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
                      <span className="text-[11.5px] uppercase font-mono tracking-widest font-bold">Semantic Engine v2.4 Active</span>
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

                  {/* SEARCH RESULTS OUTPUT - High-fidelity structured panels */}
                  <AnimatePresence mode="wait">
                    {isSearching && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border border-white/[0.06] bg-charcoal/20 p-12 text-center"
                      >
                        <Brain className="mx-auto h-8 w-8 text-gold animate-pulse mb-3" />
                        <p className="text-[12.5px] font-mono text-gold/80 animate-pulse">Scanning decentralized synapses across contracts, emails, and ledgers...</p>
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
                        Every single client renewal, technical support escalation, and executive sponsor board transition is archived here to refine our downstream operational workflow generation.
                      </p>
                    </div>

                    <div className="space-y-2.5 text-[11.5px]">
                      <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                        <span className="text-ivory/60">Semantic Indexes</span>
                        <span className="font-mono font-bold text-gold">4,128 Synapses</span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                        <span className="text-ivory/60">Active Document Pools</span>
                        <span className="font-mono font-bold text-ivory">190 Contracts</span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                        <span className="text-ivory/60">Decision Logs Retained</span>
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
                
                {/* SVG/Interactive graph pane */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[500px]">
                  <div>
                    <p className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                      <Network size={13} className="text-gold animate-pulse" />
                      Dynamic Synapse Explorer
                    </p>
                    <p className="text-[12px] text-ivory/40 mt-0.5">Click any node to explore its surrounding relationship constraints.</p>
                  </div>

                  {/* Render simulated node matrix inside SVG layout */}
                  <div className="relative w-full h-[360px] bg-[#070b12]/50 border border-white/[0.03] rounded-xl flex items-center justify-center">
                    
                    {/* Visual connection wires dynamically drawn based on selected node */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {/* Anchor lines */}
                      <line x1="18%" y1="20%" x2="50%" y2="50%" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
                      <line x1="82%" y1="20%" x2="50%" y2="50%" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
                      <line x1="15%" y1="80%" x2="50%" y2="50%" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
                      <line x1="85%" y1="80%" x2="50%" y2="50%" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />

                      <line x1="18%" y1="20%" x2="82%" y2="20%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="15%" y1="80%" x2="85%" y2="80%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                      {/* Highlighted active node paths */}
                      {selectedGraphNode && (() => {
                        const activeNode = graphNodes[selectedGraphNode];
                        // Mappings for screen percentages
                        const posMap: Record<string, {x: string, y: string}> = {
                          "node-1": { x: "50%", y: "50%" },
                          "node-2": { x: "18%", y: "20%" },
                          "node-3": { x: "82%", y: "20%" },
                          "node-4": { x: "15%", y: "80%" },
                          "node-5": { x: "85%", y: "80%" },
                          "node-6": { x: "50%", y: "15%" },
                          "node-7": { x: "50%", y: "85%" },
                          "node-8": { x: "12%", y: "50%" }
                        };

                        const currentPos = posMap[activeNode.id];
                        return activeNode.connections.map((connId, idx) => {
                          const connPos = posMap[connId];
                          if (!currentPos || !connPos) return null;
                          return (
                            <motion.line
                              key={idx}
                              x1={currentPos.x}
                              y1={currentPos.y}
                              x2={connPos.x}
                              y2={connPos.y}
                              stroke="rgba(212,175,55,0.8)"
                              strokeWidth="2"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.5 }}
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Node items */}
                    {[
                      { id: "node-2", pos: "top-8 left-[10%]", color: "border-purple-500/30 bg-purple-500/5 text-purple-400" },
                      { id: "node-3", pos: "top-8 right-[10%]", color: "border-blue-500/30 bg-blue-500/5 text-blue-400" },
                      { id: "node-6", pos: "top-4 left-1/2 -translate-x-1/2", color: "border-orange-500/30 bg-orange-500/5 text-orange-400" },
                      { id: "node-1", pos: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", color: "border-gold bg-gold/10 text-gold shadow-gold-glow-soft h-16 w-16" },
                      { id: "node-8", pos: "top-1/2 left-4 -translate-y-1/2", color: "border-pink-500/30 bg-pink-500/5 text-pink-400" },
                      { id: "node-4", pos: "bottom-8 left-[8%]", color: "border-red-500/30 bg-red-500/5 text-red-400" },
                      { id: "node-5", pos: "bottom-8 right-[8%]", color: "border-amber/30 bg-amber/5 text-amber" },
                      { id: "node-7", pos: "bottom-4 left-1/2 -translate-x-1/2", color: "border-emerald/30 bg-emerald/5 text-emerald" }
                    ].map((nodeConfig) => {
                      const details = graphNodes[nodeConfig.id];
                      const isActive = selectedGraphNode === nodeConfig.id;
                      return (
                        <button
                          key={nodeConfig.id}
                          onClick={() => setSelectedGraphNode(nodeConfig.id)}
                          className={clsx(
                            "absolute flex flex-col items-center justify-center rounded-xl border text-[11px] font-mono font-bold px-3 py-2 transition-all cursor-pointer",
                            nodeConfig.color,
                            isActive ? "scale-110 ring-2 ring-gold/40 z-20" : "opacity-75 hover:opacity-100"
                          )}
                          style={{ top: nodeConfig.pos.includes("top") ? undefined : undefined }}
                        >
                          <span className="text-center truncate max-w-[120px]">{details.label}</span>
                          <span className="text-[8px] opacity-50 block mt-0.5 uppercase tracking-wider">({details.type})</span>
                        </button>
                      );
                    })}

                  </div>

                  {/* Flow chart layout label mapping */}
                  <div className="flex justify-between border-t border-white/[0.04] pt-3.5 text-[10px] font-mono text-ivory/30">
                    <span>CUSTOMER MATRIX</span>
                    <span>→ INTEGRATION SLA</span>
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
                      const activeNode = graphNodes[selectedGraphNode];
                      if (!activeNode) return null;
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
                        const isSelected = selectedSynapseId === syn.id;
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
                            <p className="text-[12.5px] font-bold text-ivory line-clamp-1">{syn.title}</p>
                            <p className="text-[11px] text-ivory/45 mt-1 line-clamp-1">{syn.excerpt}</p>
                            <div className="mt-2 flex items-center justify-between text-[9.5px] font-mono text-ivory/30">
                              <span className="text-gold/80">{syn.category}</span>
                              <span>{syn.readTime} min read</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                  </div>

                  <div className="pt-3 border-t border-white/[0.04]">
                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gold/10 border border-gold/20 text-gold font-mono font-bold text-[11.5px] py-2 hover:bg-gold/15 cursor-pointer"
                    >
                      <PlusCircle size={13} />
                      Publish Playbook
                    </button>
                  </div>
                </div>

                {/* Right side item display */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass space-y-4">
                  {selectedSynapse ? (
                    <motion.div
                      key={selectedSynapse.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-gold">
                          {selectedSynapse.category}
                        </span>
                        {selectedSynapse.pinned && (
                          <span className="flex items-center gap-1 text-[11px] text-gold/70 font-mono">
                            <Pin size={11} />
                            Pinned Synapse
                          </span>
                        )}
                      </div>

                      <h2 className="font-display text-[20px] font-bold text-ivory leading-snug">{selectedSynapse.title}</h2>
                      <p className="text-[13.5px] text-ivory/50 leading-relaxed">{selectedSynapse.excerpt}</p>

                      <div className="flex items-center gap-4 border-y border-white/[0.05] py-2.5 text-[11px] font-mono text-ivory/35">
                        <span>Owner: {selectedSynapse.author}</span>
                        <span>Published: {selectedSynapse.date}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {selectedSynapse.readTime} Min Read
                        </span>
                      </div>

                      <div className="space-y-4 pt-2">
                        {selectedSynapse.content.map((p, idx) => (
                          <p key={idx} className="text-[13.5px] text-ivory/70 leading-relaxed">
                            {p}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-center py-20 text-ivory/35">Select a resource to begin exploring.</div>
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
