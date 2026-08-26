"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import ValueDetailDrawer from "@/components/value-engine/ValueDetailDrawer";
import {
  Target,
  Sparkles,
  ChevronRight,
  Activity,
  ArrowRight,
  TrendingUp,
  Cpu,
  SlidersHorizontal,
  PlusCircle,
  Clock,
  Briefcase,
  Layers,
  Search,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import clsx from "clsx";

interface DiscoveryOpportunity {
  id: string;
  title: string;
  category: "Customer expansion" | "Dormant customers" | "Contract optimization" | "Revenue recovery" | "Process optimization" | "Capacity utilization";
  potentialValue: number;
  confidence: number;
  evidence: string;
  recommendedAction: string;
  expectedOutcome: string;
  realizationSpeed: "Fastest" | "Medium" | "Long-Term";
  strategicImportance: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  status: "Identified" | "Validated" | "Approved" | "Executing" | "Captured";
}

export default function ValueDiscoveryEnginePage() {
  const [selectedOpp, setSelectedOpp] = useState<DiscoveryOpportunity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sorting State
  const [sortBy, setSortBy] = useState<"value" | "confidence" | "speed" | "strategic" | "risk">("value");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");

  // AI Scanner simulator state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [newlyDiscoveredCount, setNewlyDiscoveredCount] = useState(0);

  // Baseline opportunities
  const [opportunities, setOpportunities] = useState<DiscoveryOpportunity[]>([
    {
      id: "opp-1",
      title: "Dormant Enterprise Customer Reactivation",
      category: "Dormant customers",
      potentialValue: 42300000,
      confidence: 91,
      evidence: "Customer historically purchases every 45–60 days but has remained completely inactive for 137 days.",
      recommendedAction: "Initiate targeted reactivation campaign with custom pricing structures.",
      expectedOutcome: "Re-establish active transactional revenue pipeline, securing trailing contract projections.",
      realizationSpeed: "Fastest",
      strategicImportance: "High",
      risk: "Low",
      status: "Identified"
    },
    {
      id: "opp-2",
      title: "Technical Integration Gateway Upsell",
      category: "Customer expansion",
      potentialValue: 18400000,
      confidence: 94,
      evidence: "Uptime SLA compliance logs average 99.98% performance, exceeding legacy tier constraints.",
      recommendedAction: "Offer automated gateway up-charge upgrade to secure premium SLA bounds.",
      expectedOutcome: "Immediate ₦18.4M contract expansion ARR with minimal operational overhead.",
      realizationSpeed: "Medium",
      strategicImportance: "Medium",
      risk: "Low",
      status: "Validated"
    },
    {
      id: "opp-3",
      title: "Advisory Retainer Capacity Realignment",
      category: "Contract optimization",
      potentialValue: 12900000,
      confidence: 88,
      evidence: "SLA telemetry logs average 18.5 consulting hours monthly against standard contracted cap of 5.0 hours.",
      recommendedAction: "Re-negotiate baseline retainer or enforce strict queue locking overages.",
      expectedOutcome: "Full recovery of unbilled consulting advisory labor overhead.",
      realizationSpeed: "Medium",
      strategicImportance: "High",
      risk: "Medium",
      status: "Approved"
    },
    {
      id: "opp-4",
      title: "Naira Volatility Exchange Pricing Indexation",
      category: "Revenue recovery",
      potentialValue: 15200000,
      confidence: 95,
      evidence: "30-day foreign exchange volatility boundaries trigger Clause 4.2 indexation parameters across active contracts.",
      recommendedAction: "Apply active Nigerian Naira currency volatility billing indexations.",
      expectedOutcome: "Fully hedge and recover contract margins against foreign exchange variance losses.",
      realizationSpeed: "Fastest",
      strategicImportance: "High",
      risk: "Low",
      status: "Executing"
    }
  ]);

  // Redesign Metric totals
  const totalPotentialValue = useMemo(() => {
    return opportunities.reduce((sum, o) => sum + o.potentialValue, 0);
  }, [opportunities]);

  // Breakdown metrics
  const vectorBreakdowns = useMemo(() => {
    const vectors = {
      "Customer expansion": 0,
      "Dormant customers": 0,
      "Contract optimization": 0,
      "Revenue recovery": 0,
      "Process optimization": 0,
      "Capacity utilization": 0
    };
    opportunities.forEach((o) => {
      if (vectors[o.category] !== undefined) {
        vectors[o.category] += o.potentialValue;
      }
    });
    return Object.entries(vectors).map(([label, val]) => ({ label, val }));
  }, [opportunities]);

  // Visual funnel states
  const funnelSteps = [
    { label: "Identified", val: "₦61.0M" },
    { label: "Validated", val: "₦42.3M" },
    { label: "Approved", val: "₦28.1M" },
    { label: "Executing", val: "₦15.4M" },
    { label: "Captured", val: "₦4.8M" }
  ];

  // Simulated AI scanner steps
  const scanSteps = [
    "Analyzing CRM Customer transactions...",
    "Scanning active client SLA Contract parameters...",
    "Reviewing historical currency Volatility trends...",
    "Auditing Operations telemetry ledgers...",
    "Mapping Advisor Capacity workloads...",
    "Tracing background Workflows exception rates...",
    "Parsing chronological Historical data records..."
  ];

  const handleRunAiScan = () => {
    setIsScanning(true);
    setScanStep(0);

    // Dynamic scanner step animations
    const interval = setInterval(() => {
      setScanStep((prev) => {
        if (prev >= scanSteps.length - 1) {
          clearInterval(interval);
          
          // Complete scan and append two premium newly discovered opportunities
          setTimeout(() => {
            const newOpps: DiscoveryOpportunity[] = [
              {
                id: "opp-discovered-1",
                title: "Claims Intake Triage Workflow Candidate",
                category: "Process optimization",
                potentialValue: 8600000,
                confidence: 92,
                evidence: "Persistent batch claims processing turnaround delay during peak claims hours at Solace Home.",
                recommendedAction: "Deploy Claims Intake Triage workflow to auto-classify incoming claims.",
                expectedOutcome: "Eliminates SLA exception penalties and reduces manual overhead by 40%.",
                realizationSpeed: "Fastest",
                strategicImportance: "High",
                risk: "Low",
                status: "Identified"
              },
              {
                id: "opp-discovered-2",
                title: "Risk Advisor Queue Auto-Routing",
                category: "Capacity utilization",
                potentialValue: 6200000,
                confidence: 85,
                evidence: "High-value senior advisors are spending average of 14 hours weekly on lower-tier tickets.",
                recommendedAction: "Enforce automatic ticket locking routing rules.",
                expectedOutcome: "Unlocks critical advisory hours to support expansion pitches.",
                realizationSpeed: "Medium",
                strategicImportance: "High",
                risk: "Medium",
                status: "Approved"
              }
            ];

            // Prevent duplicate insertion
            setOpportunities((prevOpps) => {
              if (prevOpps.some(o => o.id === "opp-discovered-1")) return prevOpps;
              setNewlyDiscoveredCount(2);
              return [...newOpps, ...prevOpps];
            });

            setIsScanning(false);
          }, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 900);
  };

  // Nigeria Naira formatter helper
  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  // Sorting + Filtering calculation
  const sortedAndFilteredOpportunities = useMemo(() => {
    let list = [...opportunities];

    // Category filter
    if (activeCategoryFilter !== "all") {
      list = list.filter(o => o.category === activeCategoryFilter);
    }

    // Sort mappings
    list.sort((a, b) => {
      if (sortBy === "value") return b.potentialValue - a.potentialValue;
      if (sortBy === "confidence") return b.confidence - a.confidence;
      if (sortBy === "speed") {
        const speedMap = { Fastest: 3, Medium: 2, "Long-Term": 1 };
        return speedMap[b.realizationSpeed] - speedMap[a.realizationSpeed];
      }
      if (sortBy === "strategic") {
        const stratMap = { High: 3, Medium: 2, Low: 1 };
        return stratMap[b.strategicImportance] - stratMap[a.strategicImportance];
      }
      if (sortBy === "risk") {
        const riskMap = { Low: 1, Medium: 2, High: 3 };
        return riskMap[a.risk] - riskMap[b.risk]; // Low risk first
      }
      return 0;
    });

    return list;
  }, [opportunities, sortBy, activeCategoryFilter]);

  const handleOpenDetail = (opp: DiscoveryOpportunity) => {
    setSelectedOpp(opp);
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="value-discovery-workspace">
      
      {/* Background glow highlights */}
      <div className="absolute top-[-30px] right-[10%] w-[450px] h-[450px] bg-gold/[0.02] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="VALUE DISCOVERY ENGINE"
        title="VALUE DISCOVERY ENGINE"
        subtitle="Where APEX ONE identifies money, growth and efficiency that the organization is currently failing to capture."
      />

      {!isDemoMode() ? (
        <ValueIntelligenceEmptyState
          title="No opportunities connected"
          description="Connect commercial and product databases to activate continuous automated opportunity discovery."
          badge="Discovery Engine Offline"
        />
      ) : (
        <>
          {/* CORE IDEA: ANSWERING WHERE VALUE IS HIDING */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Target className="text-gold" size={16} />
          <div>
            <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">CORE COGNITIVE QUESTION</p>
            <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;Where is value hiding inside the organization?&rdquo;</p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-ivory/45 sm:text-right">
          Monitoring: 190 contracts · Active tracking: 4.1k parameters
        </div>
      </div>

      {/* VALUE HERO COMPONENT */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-8 shadow-3xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="inline-flex rounded px-2.5 py-0.5 bg-gold/10 border border-gold/20 text-[9.5px] font-mono text-gold uppercase tracking-wider font-bold mb-3">
              Potential Value Identified
            </span>
            <h1 className="font-display text-[46px] md:text-[60px] font-extrabold text-ivory tracking-tight leading-none font-mono">
              {formatNaira(totalPotentialValue)}
            </h1>
            <p className="mt-3.5 text-[13px] text-ivory/50 max-w-xl leading-relaxed">
              APEX ONE extracts unbilled professional consulting overhead, dormant relationship patterns, and currency indexation parameters to protect margins.
            </p>
          </div>

          {/* Breakdowns as specified exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {vectorBreakdowns.map((item, idx) => (
              <div key={idx} className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl min-w-[160px]">
                <span className="text-[9.5px] font-mono text-ivory/35 uppercase tracking-wider block">{item.label}</span>
                <span className="text-[14.5px] font-bold font-mono block mt-1 text-gold">
                  {formatNaira(item.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI SCAN TRIGGER (RUN AI VALUE SCAN COMPONENT) */}
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/[0.04] pb-3">
          <div>
            <h3 className="text-[14px] font-bold text-ivory uppercase tracking-tight">AI Telemetry Scan Console</h3>
            <p className="text-[12px] text-ivory/45">Analyze real-time transaction trails across organizational operations.</p>
          </div>
          
          <button
            onClick={handleRunAiScan}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-matte font-mono font-bold text-[12px] px-6 py-2.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={clsx(isScanning && "animate-spin")} />
            {isScanning ? "Scanning Matrix..." : "RUN AI VALUE SCAN"}
          </button>
        </div>

        {/* Live scanning progress animation */}
        {isScanning && (
          <div className="p-5 text-center space-y-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
            <Cpu size={22} className="mx-auto text-gold animate-bounce" />
            <p className="text-[12.5px] font-mono text-gold animate-pulse">{scanSteps[scanStep]}</p>
            <div className="w-full bg-white/10 h-1 rounded-full max-w-md mx-auto overflow-hidden">
              <div
                className="bg-gold h-full rounded-full transition-all duration-300"
                style={{ width: `${((scanStep + 1) / scanSteps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {newlyDiscoveredCount > 0 && !isScanning && (
          <div className="p-3.5 bg-emerald-500/[0.02] border border-emerald-500/15 rounded-xl flex items-center justify-between text-[12px]">
            <span className="text-emerald font-semibold flex items-center gap-1.5 font-mono">
              <CheckCircle2 size={13} />
              SCAN COMPLETE: 2 NEW OPPORTUNITIES DETECTED
            </span>
            <span className="text-ivory/50 font-mono">Realized ₦14.8M incremental target margin</span>
          </div>
        )}
      </div>

      {/* PRIORITIZATION & FILTERS PANEL */}
      <div className="flex flex-wrap gap-3 items-center justify-between border-b border-white/[0.05] pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-ivory/40" />
          <span className="text-[11px] font-mono text-ivory/45 uppercase tracking-wider">Prioritization Parameter:</span>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1 text-[11.5px] text-ivory outline-none focus:border-gold/30 font-mono"
          >
            <option value="value">Highest Value</option>
            <option value="confidence">Highest Confidence</option>
            <option value="speed">Fastest Realization</option>
            <option value="strategic">Strategic Importance</option>
            <option value="risk">Lowest Risk</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategoryFilter("all")}
            className={clsx(
              "rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-all",
              activeCategoryFilter === "all"
                ? "bg-gold/15 border border-gold/30 text-gold"
                : "border border-transparent text-ivory/45 hover:text-ivory/80"
            )}
          >
            All Areas
          </button>
          {[
            "Customer expansion",
            "Dormant customers",
            "Contract optimization",
            "Revenue recovery",
            "Process optimization",
            "Capacity utilization"
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategoryFilter(cat)}
              className={clsx(
                "rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-all",
                activeCategoryFilter === cat
                  ? "bg-gold/15 border border-gold/30 text-gold"
                  : "border border-transparent text-ivory/45 hover:text-ivory/80"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        
        {/* OPPORTUNITY CARDS CONTAINER (OPPORTUNITY, POTENTIAL VALUE, CONFIDENCE, EVIDENCE, RECOMMENDED, EXPECTED) */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedAndFilteredOpportunities.map((opp) => (
              <div
                key={opp.id}
                onClick={() => handleOpenDetail(opp)}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.005] p-5 hover:bg-white/[0.02] hover:border-gold/20 transition-all cursor-pointer flex flex-col justify-between space-y-4 group text-left"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="rounded-full border border-gold/20 bg-gold/5 px-2.5 py-0.5 text-[9.5px] font-bold text-gold uppercase font-mono tracking-wider">
                      {opp.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald uppercase font-bold bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">
                      Confidence: {opp.confidence}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-ivory/30 block">Opportunity</span>
                    <h4 className="text-[14.5px] font-bold text-ivory group-hover:text-gold transition-colors leading-tight">{opp.title}</h4>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-ivory/30 block">Potential Value</span>
                    <p className="text-[18px] font-mono font-bold text-ivory">{formatNaira(opp.potentialValue)}</p>
                  </div>

                  <div className="space-y-1 bg-white/[0.01] border border-white/[0.03] p-3 rounded-xl">
                    <span className="text-[9.5px] uppercase tracking-wider font-mono text-gold block font-bold">Evidence</span>
                    <p className="text-[12px] text-ivory/60 leading-relaxed italic">
                      &ldquo;{opp.evidence}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.03] space-y-2.5">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-ivory/30 block">Recommended Action</span>
                    <p className="text-[11.5px] text-ivory/70 leading-snug">{opp.recommendedAction}</p>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-ivory/30 block">Expected Outcome</span>
                    <p className="text-[11px] text-emerald leading-snug font-medium">{opp.expectedOutcome}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VALUE FUNNEL VISUALIZATION SIDEBAR */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
            <div className="border-b border-white/[0.04] pb-2">
              <h3 className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">Value Funnel Conversion</h3>
              <p className="text-[11px] text-ivory/40">Trace progression rate of discovered capital pipelines.</p>
            </div>

            <div className="space-y-3 pt-2">
              {funnelSteps.map((step, idx) => {
                // Diminishing widths representing funnel
                const widthMap = ["w-full", "w-[85%]", "w-[70%]", "w-[55%]", "w-[40%]"];
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11.5px] font-mono">
                      <span className="text-ivory/60">{step.label}</span>
                      <span className="text-gold font-bold">{step.val}</span>
                    </div>
                    <div className="w-full bg-white/[0.03] h-2 rounded-full overflow-hidden">
                      <div className={clsx("bg-gold h-full rounded-full transition-all duration-500", widthMap[idx])} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* DETAIL DRAWER GATEWAY */}
      {selectedOpp && (
        <ValueDetailDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedOpp.title}
          value={formatNaira(selectedOpp.potentialValue)}
          confidence={selectedOpp.confidence}
          businessArea={selectedOpp.category}
          whyIdentified={selectedOpp.evidence}
          evidence={selectedOpp.evidence}
          recommendedAction={selectedOpp.recommendedAction}
          expectedOutcome={selectedOpp.expectedOutcome}
          executionStatus={selectedOpp.status === "Identified" ? "Actionable Discovered" : selectedOpp.status === "Validated" ? "Validated & Verified" : "In Action Playbook"}
          financialImpact={`+${formatNaira(selectedOpp.potentialValue)} Annualised Margin Gain`}
          auditTrail={[
            `Audited by Apex AI telemetry matching logs. Risk Parameter: ${selectedOpp.risk}`,
            `Opportunity threshold flagged with estimated realization timeline: ${oppRealization(selectedOpp.realizationSpeed)}`
          ]}
        />
      )}

        </>
      )}

    </div>
  );
}

function oppRealization(speed: string) {
  if (speed === "Fastest") return "Within 14 Days";
  if (speed === "Medium") return "30-45 Days";
  return "90+ Days";
}
