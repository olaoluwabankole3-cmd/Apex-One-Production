"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Target,
  Zap,
  Sparkles,
  ArrowDown,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Coins,
  ChevronRight,
  PieChart,
  HelpCircle,
  Clock,
  Briefcase,
  AlertTriangle,
  Flame,
  CheckCircle2,
  FileText
} from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


// Type definitions for Analytics Intelligence
type ScopeType = "current" | "previous" | "3year" | "5year";

interface MetricCard {
  label: string;
  value: string;
  subtext: string;
  change: string;
  isPositive: boolean;
  icon: any;
}

interface StoryStep {
  id: string;
  title: string;
  description: string;
  evidence: string;
  impactValue: string;
}

interface DecisionModel {
  id: string;
  title: string;
  impact: string;
  financialImpact: string;
  confidence: number; // percentage
  evidence: string[];
  recommendedAction: string;
  status: "pending" | "resolved";
}

// Dynamic metrics depending on selected historical scope
const statsByScope: Record<ScopeType, MetricCard[]> = {
  current: [
    { label: "Consolidated Revenue", value: "₦12.4B", subtext: "Equivalent $284.6M", change: "+12.4%", isPositive: true, icon: Coins },
    { label: "Portfolio Growth", value: "+18.4%", subtext: "Sustained ARR trajectory", change: "+1.2% QoQ", isPositive: true, icon: TrendingUp },
    { label: "Operating Margin", value: "74.2%", subtext: "Target floor is 70.0%", change: "+0.8% MoM", isPositive: true, icon: Target },
    { label: "Customer Ingestion", value: "48.2K", subtext: "Active institutional accounts", change: "+14.2% YoY", isPositive: true, icon: Users },
    { label: "AUM Churn Retention", value: "98.2%", subtext: "Top-tier industry baseline", change: "-0.2% MoM", isPositive: false, icon: Activity },
    { label: "Operational Speed", value: "84.6%", subtext: "SLA response efficiency", change: "+4.1% MoM", isPositive: true, icon: Zap }
  ],
  previous: [
    { label: "Consolidated Revenue", value: "₦11.1B", subtext: "Equivalent $253.2M", change: "+9.8%", isPositive: true, icon: Coins },
    { label: "Portfolio Growth", value: "+16.1%", subtext: "Sustained ARR trajectory", change: "+0.9% QoQ", isPositive: true, icon: TrendingUp },
    { label: "Operating Margin", value: "73.4%", subtext: "Target floor is 70.0%", change: "+0.5% MoM", isPositive: true, icon: Target },
    { label: "Customer Ingestion", value: "42.1K", subtext: "Active institutional accounts", change: "+11.8% YoY", isPositive: true, icon: Users },
    { label: "AUM Churn Retention", value: "98.4%", subtext: "Top-tier industry baseline", change: "+0.1% MoM", isPositive: true, icon: Activity },
    { label: "Operational Speed", value: "80.5%", subtext: "SLA response efficiency", change: "+2.8% MoM", isPositive: true, icon: Zap }
  ],
  "3year": [
    { label: "Consolidated Revenue", value: "₦9.6B", subtext: "Equivalent $218.4M", change: "+22.4%", isPositive: true, icon: Coins },
    { label: "Portfolio Growth", value: "+12.2%", subtext: "Sustained ARR trajectory", change: "+4.8% YoY", isPositive: true, icon: TrendingUp },
    { label: "Operating Margin", value: "71.1%", subtext: "Target floor is 70.0%", change: "+1.9% YoY", isPositive: true, icon: Target },
    { label: "Customer Ingestion", value: "32.4K", subtext: "Active institutional accounts", change: "+32.1% 3-Yr", isPositive: true, icon: Users },
    { label: "AUM Churn Retention", value: "97.6%", subtext: "Top-tier industry baseline", change: "+0.8% 3-Yr", isPositive: true, icon: Activity },
    { label: "Operational Speed", value: "78.2%", subtext: "SLA response efficiency", change: "+8.4% 3-Yr", isPositive: true, icon: Zap }
  ],
  "5year": [
    { label: "Consolidated Revenue", value: "₦7.8B", subtext: "Equivalent $178.1M", change: "+41.2%", isPositive: true, icon: Coins },
    { label: "Portfolio Growth", value: "+9.4%", subtext: "Sustained ARR trajectory", change: "+9.0% 5-Yr", isPositive: true, icon: TrendingUp },
    { label: "Operating Margin", value: "68.4%", subtext: "Target floor is 70.0%", change: "+5.8% 5-Yr", isPositive: true, icon: Target },
    { label: "Customer Ingestion", value: "24.1K", subtext: "Active institutional accounts", change: "+64.2% 5-Yr", isPositive: true, icon: Users },
    { label: "AUM Churn Retention", value: "96.8%", subtext: "Top-tier industry baseline", change: "+1.4% 5-Yr", isPositive: true, icon: Activity },
    { label: "Operational Speed", value: "71.4%", subtext: "SLA response efficiency", change: "+13.2% 5-Yr", isPositive: true, icon: Zap }
  ]
};

