"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import {
  Brain,
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  FileText,
  Clock,
  Briefcase,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Percent,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Activity,
  Layers,
  Cpu
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

interface Message {
  sender: "user" | "analyst";
  text?: string;
  isStructured?: boolean;
  structuredData?: {
    finding: string;
    evidence: string;
    historicalContext: string;
    signals?: string[];
    businessImpact: string;
    recommendation: string;
    confidence: number;
  };
}

type AnalysisMode = "Revenue" | "Customers" | "Operations" | "Capacity" | "Leakage" | "Opportunities" | "Strategy" | "Executive";

export default function ApexValueAnalystPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "analyst",
      text: !isDemoMode()
        ? "Greetings. I am the **Apex Value Analyst**.\n\n**Organizational intelligence is not connected yet.**\n\nConnect organizational data to enable:\n- Historical financial analysis\n- Customer value & expansion modeling\n- Revenue leakage detection\n- Operational capacity optimization\n- Executive decision support"
        : "Greetings. I am the **Apex Value Analyst**. Unlike a generic LLM, I operate with deep access to our organization's historical memory, active contracts, and clearing metrics.\n\nChoose an **Analysis Mode** in the sidebar to calibrate my diagnostic scopes, or query me directly on any client performance or cost leakages.",
      isStructured: false
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>("Revenue");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat window
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Context Panel Realistic Metrics
  const contextMemoryMetrics = useMemo(() => {
    if (!isDemoMode()) {
      return [
        { label: "Active Customers", value: "—", icon: UsersIcon },
        { label: "Historical Transactions", value: "—", icon: Database },
        { label: "Audited Documents", value: "—", icon: FileText },
        { label: "Valid Contracts", value: "—", icon: Briefcase },
        { label: "Active Workflows", value: "—", icon: Layers },
        { label: "Governance Decisions", value: "—", icon: ShieldCheck },
        { label: "Organizational Memory", value: "Awaiting Data", icon: Clock }
      ];
    }
    return [
      { label: "Active Customers", value: "48,210", icon: UsersIcon },
      { label: "Historical Transactions", value: "2.4M", icon: Database },
      { label: "Audited Documents", value: "184,000", icon: FileText },
      { label: "Valid Contracts", value: "12,840", icon: Briefcase },
      { label: "Active Workflows", value: "8,421", icon: Layers },
      { label: "Governance Decisions", value: "34,820", icon: ShieldCheck },
      { label: "Organizational Memory", value: "7 Years", icon: Clock }
    ];
  }, []);

  // Map modes to specific specialized suggestions
  const modeSuggestions: Record<AnalysisMode, string[]> = useMemo(() => {
    if (!isDemoMode()) {
      return {
        Revenue: [
          "How will revenue leakage be identified?",
          "What financial ledgers can be connected?",
          "How are historical performance baselines established?"
        ],
        Customers: [
          "How is customer lifetime value (LTV) calculated?",
          "What CRM data sources are supported?",
          "How does expansion modeling work?"
        ],
        Operations: [
          "What operational telemetry streams can be integrated?",
          "How are recurring operational bottlenecks detected?"
        ],
        Capacity: [
          "How is resource and personnel capacity measured?",
          "How does capacity reclaim modeling work?"
        ],
        Leakage: [
          "What types of revenue leakage can be identified?",
          "How are billing and contract discrepancies tracked?"
        ],
        Opportunities: [
          "How does continuous value discovery function?",
          "What criteria prioritize potential opportunities?"
        ],
        Strategy: [
          "How are executive decision roadmaps generated?",
          "What governance models are supported?"
        ],
        Executive: [
          "How are verified ROI captures audited?",
          "What reporting formats are available?"
        ]
      };
    }
    return {
      Revenue: [
        "Why has Meridian Logistics underperformed this year?",
        "Where have we consistently lost revenue?",
        "What changed compared with last year's treasury yield?"
      ],
      Customers: [
        "How has this customer performed over the last five years?",
        "Which customers historically expanded after renewal?",
        "Identify high-value clients nearing SLA termination."
      ],
      Operations: [
        "Which operational problems keep recurring?",
        "What bottlenecks exist in the West Africa clearing queues?"
      ],
      Capacity: [
        "Where do we have surplus resource capacity?",
        "How can we reallocate regional workspace seats?"
      ],
      Leakage: [
        "Identify missed renewal leakage points.",
        "How much unbilled completed deliverables value remains outstanding?"
      ],
      Opportunities: [
        "What opportunities have we previously identified but failed to execute?",
        "Where is the highest potential expansion yield?"
      ],
      Strategy: [
        "Draft a value reclamation roadmap for Q4.",
        "What indexation clauses protect us from local inflation?"
      ],
      Executive: [
        "Show summary metrics of verified ROI captures.",
        "What is our overall value realization efficiency rating?"
      ]
    };
  }, []);

  // Structured response pre-baked memory matches for exact specified queries
  const getPrebakedResponse = (query: string): Message["structuredData"] | null => {
    if (!isDemoMode()) {
      return {
        finding: "Value analysis requires connected organizational data.",
        evidence: "No active CRM, ERP, or billing streams are currently integrated.",
        historicalContext: "APEX ONE operates on live and historical enterprise telemetry.",
        signals: [
          "Enterprise data streams awaiting connection",
          "Institutional telemetry inactive"
        ],
        businessImpact: "Connect systems to calculate financial impact.",
        recommendation: "Navigate to Settings > Integrations to connect your corporate data sources.",
        confidence: 100
      };
    }
    const q = query.toLowerCase();

    if (q.includes("meridian") || q.includes("underperformed")) {
      return {
        finding: "Meridian Logistics revenue is down 17% versus the customer's historical purchasing pattern.",
        evidence: "Billing invoices INV-2026-X1 and decreased daily transaction records over the trailing 60 days.",
        historicalContext: "Average annual growth over the previous 4 years sat at a healthy 12%. Underperformance began following operational account lead handover.",
        signals: [
          "Reduced order frequency (down 24%)",
          "Increased support incidents (+41% ticket volume)",
          "Contract capacity utilization decline",
          "Competitor pricing matching attempts flagged"
        ],
        businessImpact: "₦8.4M annualized revenue risk.",
        recommendation: "Execute active senior executive relationship review within 7 days. Standardize ticket queue clearing latency.",
        confidence: 94
      };
    }

    if (q.includes("five years") || q.includes("performed over the last")) {
      return {
        finding: "Dangote Industrial Group has maintained a steady 28% compounded growth tier, recently crossing peak capacity limits.",
        evidence: "Cumulative contracts and active SLA renewals tracking across five consecutive general sub-ledgers.",
        historicalContext: "Initial contract signed in 2021 at a baseline tier of ₦12.0M. Steady incremental expansions have reached ₦45.0M current revenue.",
        signals: [
          "Consistent on-time collections payments",
          "Usage growth outstrips contract bounds by 41%",
          "Zero open support tickets over trailing 90 days"
        ],
        businessImpact: "₦23.5M immediate expansion potential.",
        recommendation: "Present premium multi-cloud capacity license realignment immediately to secure expansion yield.",
        confidence: 98
      };
    }

    if (q.includes("expanded after renewal")) {
      return {
        finding: "Enterprise customer segments using custom Volatility Multipliers historically expand by 22% within 90 days of SLA renewal.",
        evidence: "Historical cohort audit logs comparing 124 corporate renewals over the trailing 3 years.",
        historicalContext: "Prior to indexation Clause implementation, renewals remained flat. Rate adjustments build proactive relationship trust.",
        signals: [
          "High initial onboarding satisfaction ratings",
          "Proactive quarterly account check-ins"
        ],
        businessImpact: "₦18.5M estimated recurring revenue upside.",
        recommendation: "Activate indexation Clause parameters default triggers for all upcoming mid-tier renewals.",
        confidence: 89
      };
    }

    if (q.includes("consistently lost revenue") || q.includes("lost revenue")) {
      return {
        finding: "Apex consistently leaks ₦31.8M through missed SLA support renewals and automated ticket queues staying open.",
        evidence: "15 active customer profiles are categorized as past-contract but continue receiving unresolved ticket completions.",
        historicalContext: "Legacy support system rules allow ticket resolutions even when corresponding SLA contracts are expired.",
        signals: [
          "Bypassed billing blocks on support desk queues",
          "Bill-to-invoice latency averages 14 days"
        ],
        businessImpact: "₦31.8M in easily clawable direct support revenue.",
        recommendation: "Enforce automated ticket queue locking immediately upon underlying SLA agreement expiration.",
        confidence: 95
      };
    }

    if (q.includes("recurring") || q.includes("operational problems")) {
      return {
        finding: "The clearing and settlement desk experiences recurring 4.5-hour float delay gaps during peak cycles.",
        evidence: "CBN interbank processing logs tracking batch completion milestones.",
        historicalContext: "Manual batch reconciliation creates idle employee windows during wait milestones.",
        signals: [
          "Wait float intervals",
          "26% average idle operations rating"
        ],
        businessImpact: "₦5.6M operating waste overhead.",
        recommendation: "Deploy automated sweeping queues to clear back-office settlement latency bottlenecks.",
        confidence: 91
      };
    }

    if (q.includes("failed to execute") || q.includes("identified but failed")) {
      return {
        finding: "Redundant cloud CDN node decommissioning playbooks have been identified for 4 consecutive quarters but remain un-executed.",
        evidence: "Historical infrastructure telemetries and cloud lease sheets.",
        historicalContext: "Originally proposed in Q3 2025. Postponed due to development team focus constraints.",
        signals: [
          "Redundant edge clusters active with zero routes",
          "450 idle SaaS licenses"
        ],
        businessImpact: "₦14.2M in cumulative direct cloud hosting and license savings.",
        recommendation: "Delegate immediate server-termination execution task to the active Dev Ops desk.",
        confidence: 96
      };
    }

    if (q.includes("last year") || q.includes("compared with")) {
      return {
        finding: "Contract-to-billing latency has increased by 14% compared with last year.",
        evidence: "Active CRM sales handoff timestamps vs ERP invoice generation records.",
        historicalContext: "Salesforce CRM upgrade created integration mismatches that bypassed previous automated triggers.",
        signals: [
          "Manual contract reconciliation queues",
          "Increase in unbilled completed milestones"
        ],
        businessImpact: "₦18.7M in delayed operational cash flow.",
        recommendation: "Re-establish direct automated webhook trigger synchronization between Salesforce and ERP nodes.",
        confidence: 87
      };
    }

    return null;
  };

  // Chat execution router
  const handleSendQuery = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg = textToSend.trim();
    setInput("");
    setMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setIsLoading(true);

    // 1. Check for Pre-baked Scenario answers to guarantee rich presentation
    const prebaked = getPrebakedResponse(userMsg);
    if (prebaked) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { sender: "analyst", isStructured: true, structuredData: prebaked }
        ]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    // 2. Fallback to Gemini Live API with automatic prompt injection to enforce structured responses
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are the APEX VALUE ANALYST. Analyze this query: "${userMsg}". 
          Respond strictly in this structured markdown format:
          
          ### FINDING
          [Provide clear findings]
          
          ### EVIDENCE
          [Provide the exact origin data evidence]
          
          ### HISTORICAL CONTEXT
          [Explain previous trends]
          
          ### BUSINESS IMPACT
          [Estimated Naira financial consequence]
          
          ### RECOMMENDATION
          [Actionable step]
          
          ### CONFIDENCE
          [Provide a confidence percentage, e.g. 92% confidence]`
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { sender: "analyst", text: data.text, isStructured: false }]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: "analyst",
            text: `⚠️ **System Integration Error**: ${data.error || "Failed to contact GenAI engine."}`
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: "analyst",
          text: "⚠️ **Network Error**: Unable to contact GenAI server-side router."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="analyst-intelligence-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] left-[10%] w-[450px] h-[450px] bg-gold/[0.015] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="AUTONOMOUS VALUE ANALYSIS"
        title="APEX VALUE ANALYST"
        subtitle="Your autonomous enterprise value intelligence analyst. Scans active CRM, sub-ledgers, database clusters, and transaction logs to reveal latent capital."
      />

      {/* CORE OPERATING SYSTEM MESSAGE */}
      <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-gold" size={16} />
          <div>
            <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">ANALYST POSITION</p>
            <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;This is not a generic chatbot. I am an AI analyst specialized in enterprise value creation.&rdquo;</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-emerald bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
          Active Knowledge Graph Linked
        </div>
      </div>

      {/* THREE-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ORGANIZATIONAL MEMORY CONTEXT PANEL */}
        <div className="lg:col-span-3 space-y-4 text-left">
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
            <div className="border-b border-white/[0.04] pb-2.5 flex items-center gap-2">
              <Database size={13} className="text-gold" />
              <h3 className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">Organizational Memory</h3>
            </div>

            <div className="space-y-3">
              {contextMemoryMetrics.map((metric, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                  <div className="flex items-center gap-2">
                    <metric.icon size={13} className="text-ivory/40" />
                    <span className="text-[11px] font-mono text-ivory/50">{metric.label}</span>
                  </div>
                  <span className="text-[12px] font-mono font-bold text-ivory">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MODE SELECTOR */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-3">
            <div className="border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-gold" />
              <h3 className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider">Analysis Mode</h3>
            </div>

            <div className="space-y-1.5">
              {(["Revenue", "Customers", "Operations", "Capacity", "Leakage", "Opportunities", "Strategy", "Executive"] as AnalysisMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={clsx(
                    "w-full text-left px-3.5 py-2 rounded-lg text-[12.5px] font-mono font-bold transition-all flex items-center justify-between cursor-pointer",
                    selectedMode === mode
                      ? "bg-gold/10 border border-gold/25 text-gold"
                      : "bg-transparent text-ivory/50 hover:bg-white/[0.015] hover:text-ivory"
                  )}
                >
                  <span>{mode} Mode</span>
                  <ChevronRight size={12} className={clsx("transition-transform", selectedMode === mode ? "translate-x-0.5" : "opacity-30")} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE/RIGHT COLUMN: LARGE CONVERSATIONAL CHAT CONSOLE */}
        <div className="lg:col-span-9 flex flex-col h-[650px] relative">
          
          <div className="flex-1 rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass flex flex-col overflow-hidden">
            
            {/* Active Mode Banner */}
            <div className="border-b border-white/[0.04] pb-3 mb-4 flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-gold animate-pulse" />
                <span className="text-gold font-bold">MODE: {selectedMode.toUpperCase()} INTELLIGENCE SWEEP</span>
              </div>
              <span className="text-ivory/40">Status: Gated Audit Sync Active</span>
            </div>

            {/* Conversational Stream */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    "flex gap-3 max-w-[90%] rounded-2xl p-4.5 text-[13px] leading-relaxed text-left",
                    msg.sender === "analyst"
                      ? "bg-white/[0.015] border border-white/[0.04] text-ivory/80 mr-auto rounded-tl-none"
                      : "bg-gold/10 border border-gold/15 text-ivory ml-auto rounded-tr-none"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {msg.sender === "analyst" ? (
                      <div className="h-6.5 w-6.5 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                        <Bot size={14} />
                      </div>
                    ) : (
                      <div className="h-6.5 w-6.5 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-ivory/60">
                        <User size={13} />
                      </div>
                    )}
                  </div>

                  {/* Render content structured or plain markdown */}
                  <div className="flex-1 space-y-3.5 select-text">
                    {msg.isStructured && msg.structuredData ? (
                      <div className="space-y-4">
                        
                        {/* 1. FINDING */}
                        <div>
                          <span className="text-[10px] font-mono text-gold uppercase tracking-wider block font-bold">ANALYSIS FINDING</span>
                          <p className="text-[14px] font-semibold text-ivory mt-1 leading-snug">{msg.structuredData.finding}</p>
                        </div>

                        {/* Signals */}
                        {msg.structuredData.signals && msg.structuredData.signals.length > 0 && (
                          <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl space-y-1.5">
                            <span className="text-[9.5px] font-mono text-ivory/40 uppercase tracking-wider block font-bold">Detected Risk Signals</span>
                            <ul className="space-y-1 text-[12px] text-ivory/70 list-disc pl-4 font-mono">
                              {msg.structuredData.signals.map((sig, sIdx) => (
                                <li key={sIdx}>{sig}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Grid for Evidence & History */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-white/[0.03]">
                          <div>
                            <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Telemetry Evidence</span>
                            <p className="text-[12px] text-ivory/60 mt-1 leading-relaxed italic">&ldquo;{msg.structuredData.evidence}&rdquo;</p>
                          </div>
                          <div>
                            <span className="text-[9.5px] font-mono text-ivory/30 uppercase block">Historical Context</span>
                            <p className="text-[12px] text-ivory/60 mt-1 leading-relaxed">{msg.structuredData.historicalContext}</p>
                          </div>
                        </div>

                        {/* Grid for Impact & Recommendation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2.5 border-t border-white/[0.03]">
                          <div>
                            <span className="text-[9.5px] font-mono text-red-400 uppercase tracking-wider block font-bold">Business Impact</span>
                            <p className="text-[14.5px] font-mono font-bold text-red-400 mt-1">{msg.structuredData.businessImpact}</p>
                          </div>
                          <div>
                            <span className="text-[9.5px] font-mono text-emerald uppercase tracking-wider block font-bold">Recommended Action</span>
                            <p className="text-[12px] text-ivory/80 mt-1 leading-snug">{msg.structuredData.recommendation}</p>
                          </div>
                        </div>

                        {/* Gated Confidence Badge */}
                        <div className="pt-2.5 border-t border-white/[0.03] flex justify-between items-center text-[10.5px] font-mono text-ivory/35">
                          <span>Verified by: Organizational Memory Engine</span>
                          <span className="text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/15 font-bold">
                            {msg.structuredData.confidence}% Confidence Gated
                          </span>
                        </div>

                      </div>
                    ) : (
                      <div className="markdown-body text-[13.5px] space-y-1.5 leading-relaxed">
                        <ReactMarkdown>{msg.text || ""}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 max-w-[80%] rounded-2xl p-4.5 bg-white/[0.01] border border-white/[0.04] text-gold mr-auto rounded-tl-none text-left">
                  <div className="shrink-0">
                    <div className="h-6.5 w-6.5 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                      <Bot size={13} className="animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-[11.5px] font-mono tracking-wider">Querying historical ledger databases...</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* DYNAMIC ANALYSIS MODE SUGGESTIONS BOX */}
            <div className="mt-4 pt-3 border-t border-white/[0.05] space-y-2">
              <span className="text-[9.5px] font-mono text-gold uppercase tracking-wider block font-bold text-left">
                Suggested Probes ({selectedMode} Mode)
              </span>
              <div className="flex flex-wrap gap-2 text-left">
                {modeSuggestions[selectedMode].map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => handleSendQuery(sug)}
                    disabled={isLoading}
                    className="rounded-lg bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.05] hover:border-gold/35 text-ivory/70 hover:text-gold px-3 py-1.5 text-[11.5px] font-mono transition-all cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendQuery(input)}
                placeholder={`Ask about Meridian underperformance, unbilled deliverables, or ${selectedMode.toLowerCase()} leakages...`}
                disabled={isLoading}
                className="flex-1 rounded-xl bg-matte border border-white/[0.06] hover:border-white/[0.12] focus:border-gold px-4 py-3 text-[13px] text-ivory placeholder-ivory/35 outline-none transition-colors"
              />
              <button
                onClick={() => handleSendQuery(input)}
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-gold/15 border border-gold/25 text-gold px-4.5 py-3 font-mono font-bold text-[12px] hover:bg-gold/20 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send size={14} className="mr-1.5" />
                EXECUTE QUERY
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

// Reusable micro-icon wrapper
function UsersIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
