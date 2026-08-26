"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import ValueIntelligenceEmptyState from "@/components/value-engine/ValueIntelligenceEmptyState";
import { useValueEngine } from "@/components/value-engine/ValueEngineContext";
import ValueHeader from "@/components/value-engine/ValueHeader";
import GlassCard from "@/components/ui/GlassCard";
import {
  Sliders,
  TrendingUp,
  Percent,
  Zap,
  Sparkles,
  Coins,
  Cpu,
  RefreshCw,
  TrendingDown,
  Users,
  Briefcase,
  AlertTriangle,
  Layers,
  ArrowRight
} from "lucide-react";
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line, Legend } from "recharts";
import clsx from "clsx";

type ScenarioProfile = "Conservative" | "Expected" | "Aggressive";

// Multiplier profiles relative to active Conservative, Expected, Aggressive tiers
const PROFILE_MULTIPLIERS = {
  Conservative: { rev: 0.85, cost: 1.05, risk: 1.2 },
  Expected: { rev: 1.0, cost: 1.0, risk: 1.0 },
  Aggressive: { rev: 1.15, cost: 0.92, risk: 0.8 }
};

export default function ScenarioIntelligencePage() {
  const { totalIdentified } = useValueEngine();

  // Scenario builders as specified exactly
  const [pricing, setPricing] = useState<number>(5); // defaults to 5% price adjustment
  const [retention, setRetention] = useState<number>(92); // defaults to 92% retention rate
  const [headcount, setHeadcount] = useState<number>(100); // defaults to 100% current staff
  const [capacity, setCapacity] = useState<number>(68); // defaults to 68% utilized capacity
  const [automation, setAutomation] = useState<number>(45); // defaults to 45% operations automated
  const [salesConversion, setSalesConversion] = useState<number>(24); // defaults to 24% conversion rate
  const [renewalRate, setRenewalRate] = useState<number>(88); // defaults to 88% renewal level
  const [operationalEfficiency, setOperationalEfficiency] = useState<number>(72); // defaults to 72% throughput index

  const [activeProfile, setActiveProfile] = useState<ScenarioProfile>("Expected");

  // Constant Base Benchmarks for APEX ONE (or dynamically derived)
  const BASE_REVENUE = 184000000; // ₦184M baseline revenue
  const BASE_COSTS = 132000000; // ₦132M base operating costs
  const BASE_CUSTOMERS = 48210; // 48,210 customers base
  const BASE_RISK = 11500000; // ₦11.5M exposure
  const BASE_CAPACITY = 68; // 68% utilized

  // Live simulation calculations mapping the interactive inputs directly into outputs
  const simulationResult = useMemo(() => {
    const mult = PROFILE_MULTIPLIERS[activeProfile];

    // Calculated pricing delta
    const pricingFactor = 1 + (pricing / 100);
    // Calculated retention delta
    const retentionFactor = retention / 90; // relative to 90% benchmark
    // Capacity delta
    const capacityFactor = capacity / 68;

    // Projected Revenue
    const calculatedRevenue = BASE_REVENUE * pricingFactor * retentionFactor * (salesConversion / 24) * mult.rev;
    
    // Projected Costs (Operational efficiency decreases costs, headcount increases costs)
    const headcountFactor = headcount / 100;
    const efficiencyFactor = 1 - ((operationalEfficiency - 72) / 200); // efficiency gains drop costs
    const calculatedCosts = BASE_COSTS * headcountFactor * efficiencyFactor * (1 - (automation / 400)) * mult.cost;

    // Projected Customers
    const calculatedCustomers = Math.round(BASE_CUSTOMERS * retentionFactor * (1 + (salesConversion - 24) / 100));

    // Projected Risk
    const calculatedRisk = BASE_RISK * (1 - (retention - 92) / 100) * mult.risk;

    // Projected Value (Simulated surplus margins)
    const currentValueMargin = BASE_REVENUE - BASE_COSTS;
    const simulatedValueMargin = calculatedRevenue - calculatedCosts;

    // Expected Gain delta
    const potentialGain = simulatedValueMargin - currentValueMargin;

    return {
      revenue: Math.round(calculatedRevenue),
      costs: Math.round(calculatedCosts),
      customers: calculatedCustomers,
      risk: Math.round(calculatedRisk),
      valueMargin: Math.round(simulatedValueMargin),
      gain: Math.round(potentialGain),
      utilization: Math.round(BASE_CAPACITY * capacityFactor)
    };
  }, [pricing, retention, headcount, capacity, automation, salesConversion, operationalEfficiency, activeProfile]);

  const formatNaira = (val: number) => {
    if (val >= 1000000000) {
      return `₦${(val / 1000000000).toFixed(1)}B`;
    }
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  // Generate projections comparing Current State vs simulated Scenario State over 12 months
  const chartData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const monthLabel = `Month ${i + 1}`;
      const baseMonthly = Math.round((BASE_REVENUE / 12) * (i + 1));
      const simulatedMonthly = Math.round((simulationResult.revenue / 12) * (i + 1));
      return {
        month: monthLabel,
        "Current Revenue": baseMonthly,
        "Projected Revenue": simulatedMonthly
      };
    });
  }, [simulationResult.revenue]);

  // Specific AI analysis as requested
  const aiExplanationText = useMemo(() => {
    const computedGain = formatNaira(Math.abs(simulationResult.gain));
    const direction = simulationResult.gain >= 0 ? "generate approximately" : "impact overall reserves by";

    return `The model indicates that a ${pricing}% price calibration coupled with a ${retention}% enterprise retention target could ${direction} ${computedGain} in annualized revenue, assuming current average account values and ${salesConversion}% sales conversion remains stable.`;
  }, [pricing, retention, salesConversion, simulationResult.gain]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-matte border border-white/[0.08] p-3 rounded-lg shadow-glass font-mono text-[11.5px] text-ivory text-left">
          <p className="font-display font-bold text-[13px] text-gold">{payload[0].payload.month}</p>
          <p className="mt-1 text-ivory/50">Current: {formatNaira(payload[0].value)}</p>
          <p className="mt-0.5 text-emerald font-bold">Simulated: {formatNaira(payload[1].value)}</p>
        </div>
      );
    }
    return null;
  };

  const hasData = isDemoMode();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 select-none relative" id="scenario-intelligence-workspace">
      
      {/* Background glow shadow */}
      <div className="absolute top-[-40px] left-[15%] w-[450px] h-[450px] bg-gold/[0.015] blur-[120px] rounded-full pointer-events-none z-0" />

      <ValueHeader
        category="SCENARIO INTELLIGENCE"
        title="SCENARIO INTELLIGENCE"
        subtitle="Your strategic enterprise decision simulation environment. Model and preview prospective adjustments to organizational pricing, capacities, automation, and staff scales."
      />

      {!hasData ? (
        <ValueIntelligenceEmptyState
          title="No simulation telemetry connected"
          description="Connect organizational financial, telemetry, and CRM data streams to run real-time predictive scenarios and value margin projections."
          badge="Simulator Offline"
        />
      ) : (
        <>
          {/* OPERATING SYSTEM CORE MESSAGE */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <Cpu className="text-gold" size={16} />
              <div>
                <p className="text-[12px] font-mono font-bold text-gold uppercase tracking-wider">STRATEGIC ENQUIRY GATEWAY</p>
                <p className="text-[13px] font-semibold text-ivory mt-0.5">&ldquo;What happens if we change something? Execute predictive simulations to model corporate margins.&rdquo;</p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-gold bg-gold/10 border border-gold/15 px-2.5 py-1 rounded">
              Active Sandbox Environment
            </div>
          </div>

          {/* SANDBOX DISCLAIMER NOTICE */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <Sliders className="text-gold" size={16} />
              <div>
                <p className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">MATHEMATICAL SCENARIO SANDBOX</p>
                <p className="text-[12px] text-ivory/60">Adjust sliders to model hypothetical organizational changes. Baseline figures are dynamic mathematical models initialized from enterprise telemetry.</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-ivory/40 uppercase tracking-wider shrink-0 bg-white/[0.03] px-2.5 py-1 rounded border border-white/[0.06]">
              Hypothetical Model
            </span>
          </div>

      {/* TWO-COLUMN LAYOUT: BUILDER vs PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* LEFT COLUMN: PARAMETER SCENARIO BUILDER PANEL */}
        <div className="lg:col-span-4 space-y-4">
          <GlassCard className="p-5 border-white/[0.05]" hover={false}>
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 mb-5">
              <div className="flex items-center gap-2 text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
                <Sliders size={14} />
                Scenario Builder Controls
              </div>
              <span className="text-[10px] font-mono text-ivory/30">Adjust Assumptions</span>
            </div>

            <div className="space-y-4.5 text-left">
              
              {/* 1. Pricing */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>SaaS/Contract Pricing Calibration</span>
                  <span className="text-gold font-bold">+{pricing}%</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="30"
                  step="1"
                  value={pricing}
                  onChange={(e) => setPricing(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>-10% Drop</span>
                  <span>+30% Cap</span>
                </div>
              </div>

              {/* 2. Customer Retention */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Customer Retention Rate Target</span>
                  <span className="text-gold font-bold">{retention}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  step="1"
                  value={retention}
                  onChange={(e) => setRetention(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>60% Low</span>
                  <span>100% Absolute</span>
                </div>
              </div>

              {/* 3. Headcount */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Corporate Headcount Scale</span>
                  <span className="text-gold font-bold">{headcount}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={headcount}
                  onChange={(e) => setHeadcount(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>50% Downsize</span>
                  <span>150% Scale</span>
                </div>
              </div>

              {/* 4. Capacity */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Available Capacity Reclamation</span>
                  <span className="text-gold font-bold">{capacity}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="2"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>30% Waste</span>
                  <span>100% Balanced</span>
                </div>
              </div>

              {/* 5. Automation */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Operations Automation Conversion</span>
                  <span className="text-gold font-bold">{automation}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={automation}
                  onChange={(e) => setAutomation(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>10% Manual</span>
                  <span>90% Gated Auto</span>
                </div>
              </div>

              {/* 6. Sales Conversion */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Sales closing pipeline rate</span>
                  <span className="text-gold font-bold">{salesConversion}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="1"
                  value={salesConversion}
                  onChange={(e) => setSalesConversion(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>10% Low Closing</span>
                  <span>50% Peak Velocity</span>
                </div>
              </div>

              {/* 7. Renewal rate */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>SLA Contract Renewal baseline</span>
                  <span className="text-gold font-bold">{renewalRate}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  step="2"
                  value={renewalRate}
                  onChange={(e) => setRenewalRate(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>60% Low Renewal</span>
                  <span>100% Constant SLA</span>
                </div>
              </div>

              {/* 8. Operational Efficiency */}
              <div>
                <div className="flex justify-between text-[11.5px] font-mono text-ivory/70">
                  <span>Throughput efficiency score</span>
                  <span className="text-gold font-bold">{operationalEfficiency}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="2"
                  value={operationalEfficiency}
                  onChange={(e) => setOperationalEfficiency(Number(e.target.value))}
                  className="w-full accent-gold bg-white/[0.05] h-1.5 rounded-lg cursor-pointer mt-1 appearance-none"
                />
                <div className="flex justify-between text-[8.5px] text-ivory/30 font-mono mt-0.5">
                  <span>50% Low</span>
                  <span>100% Peak SLA</span>
                </div>
              </div>

            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: SCENARIO PROFILES & LIVE COMPARISON METRICS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MULTIPLE SCENARIO PROFILE TABS */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider">PREDICTIVE STOCHASTIC MODELS</span>
            <div className="flex gap-2 w-full sm:w-auto">
              {(["Conservative", "Expected", "Aggressive"] as ScenarioProfile[]).map((prof) => (
                <button
                  key={prof}
                  onClick={() => setActiveProfile(prof)}
                  className={clsx(
                    "flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer",
                    activeProfile === prof
                      ? "bg-gold text-matte border border-gold"
                      : "bg-white/[0.01] border border-white/[0.05] text-ivory/50 hover:bg-white/[0.02]"
                  )}
                >
                  {prof} Model
                </button>
              ))}
            </div>
          </div>

          {/* DYNAMIC RESULT CARD */}
          <div className="rounded-2xl border border-gold/15 bg-gold/[0.015] p-5.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gold/10 rounded-full h-20 w-20 blur-2xl pointer-events-none" />
            <div>
              <span className="rounded px-2 py-0.5 bg-gold/15 border border-gold/20 text-[9px] font-mono text-gold uppercase font-bold">Projected Net Yield Delta</span>
              <h3 className="text-[28px] font-mono font-black text-ivory mt-2 tabular-nums">
                {simulationResult.gain >= 0 ? "+" : ""}{formatNaira(simulationResult.gain)}
              </h3>
              <p className="text-[12px] text-ivory/50 mt-1">Simulated revenue expansion relative to active {activeProfile} assumptions.</p>
            </div>
            
            <div className="text-[12.5px] font-mono border-l border-white/[0.06] pl-4 sm:text-right flex flex-col gap-1 shrink-0">
              <div>
                <span className="text-ivory/40 block text-[9px] uppercase">Model Baseline (Hypothetical)</span>
                <span className="text-ivory font-bold">{formatNaira(BASE_REVENUE)}</span>
              </div>
              <div className="mt-1">
                <span className="text-emerald block text-[9.5px] uppercase font-bold">Projected Total</span>
                <span className="text-emerald font-extrabold">{formatNaira(simulationResult.revenue)}</span>
              </div>
            </div>
          </div>

          {/* CURRENT STATE vs SCENARIO COMPARISON MATRIX */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-4">
            <span className="text-[11px] font-mono font-bold text-ivory/40 uppercase tracking-wider block text-left">COMPARISON SUMMARY MATRIX</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-left">
              {[
                { label: "Revenue", current: BASE_REVENUE, simulated: simulationResult.revenue, isCurrency: true },
                { label: "Costs", current: BASE_COSTS, simulated: simulationResult.costs, isCurrency: true, isCost: true },
                { label: "Customers", current: BASE_CUSTOMERS, simulated: simulationResult.customers },
                { label: "Capacity Utilization", current: BASE_CAPACITY, simulated: simulationResult.utilization, isPercent: true },
                { label: "Risk Exposure", current: BASE_RISK, simulated: simulationResult.risk, isCurrency: true, isCost: true },
                { label: "Value Margin", current: BASE_REVENUE - BASE_COSTS, simulated: simulationResult.valueMargin, isCurrency: true }
              ].map((matrix, idx) => {
                const diff = matrix.simulated - matrix.current;
                const isPositiveBetter = !matrix.isCost;
                const isBetter = isPositiveBetter ? diff >= 0 : diff <= 0;

                return (
                  <div key={idx} className="bg-white/[0.015] border border-white/[0.04] p-3 rounded-xl space-y-2">
                    <span className="text-[10px] font-mono text-ivory/40 uppercase block leading-tight h-[28px]">{matrix.label}</span>
                    <div>
                      <span className="text-[9.5px] text-ivory/30 block">Current</span>
                      <span className="text-[12.5px] font-mono text-ivory/70">{matrix.isCurrency ? formatNaira(matrix.current) : matrix.isPercent ? `${matrix.current}%` : matrix.current.toLocaleString()}</span>
                    </div>
                    <div className="pt-1 border-t border-white/[0.03]">
                      <span className="text-[9.5px] text-ivory/30 block">Simulated</span>
                      <span className={clsx(
                        "text-[13px] font-mono font-extrabold block",
                        isBetter ? "text-emerald" : "text-red-400"
                      )}>
                        {matrix.isCurrency ? formatNaira(matrix.simulated) : matrix.isPercent ? `${matrix.simulated}%` : matrix.simulated.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LINE CHART GRAPH COMPARING CURRENT RUN-RATE VS SIMULATED RUN-RATE */}
          <GlassCard className="p-5 border-white/[0.05]" hover={false}>
            <div className="mb-4 text-left">
              <h3 className="font-display text-[15px] font-bold text-ivory tracking-tight">Current State vs. Simulated Scenario Projected Cumulative Run-Rate</h3>
              <p className="text-[11.5px] text-ivory/40 mt-0.5">Visualizing monthly baseline performance gaps under active scenario parameter adjustments.</p>
            </div>

            <div className="h-60 w-full font-mono text-[11px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.25)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.25)" fontSize={11} tickFormatter={(v) => `₦${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="Current Revenue" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Projected Revenue" stroke="#C9A961" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* SCENARIO AI EXPLANATION BOX */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            
            {/* AI Explanation block */}
            <div className="md:col-span-8 p-4 bg-gold/[0.01] border border-gold/15 rounded-xl text-left space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-gold" />
                <span className="text-[10px] font-mono font-bold text-gold uppercase tracking-wider">AI SCENARIO RECONCILIATION</span>
              </div>
              <p className="text-[12.5px] text-ivory/80 leading-relaxed italic">
                &ldquo;{aiExplanationText}&rdquo;
              </p>
              <div className="text-[11px] text-ivory/40 font-mono pt-1 border-t border-white/[0.03]">
                Baseline assumptions: fixed capacity limits; unchanged customer churn cycles.
              </div>
            </div>

            {/* Confidence block */}
            <div className="md:col-span-4 p-4.5 bg-white/[0.01] border border-white/[0.04] rounded-xl text-left space-y-3 shrink-0">
              <div>
                <span className="text-[10px] font-mono text-gold font-bold uppercase block">Scenario Confidence</span>
                <span className="text-[20px] font-mono font-black text-gold block mt-1">78% Confidence</span>
              </div>
              <div className="pt-2 border-t border-white/[0.03] text-[11px] text-ivory/50 flex gap-1.5 items-start">
                <AlertTriangle size={13} className="text-gold shrink-0 mt-0.5" />
                <span>
                  <strong>Primary uncertainty:</strong> customer demand volatility indexation boundaries.
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>
      </>
      )}

    </div>
  );
}