// 2. CONNECTED ANALYTICAL STORY STEPS
const storySteps: StoryStep[] = [
  {
    id: "step-1",
    title: "Revenue declined 4.2% in consumer lines",
    description: "While total group yields remains high, domestic credit and consumer brokerage deposits experienced a contraction in Q2.",
    evidence: "Calculated across Customer Operations retail ledgers, down ₦142M in credit card processing fees.",
    impactValue: "₦142M Downside"
  },
  {
    id: "step-2",
    title: "Customer expansion declined 11%",
    description: "Organic expansion within mid-market categories slipped as relationship outreach efforts shifted focus.",
    evidence: "Slowing contract additions in Commercial Operations across Logistics and Manufacturing profiles.",
    impactValue: "11% Velocity Slowdown"
  },
  {
    id: "step-3",
    title: "17 strategic accounts reduced standard purchases",
    description: "A subset of highly profitable clearing accounts reduced discretionary asset deployment.",
    evidence: "Ledger traces identify Meridian Logistics and Halden & Cross decreasing transactional frequency.",
    impactValue: "17 Accounts Identified"
  },
  {
    id: "step-4",
    title: "8 of those accounts had increased support activity",
    description: "Slowing trade speeds coincided with a spike in manual verification delays and escalations.",
    evidence: "Operations registry indicates average claims delay rose to 2.8 days, triggering 4 SLA breaches.",
    impactValue: "8 High-Escalation Accounts"
  },
  {
    id: "step-5",
    title: "3 core enterprise contracts are approaching renewal",
    description: "These high-friction accounts hold active agreements expiring within the trailing 45 days.",
    evidence: "Meridian Logistics (Sep 14), Halden & Cross (Nov 19), Solace Insurance (Aug 30).",
    impactValue: "3 Contracts Flagged"
  },
  {
    id: "step-6",
    title: "Potential Group Revenue Exposure: ₦18.4M",
    description: "If manual bottlenecks are unresolved before the renewal lock, the combined portfolio represents churn risk.",
    evidence: "Weighted aggregate risk calculation: Meridian (₦1.84M ARR) + Halden $3.12M ARR equivalent.",
    impactValue: "₦18.4M Direct Risk"
  }
];

export default function AnalyticsPage() {
  const { role } = useRole();
  const [selectedScope, setSelectedScope] = useState<ScopeType>("current");
  const [activeStoryStep, setActiveStoryStep] = useState<string>("step-1");
  const [decisions, setDecisions] = useState<DecisionModel[]>([
    {
      id: "DEC-809",
      title: "Concentration Risk Mitigation",
      impact: "Critical Exposure",
      financialImpact: "₦310M ARR / $210M AUM",
      confidence: 94,
      evidence: [
        "64% of total group revenue is currently derived from 5 enterprise accounts.",
        "Halden & Cross and Meridian Logistics have active high-severity SLA complaints on file.",
        "Sponsor departure in Halden & Cross leaves the account without an active budget holder."
      ],
      recommendedAction: "Execute Immediate Advisor Assignment & Premium Support SLA override for Halden & Cross.",
      status: "pending"
    },
    {
      id: "DEC-810",
      title: "Claims Automation Deployment Clearance",
      impact: "High Efficiency Gain",
      financialImpact: "₦3.8M/month Overhead salvage",
      confidence: 89,
      evidence: [
        "Claims intake is currently experiencing a 2.8-day average bottleneck delay.",
        "Intake lag is responsible for 61% of all downstream support ticket escalations.",
        "Pre-built Phase 2 Claims Automation modules can bypass manual verification loops entirely."
      ],
      recommendedAction: "Approve direct release of Claims Automation Phase 2 Vetting guidelines.",
      status: "pending"
    },
    {
      id: "DEC-811",
      title: "Credit Overdraft Expansion Tiering",
      impact: "Moderate Churn Hedge",
      financialImpact: "₦18.4M potential renewal securement",
      confidence: 82,
      evidence: [
        "Meridian Logistics' contract renewal requires negotiation over a proposed 3% price adjustment.",
        "Client has requested custom clearing SLA bounds not currently supported on default tiers."
      ],
      recommendedAction: "Authorize Elena Cho to extend custom credit overdraft lines up to ₦15M on a 2.5% compromise rate.",
      status: "pending"
    }
  ]);

  // Handle resolving/approving decision clear triggers
  const handleResolveDecision = (id: string) => {
    setDecisions((prev) =>
      prev.map((dec) => (dec.id === id ? { ...dec, status: "resolved" } : dec))
    );
  };

  const activeStats = useMemo(() => {
    return statsByScope[selectedScope];
  }, [selectedScope]);

  const activeStepDetails = useMemo(() => {
    return storySteps.find((s) => s.id === activeStoryStep) || storySteps[0];
  }, [activeStoryStep]);

  return (
    <InternalOnlyShield>
      <div className="mx-auto w-full max-w-7xl space-y-6" id="analytics-intelligence-center">
        
        {/* HEADER BAR & SCOPE CONTROLLER */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
              Decision Support Terminal · {company.name}
            </p>
            <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
              Financial & Strategic Analytics
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ivory/50">
              Moving from historical reporting to active causal diagnostics. Understand why portfolio shifts happen and approve recommended interventions.
            </p>
          </div>

          {/* HISTORICAL TREND CONTROLLER */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl self-start lg:self-auto shadow-glass-flat">
            {(["current", "previous", "3year", "5year"] as ScopeType[]).map((scope) => (
              <button
                key={scope}
                onClick={() => setSelectedScope(scope)}
                className={`rounded-lg px-3.5 py-1.5 text-[11px] font-mono font-bold transition-all cursor-pointer uppercase ${
                  selectedScope === scope
                    ? "bg-gold-gradient hover:shadow-gold-glow text-matte font-extrabold"
                    : "text-ivory/50 hover:text-ivory hover:bg-white/5"
                }`}
              >
                {scope === "current" ? "Current Year" : scope === "previous" ? "Previous Year" : scope === "3year" ? "3-Year Trend" : "5-Year Trend"}
              </button>
            ))}
          </div>
        </div>

        {!isDemoMode() ? (
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass max-w-2xl mx-auto my-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/5 border border-gold/15 text-gold mb-5">
              <Coins size={24} className="animate-pulse" />
            </div>
            <h3 className="font-display text-[18px] font-bold tracking-tight text-ivory uppercase">
              Financial & Strategic Analytics Awaiting Data
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ivory/55">
              Connect your billing, ledger, and commercial data sources to activate high-fidelity diagnostic analytics, decision support engines, and causal modeling.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
                Ledger Sweeping Offline
              </span>
              <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
                Causal Tracing Suspended
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* ────────────────── TOP SCORECARD SECTION ────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" id="analytics-scorecard">
          {activeStats.map((stat, i) => {
            const Icon = stat.icon;
            let cardStyle: React.CSSProperties = {};
            if (i === 0) {
              cardStyle = { paddingRight: "2px", paddingLeft: "4px", marginRight: "-4px", marginLeft: "-5px" };
            } else if (i === 1) {
              cardStyle = { marginRight: "-3px", marginLeft: "-3px", paddingLeft: "3px", paddingRight: "3px" };
            } else if (i === 2) {
              cardStyle = { marginRight: "-3px", marginLeft: "-3px", paddingRight: "3px", paddingLeft: "3px" };
            } else if (i === 3) {
              cardStyle = { marginRight: "-3px", marginLeft: "-3px", paddingLeft: "3px", paddingRight: "2px" };
            } else if (i === 4) {
              cardStyle = { marginLeft: "-3px", marginRight: "-3px", paddingLeft: "3px", paddingRight: "2px" };
            } else if (i === 5) {
              cardStyle = { marginLeft: "-3px", marginRight: "-3px", paddingLeft: "3px", paddingRight: "3px" };
            }
            return (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4.5 shadow-glass-flat flex flex-col justify-between" style={cardStyle}>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">{stat.label}</span>
                    <span className="p-1 rounded bg-white/5 text-gold border border-white/5">
                      <Icon size={12} />
                    </span>
                  </div>
                  <p className="mt-2.5 font-display text-[22px] font-bold text-ivory leading-none">{stat.value}</p>
                </div>
                <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.03] pt-2">
                  <span className="text-[10.5px] text-ivory/40 font-mono">{stat.subtext}</span>
                  <span className={`text-[10.5px] font-mono font-bold ${stat.isPositive ? "text-emerald" : "text-crimson"}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ────────────────── AI ANALYSIS (APEX ONE EXPLAINS) ────────────────── */}
        <div className="rounded-xl border border-gold/30 bg-gold/[0.03] p-5 shadow-gold-glow-soft" id="apex-one-explains-panel">
          <div className="flex gap-3.5 items-start">
            <Sparkles size={20} className="text-gold shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-gold font-mono">APEX ONE EXPLAINS</h3>
              <p className="text-[14.5px] text-ivory/95 font-mono leading-relaxed mt-1.5 font-medium">
                &ldquo;Revenue increased 18% over three years, but portfolio growth has become increasingly dependent on five enterprise accounts. These accounts represent 64% of total group ARR, creating structural revenue concentration exposure.&rdquo;
              </p>
            </div>
          </div>

          {/* Interactive Evidence metrics block */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3 border-t border-white/[0.04] pt-4.5">
            {[
              { name: "Halden & Cross Partners", share: "22% of ARR", subsidiary: "Strategic Accounts", status: "Risk: Sponsor departed" },
              { name: "Meridian Logistics Group", share: "18% of ARR", subsidiary: "Commercial Operations", status: "Risk: Custom SLA request" },
              { name: "Ashford & Vale Wealth", share: "11% of ARR", subsidiary: "Strategic Accounts", status: "Status: Strong champion" },
              { name: "Brightwell Regional Bank", share: "8% of ARR", subsidiary: "Enterprise Operations", status: "Status: Flat 3 quarters" },
              { name: "Solace Home Insurance", share: "5% of ARR", subsidiary: "Customer Operations", status: "Risk: 2 unresolved tickets" }
            ].map((acc, i) => (
              <div key={i} className="rounded-lg bg-white/[0.01] border border-white/[0.04] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between text-[9px] font-mono text-ivory/40">
                    <span>{acc.subsidiary}</span>
                    <span className="text-gold font-semibold">{acc.share}</span>
                  </div>
                  <h4 className="text-[12.5px] font-bold text-ivory mt-1.5 truncate">{acc.name}</h4>
                </div>
                <div className="mt-3 border-t border-white/[0.03] pt-2">
                  <span className={`text-[10px] font-mono block ${acc.status.includes("Risk") ? "text-crimson font-medium" : "text-ivory/40"}`}>
                    {acc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ────────────────── TWO-COLUMN SECTION: CONNECTED STORY & DECISION VIEW ────────────────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[480px_1fr]">
          
          {/* THE CONNECTED ANALYTICAL STORY */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass flex flex-col justify-between" id="analytical-story-widget">
            <div>
              <div className="border-b border-white/[0.05] pb-3">
                <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">THE ANALYTICAL STORY</h2>
                <p className="text-[11.5px] text-ivory/40 mt-0.5">Traces how a micro financial shift cascades across our operational layers</p>
              </div>

              {/* Vertical flow chain of facts */}
              <div className="mt-5 space-y-2 relative pl-3.5">
                
                {/* Vertical alignment indicator line */}
                <div className="absolute left-1 top-3 bottom-3 w-[1px] bg-white/[0.05]" />

                {storySteps.map((step, idx) => {
                  const isActive = step.id === activeStoryStep;
                  return (
                    <div key={step.id} className="relative group">
                      
                      {/* Interactive dot indicator */}
                      <span className={`absolute -left-[16.5px] top-3.5 h-2 w-2 rounded-full border transition-all ${
                        isActive 
                          ? "bg-gold border-gold shadow-gold-glow" 
                          : "bg-charcoal border-white/20 group-hover:border-gold"
                      }`} />

                      <button
                        onClick={() => setActiveStoryStep(step.id)}
                        className={`w-full text-left rounded-lg p-2.5 transition-all border ${
                          isActive 
                            ? "bg-white/[0.03] border-gold/30" 
                            : "bg-transparent border-transparent hover:bg-white/[0.01]"
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <h4 className={`text-[12.5px] font-bold ${isActive ? "text-gold" : "text-ivory/70 group-hover:text-ivory"}`}>
                            {step.title}
                          </h4>
                          <span className="text-[10px] font-mono text-ivory/40 whitespace-nowrap">{step.impactValue}</span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI-Assisted Deep Evidence Box for active step */}
            <div className="mt-5 rounded-xl border border-gold/15 bg-gold/[0.01] p-4.5" style={{ paddingLeft: "3px", paddingRight: "3px" }}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-gold uppercase tracking-wider font-bold">Deep Step Evidence:</span>
                <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-ivory/50">Active Audit</span>
              </div>
              <p className="text-[12.5px] text-ivory font-mono leading-relaxed mt-1.5">
                &ldquo;{activeStepDetails.description}&rdquo;
              </p>
              <div className="mt-3.5 bg-white/[0.02] border border-white/[0.04] p-2.5 rounded text-[11px] font-mono text-ivory/70 flex items-start gap-1.5">
                <Info size={11} className="text-gold shrink-0 mt-0.5" />
                <span>Registry Record: {activeStepDetails.evidence}</span>
              </div>
            </div>
          </div>

          {/* DECISION VIEW (DECISION-SUPPORT SYSTEM) */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass" id="decision-support-board">
            <div className="flex justify-between items-center border-b border-white/[0.05] pb-3">
              <div>
                <h2 className="font-display text-[17px] font-bold text-ivory tracking-tight uppercase">DECISION DIRECTIVES</h2>
                <p className="text-[11.5px] text-ivory/40 mt-0.5">Translate analytical exposure values into clear structural interventions</p>
              </div>
              <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2.5 py-0.5 rounded text-gold/80">
                Live Clear Actions: {decisions.filter(d => d.status === "pending").length} Pending
              </span>
            </div>

            {/* Decisions List layout */}
            <div className="mt-5 space-y-4" style={{ marginRight: "-8px", marginLeft: "-6px", paddingRight: "4px" }}>
              {decisions.map((dec, i) => {
                const isPending = dec.status === "pending";
                
                // Card inner child style overrides based on index
                let innerStyle1: React.CSSProperties = {};
                let innerStyle2: React.CSSProperties = {};
                
                if (i === 0) {
                  innerStyle1 = { paddingRight: "4px", paddingLeft: "3px" };
                  innerStyle2 = { paddingRight: "6px", paddingLeft: "4px" };
                } else if (i === 1) {
                  innerStyle1 = { paddingLeft: "4px", paddingRight: "3px" };
                  innerStyle2 = { paddingLeft: "3px", paddingRight: "3px" };
                } else if (i === 2) {
                  innerStyle1 = { paddingLeft: "5px", paddingRight: "2px" };
                  innerStyle2 = { paddingLeft: "5px", paddingRight: "3px" };
                }

                return (
                  <div 
                    key={dec.id} 
                    className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all duration-300 ${
                      isPending 
                        ? "bg-white/[0.01] border-white/[0.06]" 
                        : "bg-emerald/[0.02] border-emerald/30 shadow-emerald-glow"
                    }`}
                  >
                    <div style={innerStyle1}>
                      {/* Title and stats summary */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-gold/80 font-semibold">{dec.id} · {dec.impact}</span>
                          <h3 className="font-display text-[15px] font-bold text-ivory mt-0.5">{dec.title}</h3>
                        </div>

                        <div className="flex items-center gap-3 text-[10.5px] font-mono">
                          <span className="text-ivory/40">Confidence Score:</span>
                          <span className="text-emerald font-bold">{dec.confidence}%</span>
                          <span className="text-ivory/30">|</span>
                          <span className="text-gold font-semibold">{dec.financialImpact}</span>
                        </div>
                      </div>

                      {/* Evidence block */}
                      <div className="mt-3.5">
                        <span className="text-[9px] font-mono text-ivory/40 uppercase block">Active Analytical Evidence:</span>
                        <ul className="mt-1.5 space-y-1 pl-1">
                          {dec.evidence.map((ev, idx) => (
                            <li key={idx} className="text-[11.5px] font-mono text-ivory/70 leading-relaxed flex items-start gap-1.5">
                              <span className="text-gold shrink-0 mt-1">•</span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommended action directive */}
                      <div className="mt-4 rounded-lg bg-gold/[0.02] border border-gold/15 p-3 flex items-start gap-2">
                        <span className="text-[10px] font-mono text-gold font-extrabold shrink-0 mt-0.5">RECOM:</span>
                        <p className="text-[11.5px] font-mono text-ivory/85 leading-relaxed">
                          {dec.recommendedAction}
                        </p>
                      </div>
                    </div>

                    {/* Interactive clearing CTA triggers */}
                    <div className="mt-4.5 pt-3.5 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={innerStyle2}>
                      <span className="text-[10px] text-ivory/35 font-mono">
                        Approving this directive writes automation variables to workflow registers instantly.
                      </span>

                      {isPending ? (
                        <button
                          onClick={() => handleResolveDecision(dec.id)}
                          className="rounded-lg bg-gold-gradient hover:shadow-gold-glow text-matte font-bold text-[11px] px-4.5 py-1.5 transition-all font-mono uppercase flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Approve Intervention Directive
                        </button>
                      ) : (
                        <div className="rounded-lg bg-emerald/10 border border-emerald/25 px-4.5 py-1.5 text-[11px] font-mono font-bold text-emerald flex items-center gap-1">
                          <CheckCircle2 size={12} /> Approved & Injected to Workflow
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>

    </>
  )}

    </div>
  </InternalOnlyShield>
  );
}
