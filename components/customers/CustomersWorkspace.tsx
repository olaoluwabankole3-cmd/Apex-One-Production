"use client";

import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Search, 
  ArrowUpDown, 
  ShieldAlert, 
  Users, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Wallet, 
  AlertTriangle, 
  TrendingDown, 
  Sparkles, 
  Clock, 
  ArrowUpRight, 
  FileText, 
  Mail, 
  ChevronRight, 
  AlertCircle,
  HelpCircle,
  Play,
  Network,
  Grid,
  Info,
  Loader2
} from "lucide-react";
import HealthRing from "./HealthRing";
import CustomersHeader from "./CustomersHeader";
import { customerRepository, aiRepository } from "@/lib/data/repositories";
import { UnifiedCustomer, RelationshipEvent } from "@/lib/types";

export default function CustomersWorkspace() {
  const [currentCustomers, setCurrentCustomers] = useState<UnifiedCustomer[]>([]);
  const [relationshipHistory, setRelationshipHistory] = useState<Record<string, RelationshipEvent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      customerRepository.getUnifiedCustomers(),
      customerRepository.getRelationshipHistory()
    ]).then(([custs, history]) => {
      if (isMounted) {
        setCurrentCustomers(custs);
        setRelationshipHistory(history);
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Failed to load customer workspace data:", err);
      if (isMounted) {
        setCurrentCustomers([]);
        setRelationshipHistory({});
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const [selectedId, setSelectedId] = useState<string>("cust-1");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<"revenue" | "growth" | "risk" | "ltv" | "opportunity" | "engagement">("revenue");
  
  // Interactive audit filters
  const [auditFilter, setAuditFilter] = useState<"all" | "important" | "changing" | "risk" | "growing" | "underutilized" | "expansion" | "next">("all");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "Strategic" | "Growth" | "Stable" | "At Risk" | "Dormant">("all");
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");

  // Timeline year selector
  const [timelineYear, setTimelineYear] = useState<number>(2026);

  // AI customer memory query stream states
  const [isQueryingMemory, setIsQueryingMemory] = useState<boolean>(false);
  const [memoryAnswer, setMemoryAnswer] = useState<string>("");

  // Simulated HUD status feedback (No window.alert)
  const [hudNotification, setHudNotification] = useState<string | null>(null);

  const triggerHud = (message: string) => {
    setHudNotification(message);
    setTimeout(() => {
      setHudNotification(null);
    }, 4000);
  };

  // Select the active customer
  const activeCustomer = useMemo(() => {
    return currentCustomers.find((c) => c.id === selectedId) || currentCustomers[0];
  }, [selectedId, currentCustomers]);

  // Handle active customer change
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMemoryAnswer(""); // Reset memory answer on switch
    const history = relationshipHistory[id] || [];
    if (history.length > 0) {
      const years = Array.from(new Set(history.map(e => e.year))).sort((a,b) => b-a);
      setTimelineYear(years[0] || 2026);
    } else {
      setTimelineYear(2026);
    }
  };

  // Portfolio level answers to our custom questions
  const auditFeedback = useMemo(() => {
    if (!currentCustomers.length) return null;
    switch (auditFilter) {
      case "important": {
        const strategic = currentCustomers.filter(c => c.tier === "Enterprise" || c.arrUSD >= 2.0);
        const totalStrategicArr = strategic.reduce((sum, c) => sum + c.arrNaira, 0);
        const totalArr = currentCustomers.reduce((sum, c) => sum + c.arrNaira, 0);
        const pct = totalArr > 0 ? Math.round((totalStrategicArr / totalArr) * 100) : 0;
        return {
          title: "Tier-1 Strategic Customer Audit",
          text: `Portfolio Audit: ${strategic.length} Tier-1 account(s) represent ${pct}% of active ARR (₦${(totalStrategicArr / 1000).toFixed(2)}B total value).`,
          badge: "Strategic Core"
        };
      }
      case "changing": {
        const changing = currentCustomers.filter(c => c.status === "onboarding" || c.status === "at-risk");
        return {
          title: "Sponsor & Implementation Drift Audit",
          text: `Portfolio Audit: ${changing.length} account(s) currently in onboarding or at-risk status requiring operational follow-up.`,
          badge: "Transitional State"
        };
      }
      case "risk": {
        const atRisk = currentCustomers.filter(c => c.status === "at-risk" || c.healthScore < 70);
        const exposure = atRisk.reduce((sum, c) => sum + c.arrNaira, 0);
        return {
          title: "Revenue & Platform Drift Exposure",
          text: `Portfolio Audit: ${atRisk.length} account(s) flagged with active risk profiles (Total Exposure: ₦${(exposure / 1000).toFixed(2)}B).`,
          badge: "Exposure Risk"
        };
      }
      case "growing": {
        const growing = currentCustomers.filter(c => c.growthYoY !== null && c.growthYoY !== undefined && c.growthYoY > 0);
        return {
          title: "Client Expansion & Growth Vectors",
          text: `Portfolio Audit: ${growing.length} expanding account(s) exhibiting positive growth velocity across subsidiaries.`,
          badge: "Growth Vector"
        };
      }
      case "underutilized": {
        const underutilized = currentCustomers.filter(c => c.healthScore < 65 || (c.opportunityNaira !== null && c.opportunityNaira !== undefined && c.opportunityNaira > 0));
        return {
          title: "Latent Contract Value Audit",
          text: `Portfolio Audit: ${underutilized.length} account(s) identify latent capacity or usage optimization opportunities.`,
          badge: "Latent Upsell"
        };
      }
      case "expansion": {
        const expansion = currentCustomers.filter(c => (c.opportunityNaira !== null && c.opportunityNaira !== undefined && c.opportunityNaira > 0) || c.expansionPotential === "High");
        const totalOpp = expansion.reduce((sum, c) => sum + (c.opportunityNaira || 0), 0);
        return {
          title: "Strategic Cross-Sell Pathways",
          text: `Portfolio Audit: Identified pipeline sits at ₦${totalOpp.toFixed(1)}M across ${expansion.length} account(s).`,
          badge: "Expansion Primed"
        };
      }
      default:
        return null;
    }
  }, [auditFilter, currentCustomers]);

  // Compute filtered & sorted customer list
  const processedCustomers = useMemo(() => {
    let result = [...currentCustomers];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.industry || "").toLowerCase().includes(q) ||
        c.businessUnit.toLowerCase().includes(q) ||
        c.owner.toLowerCase().includes(q)
      );
    }

    // Filter by Visual Segment Clicked
    if (segmentFilter !== "all") {
      if (segmentFilter === "Strategic") {
        result = result.filter(c => c.tier === "Enterprise" && c.status !== "at-risk");
      } else if (segmentFilter === "Growth") {
        result = result.filter(c => c.growthYoY !== null && c.growthYoY !== undefined && c.growthYoY > 15 && c.status !== "at-risk");
      } else if (segmentFilter === "Stable") {
        result = result.filter(c => c.status === "active" && (c.growthYoY === null || c.growthYoY === undefined || c.growthYoY <= 15));
      } else if (segmentFilter === "At Risk") {
        result = result.filter(c => c.status === "at-risk");
      } else if (segmentFilter === "Dormant") {
        result = []; // 0 dormant accounts in active list
      }
    }

    // Filter by Smart Audit Tab Clicked
    if (auditFilter !== "all") {
      if (auditFilter === "important") {
        result = result.filter(c => c.tier === "Enterprise" || c.arrUSD >= 2.0);
      } else if (auditFilter === "changing") {
        result = result.filter(c => c.status === "onboarding" || (c.riskReasons || []).some(r => r.includes("sponsor") || r.includes("handover")));
      } else if (auditFilter === "risk") {
        result = result.filter(c => c.status === "at-risk");
      } else if (auditFilter === "growing") {
        result = result.filter(c => c.growthYoY !== null && c.growthYoY !== undefined && c.growthYoY > 10);
      } else if (auditFilter === "underutilized") {
        result = result.filter(c => (c.engagementLevel !== null && c.engagementLevel !== undefined && c.engagementLevel < 65) || (c.opportunityNaira !== null && c.opportunityNaira !== undefined && c.opportunityNaira > 800));
      } else if (auditFilter === "expansion") {
        result = result.filter(c => c.expansionPotential === "High" || (c.opportunityNaira !== null && c.opportunityNaira !== undefined && c.opportunityNaira > 500));
      }
    }

    // Sort the resulting list
    result.sort((a, b) => {
      if (sortField === "revenue") return b.arrNaira - a.arrNaira;
      if (sortField === "growth") return (b.growthYoY ?? -Infinity) - (a.growthYoY ?? -Infinity);
      if (sortField === "risk") return (b.riskScore ?? -Infinity) - (a.riskScore ?? -Infinity);
      if (sortField === "ltv") return b.ltvNaira - a.ltvNaira;
      if (sortField === "opportunity") return (b.opportunityNaira ?? 0) - (a.opportunityNaira ?? 0);
      if (sortField === "engagement") return (b.engagementLevel ?? 0) - (a.engagementLevel ?? 0);
      return 0;
    });

    return result;
  }, [currentCustomers, searchQuery, segmentFilter, auditFilter, sortField]);

  // Render list of active years for timeline based on history
  const availableYears = useMemo(() => {
    if (!activeCustomer) return [2026, 2025, 2024, 2023, 2022, 2021];
    const history = relationshipHistory[activeCustomer.id] || [];
    const yearsSet = new Set(history.map(e => e.year));
    if (yearsSet.size === 0) {
      return [2026, 2025, 2024, 2023, 2022, 2021];
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [activeCustomer, relationshipHistory]);

  // Filter relationship events for selected customer + year
  const activeYearEvents = useMemo(() => {
    if (!activeCustomer) return [];
    const history = relationshipHistory[activeCustomer.id] || [];
    return history.filter(e => e.year === timelineYear);
  }, [activeCustomer, timelineYear, relationshipHistory]);

  // Category specific matching inside relationship events
  const getEventForCategory = (cat: string) => {
    return activeYearEvents.find(e => e.category === cat);
  };

  // AI customer memory stream function
  const askAITimelineMemory = async () => {
    if (!activeCustomer) return;
    setIsQueryingMemory(true);
    setMemoryAnswer("");

    try {
      const text = await aiRepository.ask(
        `Synthesize relationship memory for ${activeCustomer.name} (${activeCustomer.businessUnit}, ARR: ₦${activeCustomer.arrNaira}M, Status: ${activeCustomer.status}, Health Score: ${activeCustomer.healthScore}%). Summarize historical milestones and operational posture.`
      );
      setMemoryAnswer(text);
    } catch (err: any) {
      setMemoryAnswer(err?.message || "AI intelligence service is currently unavailable.");
    } finally {
      setIsQueryingMemory(false);
    }
  };

  // Define dynamic coordinates for interactive intelligence map nodes (within 550x450 coordinate system)
  const mapCoordinates = useMemo(() => {
    const center = { x: 275, y: 220, label: "Apex Sync Hub" };
    const businessUnits = {
      "Enterprise Operations": { x: 140, y: 130, color: "#eab308" },
      "Strategic Accounts": { x: 410, y: 130, color: "#eab308" },
      "Commercial Operations": { x: 140, y: 310, color: "#eab308" },
      "Customer Operations": { x: 410, y: 310, color: "#eab308" }
    };

    const buPositions: Record<string, { x: number; y: number }[]> = {
      "Enterprise Operations": [{ x: 40, y: 70 }, { x: 40, y: 170 }],
      "Strategic Accounts": [{ x: 510, y: 70 }, { x: 510, y: 170 }],
      "Commercial Operations": [{ x: 40, y: 310 }, { x: 40, y: 390 }],
      "Customer Operations": [{ x: 510, y: 310 }, { x: 510, y: 390 }]
    };

    const buCounters: Record<string, number> = {
      "Enterprise Operations": 0,
      "Strategic Accounts": 0,
      "Commercial Operations": 0,
      "Customer Operations": 0
    };

    const customers = currentCustomers.map((c) => {
      const bu = c.businessUnit in businessUnits ? c.businessUnit : "Strategic Accounts";
      const idx = buCounters[bu] || 0;
      buCounters[bu] = idx + 1;
      const positions = buPositions[bu] || [{ x: 40, y: 70 }];
      const pos = positions[idx % positions.length] || { x: 40, y: 70 };
      return {
        id: c.id,
        unit: bu,
        x: pos.x,
        y: pos.y + (Math.floor(idx / positions.length) * 20),
      };
    });

    return { center, businessUnits, customers };
  }, [currentCustomers]);

  return (
    <div className="space-y-6">
      <CustomersHeader />

      {/* Simulated Toast Notification Area */}
      <AnimatePresence>
        {hudNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-gold/30 bg-charcoal-light/95 p-4 shadow-lg shadow-gold/5 min-w-[320px]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Sparkles size={16} />
            </span>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-gold font-bold">Executive Directive Dispatched</p>
              <p className="text-[12.5px] font-semibold text-ivory mt-0.5">{hudNotification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentCustomers.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-charcoal/40 p-12 text-center shadow-glass flex flex-col items-center justify-center min-h-[400px]">
          <div className="h-16 w-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
            <Users size={28} />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-wide uppercase bg-white/[0.04] border border-white/[0.08] text-ivory/60 mb-3">
            CRM Integration Awaiting Data
          </span>
          <h3 className="font-display text-xl font-bold text-ivory">No customer data connected</h3>
          <p className="mt-2 text-sm text-ivory/50 max-w-md">
            Customer profiles, ARR, health indexes, and relationship histories will populate automatically once your CRM and ERP integrations are connected.
          </p>
        </div>
      ) : (
        <>
          {/* ────────────────── CUSTOMER OVERVIEW (Top KPIs) ────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" id="customer-overview-metrics">
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Total Accounts</span>
            <Users size={14} className="text-gold" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">{currentCustomers.length}</p>
          <p className="mt-1 text-[10.5px] text-emerald font-mono flex items-center gap-1">
            <TrendingUp size={10} /> Active portfolio
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Health Index</span>
            <CheckCircle2 size={14} className="text-emerald" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">
            {currentCustomers.length ? Math.round(currentCustomers.reduce((sum, c) => sum + c.healthScore, 0) / currentCustomers.length) : 0}%
          </p>
          <p className="mt-1 text-[10.5px] text-ivory/40 font-mono">Portfolio average</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">At-Risk Segment</span>
            <AlertTriangle size={14} className="text-crimson" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-crimson font-mono">
            {currentCustomers.filter(c => c.status === "at-risk").length}
          </p>
          <p className="mt-1 text-[10.5px] text-crimson/70 font-mono">
            ₦{(currentCustomers.filter(c => c.status === "at-risk").reduce((sum, c) => sum + c.arrNaira, 0) / 1000).toFixed(2)}B exposure
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Expansion Pipeline</span>
            <Zap size={14} className="text-gold" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-gold">
            ₦{(currentCustomers.reduce((sum, c) => sum + (c.opportunityNaira || 0), 0)).toFixed(1)}M
          </p>
          <p className="mt-1 text-[10.5px] text-gold/80 font-mono">
            {currentCustomers.filter(c => c.expansionPotential === "High").length} high-potential accounts
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Onboarding</span>
            <Clock size={14} className="text-ivory/40" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-ivory/70">
            {currentCustomers.filter(c => c.status === "onboarding").length}
          </p>
          <p className="mt-1 text-[10.5px] text-ivory/40 font-mono">Active transitions</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass-flat">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Consolidated LTV</span>
            <Wallet size={14} className="text-gold" />
          </div>
          <p className="mt-1.5 font-display text-[22px] font-bold text-ivory">
            ₦{(currentCustomers.reduce((sum, c) => sum + c.ltvNaira, 0) / 1000).toFixed(1)}B
          </p>
          <p className="mt-1 text-[10.5px] text-emerald font-mono flex items-center gap-1">
            <TrendingUp size={10} /> Multi-year total
          </p>
        </div>
      </div>

      {/* ────────────────── VISUAL SEGMENTATION BAR ────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4 shadow-glass" id="customer-visual-segmentation">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-gold font-mono">Portfolio Segment Analyzer</h3>
            <p className="text-[10px] text-ivory/40 mt-0.5">Filter the list below by selecting an active relationship cluster</p>
          </div>
          <button 
            onClick={() => setSegmentFilter("all")} 
            className={`text-[10px] font-mono px-2.5 py-0.5 rounded border transition-colors ${segmentFilter === "all" ? "border-gold/40 bg-gold/15 text-gold font-bold" : "border-white/10 text-ivory/50 hover:text-ivory"}`}
          >
            Clear Segment Filter
          </button>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-1 overflow-hidden rounded-lg bg-white/[0.02] p-1.5">
          {/* Strategic */}
          <button 
            onClick={() => setSegmentFilter("Strategic")}
            className={`group relative flex flex-col justify-between p-3 rounded text-left transition-all ${segmentFilter === "Strategic" ? "bg-white/[0.06] ring-1 ring-gold/40" : "hover:bg-white/[0.03]"}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-[11px] font-bold text-gold font-mono">STRATEGIC</span>
            </div>
            <div className="mt-3">
              <p className="font-display text-[16px] font-bold text-ivory">
                {currentCustomers.length ? Math.round((currentCustomers.filter(c => c.tier === "Enterprise").length / currentCustomers.length) * 100) : 0}%
              </p>
              <p className="text-[9.5px] text-ivory/40">
                {currentCustomers.filter(c => c.tier === "Enterprise").length} Enterprise Accounts
              </p>
            </div>
          </button>

          {/* Growth */}
          <button 
            onClick={() => setSegmentFilter("Growth")}
            className={`group relative flex flex-col justify-between p-3 rounded text-left transition-all ${segmentFilter === "Growth" ? "bg-white/[0.06] ring-1 ring-gold/40" : "hover:bg-white/[0.03]"}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              <span className="text-[11px] font-bold text-emerald font-mono">GROWTH</span>
            </div>
            <div className="mt-3">
              <p className="font-display text-[16px] font-bold text-ivory">
                {currentCustomers.length ? Math.round((currentCustomers.filter(c => c.growthYoY !== null && c.growthYoY !== undefined && c.growthYoY > 0).length / currentCustomers.length) * 100) : 0}%
              </p>
              <p className="text-[9.5px] text-ivory/40">
                {currentCustomers.filter(c => c.growthYoY !== null && c.growthYoY !== undefined && c.growthYoY > 0).length} Expanding Accounts
              </p>
            </div>
          </button>

          {/* Stable */}
          <button 
            onClick={() => setSegmentFilter("Stable")}
            className={`group relative flex flex-col justify-between p-3 rounded text-left transition-all ${segmentFilter === "Stable" ? "bg-white/[0.06] ring-1 ring-gold/40" : "hover:bg-white/[0.03]"}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="text-[11px] font-bold text-sky-400 font-mono">STABLE</span>
            </div>
            <div className="mt-3">
              <p className="font-display text-[16px] font-bold text-ivory">
                {currentCustomers.length ? Math.round((currentCustomers.filter(c => c.status === "active" && c.healthScore >= 70).length / currentCustomers.length) * 100) : 0}%
              </p>
              <p className="text-[9.5px] text-ivory/40">
                {currentCustomers.filter(c => c.status === "active" && c.healthScore >= 70).length} Core Accounts
              </p>
            </div>
          </button>

          {/* At Risk */}
          <button 
            onClick={() => setSegmentFilter("At Risk")}
            className={`group relative flex flex-col justify-between p-3 rounded text-left transition-all ${segmentFilter === "At Risk" ? "bg-white/[0.06] ring-1 ring-crimson/40" : "hover:bg-white/[0.03]"}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-crimson animate-ping" />
              <span className="text-[11px] font-bold text-crimson font-mono">AT RISK</span>
            </div>
            <div className="mt-3">
              <p className="font-display text-[16px] font-bold text-crimson">
                {currentCustomers.length ? Math.round((currentCustomers.filter(c => c.status === "at-risk").length / currentCustomers.length) * 100) : 0}%
              </p>
              <p className="text-[9.5px] text-crimson/65">
                {currentCustomers.filter(c => c.status === "at-risk").length} Drift Accounts
              </p>
            </div>
          </button>

          {/* Dormant */}
          <button 
            disabled
            className="group relative flex flex-col justify-between p-3 rounded text-left opacity-30 cursor-not-allowed bg-white/[0.01]"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-ivory/30" />
              <span className="text-[11px] font-bold text-ivory/40 font-mono">ONBOARDING</span>
            </div>
            <div className="mt-3">
              <p className="font-display text-[16px] font-bold text-ivory/40">
                {currentCustomers.length ? Math.round((currentCustomers.filter(c => c.status === "onboarding").length / currentCustomers.length) * 100) : 0}%
              </p>
              <p className="text-[9.5px] text-ivory/30">
                {currentCustomers.filter(c => c.status === "onboarding").length} New Additions
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ────────────────── EXECUTIVE INTELLIGENCE INQUIRY ROW ────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4">
        <div className="flex items-center gap-1.5">
          <HelpCircle size={14} className="text-gold" />
          <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-ivory font-mono">Executive Intelligence Portfolio Audit</h4>
        </div>
        <p className="text-[10px] text-ivory/40 mt-0.5">Automated compliance questions checking our relationship posture, risk models, and expansion pathways</p>
        
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "important", label: "Who are our most important customers?" },
            { id: "changing", label: "Who is changing?" },
            { id: "risk", label: "Who is at risk?" },
            { id: "growing", label: "Who is growing?" },
            { id: "underutilized", label: "Who is underutilized?" },
            { id: "expansion", label: "Where is expansion possible?" }
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setAuditFilter(auditFilter === q.id ? "all" : (q.id as any));
                if (auditFilter !== q.id) {
                  // auto-switch to grid list if doing filters for clearer results
                  setViewMode("grid");
                }
              }}
              className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition-all duration-200 ${
                auditFilter === q.id 
                  ? "border-gold/50 bg-gold/15 text-gold shadow-gold-glow-soft" 
                  : "border-white/[0.06] bg-white/[0.02] text-ivory/60 hover:border-white/20 hover:text-ivory"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Display Smart Audit Output */}
        <AnimatePresence mode="wait">
          {auditFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-3 border-t border-white/[0.05] pt-3 flex items-start gap-3"
            >
              <div className="shrink-0 mt-0.5 rounded bg-gold/10 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-gold border border-gold/25 uppercase">
                {auditFeedback.badge}
              </div>
              <div>
                <p className="text-[11.5px] font-bold text-gold uppercase tracking-wider font-mono">{auditFeedback.title}</p>
                <p className="text-[12.5px] text-ivory/80 leading-relaxed mt-1 font-mono">{auditFeedback.text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ────────────────── MAIN DUAL LAYER WORKSPACE ────────────────── */}
      {processedCustomers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.005] p-12 min-h-[460px] flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-ivory/40 mb-4">
            <Users size={20} />
          </div>
          <span className="text-[14px] font-bold text-ivory/80 uppercase tracking-wider block font-mono">Client Registry Standby</span>
          <p className="text-[12px] text-ivory/45 max-w-md mt-2 leading-relaxed">
            The client registry is currently empty. Connect your CRM integration or import account records in Settings to populate client intelligence.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]">
        
        {/* LEFT COLUMN: CUSTOMER INTELLIGENCE MAP OR GRID VIEW */}
        <div className="flex flex-col gap-4">
          
          {/* Workspace mode selectors & search */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.06] bg-charcoal/40 p-4 sm:flex-row sm:items-center">
            
            {/* View selectors */}
            <div className="flex bg-white/[0.03] p-1 border border-white/[0.06] rounded-lg">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-bold transition-all ${
                  viewMode === "map" 
                    ? "bg-gold text-matte shadow-sm" 
                    : "text-ivory/50 hover:text-ivory"
                }`}
              >
                <Network size={13} />
                Relationship Map
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-bold transition-all ${
                  viewMode === "grid" 
                    ? "bg-gold text-matte shadow-sm" 
                    : "text-ivory/50 hover:text-ivory"
                }`}
              >
                <Grid size={13} />
                Client Cards
              </button>
            </div>

            <div className="flex-1 max-w-xs relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ivory/30" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients, owners, or sectors..."
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-8 pr-3 text-[12.5px] text-ivory placeholder:text-ivory/30 outline-none focus:border-gold/30"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11.5px] text-ivory/40 font-mono flex items-center gap-1">
                <ArrowUpDown size={12} /> Sort:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { field: "revenue", label: "ARR" },
                  { field: "ltv", label: "LTV" },
                  { field: "growth", label: "Growth" },
                  { field: "risk", label: "Risk" }
                ].map((s) => (
                  <button
                    key={s.field}
                    onClick={() => setSortField(s.field as any)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all ${
                      sortField === s.field
                        ? "bg-gold/15 border border-gold/40 text-gold"
                        : "bg-white/[0.01] border border-white/[0.06] text-ivory/50 hover:text-ivory"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* VIEW RENDER: Map or Grid */}
          <div className="min-h-[460px]">
            {viewMode === "map" ? (
              <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-4 shadow-glass relative flex flex-col justify-between">
                
                {/* Map Header Instructions */}
                <div className="flex items-start justify-between border-b border-white/[0.04] pb-2.5">
                  <div>
                    <h3 className="text-[12px] font-bold text-gold uppercase tracking-wider font-mono">INTELLIGENCE NETWORK MAP</h3>
                    <p className="text-[10px] text-ivory/40 mt-0.5">Live relationship graph mapping Enterprise, Commercial, Strategic, and Customer operations</p>
                  </div>
                  <div className="flex items-center gap-1 text-[9.5px] font-mono text-emerald bg-emerald/5 border border-emerald/20 rounded px-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 bg-emerald rounded-full animate-ping" />
                    LIVE MODEL SYNCED
                  </div>
                </div>

                {/* SVG Graph Canvas */}
                <div className="relative mt-2 flex items-center justify-center bg-matte-dark/20 rounded-lg p-2 border border-white/[0.02]">
                  <svg 
                    viewBox="0 0 550 450" 
                    className="w-full max-w-[550px] h-auto drop-shadow-lg"
                    style={{ maxHeight: "420px" }}
                  >
                    {/* Glowing Filter effects for gold lines */}
                    <defs>
                      <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* EDGES / RELATIONSHIP LINES */}
                    {/* 1. Core Hub to Business Units */}
                    {Object.entries(mapCoordinates.businessUnits).map(([unitName, bu]) => (
                      <g key={`edge-bu-${unitName}`}>
                        <line 
                          x1={mapCoordinates.center.x} 
                          y1={mapCoordinates.center.y} 
                          x2={bu.x} 
                          y2={bu.y} 
                          stroke="rgba(234, 179, 8, 0.25)" 
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                          className="animate-[dash_10s_linear_infinite]"
                        />
                        <circle cx={bu.x} cy={bu.y} r="4" fill="#eab308" opacity="0.3" />
                      </g>
                    ))}

                    {/* 2. Business Units to Customers */}
                    {mapCoordinates.customers.map((c) => {
                      const bu = mapCoordinates.businessUnits[c.unit as keyof typeof mapCoordinates.businessUnits];
                      const customerData = currentCustomers.find(cu => cu.id === c.id);
                      if (!bu || !customerData) return null;

                      // Check if customer matches active filters
                      const matchesActiveFilter = processedCustomers.some(pc => pc.id === c.id);
                      const isSelected = selectedId === c.id;

                      let strokeColor = "rgba(255, 255, 255, 0.08)";
                      if (matchesActiveFilter) {
                        if (customerData.status === "active") strokeColor = "rgba(16, 185, 129, 0.4)";
                        else if (customerData.status === "at-risk") strokeColor = "rgba(239, 68, 68, 0.4)";
                        else strokeColor = "rgba(245, 158, 11, 0.4)";
                      }

                      return (
                        <line 
                          key={`edge-cust-${c.id}`}
                          x1={bu.x} 
                          y1={bu.y} 
                          x2={c.x} 
                          y2={c.y} 
                          stroke={strokeColor} 
                          strokeWidth={isSelected ? "3" : "1.5"}
                          opacity={matchesActiveFilter ? 1 : 0.2}
                        />
                      );
                    })}

                    {/* NODES LAYER */}
                    
                    {/* 1. Center Node (Apex Sync Core) */}
                    <g transform={`translate(${mapCoordinates.center.x}, ${mapCoordinates.center.y})`} className="cursor-pointer">
                      <circle r="26" fill="rgba(234, 179, 8, 0.12)" stroke="#eab308" strokeWidth="2" filter="url(#gold-glow)" />
                      <circle r="18" fill="#141414" stroke="#eab308" strokeWidth="1" />
                      <path d="M-6 -6 L6 -6 L6 6 L-6 6 Z" fill="none" stroke="#eab308" strokeWidth="1.5" />
                      <text y="40" textAnchor="middle" fill="#fcfaf2" fontSize="10.5" fontFamily="monospace" fontWeight="bold" letterSpacing="0.05em">APEX ONE CORE</text>
                    </g>

                    {/* 2. Business Unit Nodes */}
                    {Object.entries(mapCoordinates.businessUnits).map(([unitName, bu]) => {
                      // Compact label for BU
                      const shortLabel = unitName.replace(" Operations", " Ops").replace(" Accounts", " Acc");
                      return (
                        <g key={`node-bu-${unitName}`} transform={`translate(${bu.x}, ${bu.y})`}>
                          <rect x="-65" y="-14" width="130" height="28" rx="6" fill="#1b1b1b" stroke="rgba(234, 179, 8, 0.4)" strokeWidth="1" />
                          <circle cx="-52" cy="0" r="4.5" fill="#eab308" />
                          <text x="-40" y="4" fill="#fcfaf2" fontSize="9.5" fontFamily="monospace" fontWeight="bold">{shortLabel}</text>
                        </g>
                      );
                    })}

                    {/* 3. Customer Nodes */}
                    {mapCoordinates.customers.map((c) => {
                      const customerData = currentCustomers.find(cu => cu.id === c.id);
                      if (!customerData) return null;

                      const isSelected = selectedId === c.id;
                      const matchesActiveFilter = processedCustomers.some(pc => pc.id === c.id);
                      
                      // Node style based on health & risk
                      let nodeColor = "#10b981"; // healthy active
                      if (customerData.status === "at-risk") nodeColor = "#ef4444"; // risk
                      else if (customerData.status === "onboarding") nodeColor = "#f59e0b"; // onboarding/stable

                      // Compute opacity based on search/segment filters
                      const nodeOpacity = matchesActiveFilter ? 1 : 0.25;

                      return (
                        <g 
                          key={`node-cust-${c.id}`} 
                          transform={`translate(${c.x}, ${c.y})`}
                          onClick={() => handleSelect(c.id)}
                          className="cursor-pointer group select-none"
                          opacity={nodeOpacity}
                        >
                          {/* Selected glowing outline */}
                          {isSelected && (
                            <rect x="-85" y="-18" width="170" height="36" rx="8" fill="rgba(255, 255, 255, 0.04)" stroke="#eab308" strokeWidth="2" filter="url(#gold-glow)" />
                          )}
                          
                          {/* Standard card body */}
                          <rect 
                            x="-80" 
                            y="-15" 
                            width="160" 
                            height="30" 
                            rx="6" 
                            fill={isSelected ? "rgba(25, 25, 25, 0.95)" : "rgba(18, 18, 18, 0.85)"} 
                            stroke={isSelected ? "#eab308" : "rgba(255, 255, 255, 0.08)"} 
                            strokeWidth="1" 
                            className="transition-all hover:stroke-gold/50"
                          />
                          
                          {/* Health Indicator Light */}
                          <circle cx="-68" cy="0" r="4.5" fill={nodeColor} className={customerData.status === "at-risk" ? "animate-pulse" : ""} />
                          
                          {/* Customer Name */}
                          <text x="-56" y="3" fill={isSelected ? "#fcfaf2" : "rgba(252, 250, 242, 0.85)"} fontSize="8.5" fontWeight={isSelected ? "bold" : "normal"}>
                            {customerData.name.length > 21 ? `${customerData.name.substring(0, 19)}...` : customerData.name}
                          </text>

                          {/* Mini ARR tag on right side of node */}
                          <text x="70" y="3" textAnchor="end" fill="#eab308" fontSize="8" fontFamily="monospace" opacity="0.8">
                            ₦{customerData.arrNaira}M
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Legend and interactive map controllers */}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-3 text-[10.5px]">
                  <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald" /> Healthy Active</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> Stable / Onboarding</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-crimson" /> Critical Risk</span>
                  </div>
                  <div className="text-right text-ivory/40 font-mono">
                    * Click nodes on the map to sync profile and timeline
                  </div>
                </div>

              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AnimatePresence>
                  {processedCustomers.map((c) => {
                    const isSelected = selectedId === c.id;
                    return (
                      <motion.div
                        key={c.id}
                        layoutId={`cust-card-${c.id}`}
                        onClick={() => handleSelect(c.id)}
                        className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-200 select-none flex flex-col justify-between ${
                          isSelected 
                            ? "bg-white/[0.07] border-gold/50 shadow-gold-glow-soft" 
                            : "bg-charcoal/40 border-white/[0.06] hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* Header: Name & Status */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono text-gold/60 uppercase tracking-wider">{c.tier} · {c.businessUnit}</span>
                              <h4 className="font-display text-[14px] font-bold text-ivory mt-0.5">{c.name}</h4>
                              <p className="text-[11px] text-ivory/40">{c.industry || "Not available"}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${
                              c.status === "active" 
                                ? "bg-emerald/10 text-emerald border border-emerald/20" 
                                : c.status === "at-risk" 
                                ? "bg-crimson/10 text-crimson border border-crimson/20 animate-pulse" 
                                : "bg-amber/10 text-amber border border-amber/20"
                            }`}>
                              {c.status}
                            </span>
                          </div>

                          {/* ARR & LTV */}
                          <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/[0.04] py-2.5">
                            <div>
                              <p className="text-[10px] text-ivory/40 uppercase font-mono tracking-wider">ANNUAL VALUE (ARR)</p>
                              <p className="font-display text-[13px] font-bold text-ivory">₦{c.arrNaira}M <span className="text-[11px] text-ivory/50 font-normal">(${c.arrUSD.toFixed(1)}M)</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] text-ivory/40 uppercase font-mono tracking-wider">LIFETIME VALUE (LTV)</p>
                              <p className="font-display text-[13px] font-bold text-gold">₦{(c.ltvNaira / 1000).toFixed(1)}B <span className="text-[11px] text-gold/60 font-normal">(${c.ltvUSD.toFixed(1)}M)</span></p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="text-ivory/45">Growth YoY:</span>
                              {c.growthYoY !== null && c.growthYoY !== undefined ? (
                                <span className={`font-mono font-bold flex items-center gap-0.5 ${c.growthYoY >= 0 ? "text-emerald" : "text-crimson"}`}>
                                  {c.growthYoY >= 0 ? "+" : ""}{c.growthYoY}%
                                </span>
                              ) : (
                                <span className="font-mono text-ivory/40">Not available</span>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11.5px]">
                                <span className="text-ivory/45">Engagement Level:</span>
                                {c.engagementLevel !== null && c.engagementLevel !== undefined ? (
                                  <span className="font-mono text-ivory/80 font-bold">{c.engagementLevel}%</span>
                                ) : (
                                  <span className="font-mono text-ivory/40">Not available</span>
                                )}
                              </div>
                              {c.engagementLevel !== null && c.engagementLevel !== undefined && (
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${c.engagementLevel >= 75 ? "bg-emerald" : c.engagementLevel >= 50 ? "bg-gold" : "bg-crimson"}`} 
                                    style={{ width: `${c.engagementLevel}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[10.5px]">
                          <span className="text-ivory/40">
                            Contract: <span className="text-ivory/80 font-semibold">{c.contractStatus || "Not available"}</span>
                          </span>
                          <span className="text-gold/80 font-mono">
                            Owner: {c.owner}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {processedCustomers.length === 0 && (
                  <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-xl bg-charcoal/20">
                    <AlertCircle className="mx-auto text-ivory/20" size={32} />
                    <p className="mt-2 text-[13px] text-ivory/45 font-mono">No customers found matching filters.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RICH CUSTOMER PROFILE INTERFACE */}
        <div className="flex flex-col gap-6" id="customer-rich-intelligence-panel">
          
          {/* Detailed Account Card */}
          <div className="rounded-xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass relative overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 bg-gold/5 blur-xl rounded-full" />
            
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 font-display text-[18px] font-bold text-gold">
                {activeCustomer.name.charAt(0)}
              </span>
              <div>
                <h3 className="font-display text-[17px] font-bold text-ivory leading-tight">{activeCustomer.name}</h3>
                <p className="text-[11.5px] text-ivory/40 mt-0.5">{activeCustomer.industry || "Not available"} · Client since {activeCustomer.since}</p>
                
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/[0.03] border border-white/[0.08] px-2 py-0.5 text-[9.5px] text-ivory/55 font-mono">
                    BU: {activeCustomer.businessUnit}
                  </span>
                  <span className="rounded-full bg-white/[0.03] border border-white/[0.08] px-2 py-0.5 text-[9.5px] text-ivory/55">
                    Account: {activeCustomer.tier}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
              <div>
                <p className="text-[9.5px] font-mono text-ivory/40 uppercase">ARR VALUE</p>
                <p className="text-[13px] font-bold text-ivory mt-0.5">₦{activeCustomer.arrNaira}M</p>
              </div>
              <div>
                <p className="text-[9.5px] font-mono text-ivory/40 uppercase">LIFETIME VALUE</p>
                <p className="text-[13px] font-bold text-gold mt-0.5">₦{(activeCustomer.ltvNaira / 1000).toFixed(1)}B</p>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-[9.5px] font-mono text-ivory/40 uppercase">HEALTH INDEX</p>
                <div className="mt-0.5">
                  <HealthRing score={activeCustomer.healthScore} size={34} />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="mt-4 border-t border-white/[0.04] pt-3 text-[11px] space-y-1.5 text-ivory/50">
              <div className="flex justify-between">
                <span>Account Director:</span>
                <span className="text-ivory/80 font-mono">{activeCustomer.owner}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Decision Maker:</span>
                <span className="text-ivory/80 flex items-center gap-1">
                  <Mail size={10} className="text-ivory/40" />
                  {activeCustomer.contactName} ({activeCustomer.contactRole})
                </span>
              </div>
            </div>
          </div>

          {/* ────────────────── RELATIONSHIP TIMELINE ────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4">
            <div className="flex justify-between items-center border-b border-white/[0.05] pb-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono">RELATIONSHIP HISTORICAL TRAJECTORY</h4>
              <span className="text-[9.5px] text-ivory/40 font-mono">(Select year to reload)</span>
            </div>

            {/* Years selection line */}
            <div className="flex items-center justify-between gap-1 mt-3 pb-1 overflow-x-auto scrollbar-none">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setTimelineYear(yr)}
                  className={`px-3 py-1 text-[11.5px] font-mono rounded-lg transition-all ${
                    timelineYear === yr 
                      ? "bg-gold/15 text-gold border border-gold/45 shadow-gold-glow-soft font-bold" 
                      : "bg-white/[0.02] text-ivory/40 hover:text-ivory/70 border border-transparent"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Grid display for the selected year across 4 core relationship quadrants */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { cat: "sales", label: "Sales & Billings" },
                { cat: "contracts", label: "Master Agreements" },
                { cat: "support", label: "Service SLAs" },
                { cat: "meetings", label: "Executive Meetings" }
              ].map((item) => {
                const matchedEvent = getEventForCategory(item.cat);
                return (
                  <div key={item.cat} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5 flex flex-col justify-between min-h-[75px]">
                    <p className="text-[9.5px] font-mono text-gold/70 uppercase font-semibold">{item.label}</p>
                    {matchedEvent ? (
                      <div className="mt-1">
                        <p className="text-[11.5px] text-ivory/90 font-bold leading-tight">{matchedEvent.title}</p>
                        <p className="text-[10px] text-ivory/45 line-clamp-2 mt-0.5 leading-snug">{matchedEvent.description}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-ivory/30 italic mt-auto">No logged activity</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ────────────────── CUSTOMER MEMORY Q&A ────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4">
            <div className="flex justify-between items-center border-b border-white/[0.05] pb-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono">CUSTOMER INTUITION MEMORY BANK</h4>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white/5 text-ivory/50 rounded border border-white/10">UNIFIED COGNITION</span>
            </div>

            <div className="mt-3 space-y-2 text-[11.5px] text-ivory/70 font-mono">
              <div className="flex gap-2">
                <span className="text-gold shrink-0">▸ First Ingestion:</span>
                <span>Active since {activeCustomer.since} (Direct MSA signed)</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold shrink-0">▸ Major Milestones:</span>
                <span>LTV expanded to ₦{activeCustomer.ltvNaira}M | {activeCustomer.businessUnit} mapped</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold shrink-0">▸ Key Decision Makers:</span>
                <span>{activeCustomer.contactName} ({activeCustomer.contactRole})</span>
              </div>
            </div>

            {/* Trigger AI Synthesis */}
            <div className="mt-4 pt-3.5 border-t border-white/[0.05]">
              <button
                onClick={askAITimelineMemory}
                disabled={isQueryingMemory}
                className="w-full rounded-lg bg-gold-gradient hover:shadow-gold-glow text-matte font-semibold text-[12px] py-2 flex items-center justify-center gap-1.5 transition-all"
              >
                {isQueryingMemory ? (
                  <>
                    <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-matte border-t-transparent rounded-full" />
                    Querying Relationship History...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    Synthesize Relationship Memory (5 Years)
                  </>
                )}
              </button>

              <AnimatePresence mode="wait">
                {memoryAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-[11.5px] leading-relaxed text-ivory/90 font-mono"
                  >
                    {memoryAnswer.split("\n\n").map((para, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-2" : ""}>{para}</p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ────────────────── HEALTH SEGMENTS ────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono border-b border-white/[0.05] pb-2.5">
              COMPOSITE HEALTH MATRIX
            </h4>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ivory/50">Relationship Engagement</span>
                  <span className="font-mono text-ivory/80">
                    {activeCustomer.engagementLevel !== null && activeCustomer.engagementLevel !== undefined ? `${activeCustomer.engagementLevel}%` : "Not available"}
                  </span>
                </div>
                {activeCustomer.engagementLevel !== null && activeCustomer.engagementLevel !== undefined && (
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full" style={{ width: `${activeCustomer.engagementLevel}%` }} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ivory/50">Revenue YoY Growth</span>
                  <span className="font-mono text-ivory/80">
                    {activeCustomer.growthYoY !== null && activeCustomer.growthYoY !== undefined 
                      ? `${activeCustomer.growthYoY >= 0 ? "Positive" : "Negative"} (${activeCustomer.growthYoY}%)` 
                      : "Not available"}
                  </span>
                </div>
                {activeCustomer.growthYoY !== null && activeCustomer.growthYoY !== undefined && (
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${activeCustomer.growthYoY >= 0 ? "bg-emerald" : "bg-crimson"}`} 
                      style={{ width: `${Math.min(100, Math.max(10, activeCustomer.growthYoY + 50))}%` }} 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ivory/50">SaaS License & Usage Depth</span>
                  <span className="font-mono text-ivory/80">{activeCustomer.healthScore}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald rounded-full" style={{ width: `${activeCustomer.healthScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ────────────────── EXPANSION ASSESSMENTS ────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono border-b border-white/[0.05] pb-2.5">
              EXPANSION OPPORTUNITY AUDIT
            </h4>

            <div className="mt-4 grid grid-cols-3 gap-2 border-b border-white/[0.05] pb-3 text-center">
              <div>
                <p className="text-[9.5px] font-mono text-ivory/40">CURRENT ARR</p>
                <p className="font-display text-[14.5px] font-bold text-ivory mt-0.5">₦{activeCustomer.arrNaira}M</p>
              </div>
              <div>
                <p className="text-[9.5px] font-mono text-ivory/40">POTENTIAL ARR</p>
                <p className="font-display text-[14.5px] font-bold text-ivory mt-0.5">
                  {activeCustomer.potentialArrNaira !== null && activeCustomer.potentialArrNaira !== undefined ? `₦${activeCustomer.potentialArrNaira}M` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[9.5px] font-mono text-ivory/40">UPSIZE PIPELINE</p>
                <p className="font-display text-[14.5px] font-bold text-gold mt-0.5">
                  {activeCustomer.opportunityNaira !== null && activeCustomer.opportunityNaira !== undefined ? `₦${activeCustomer.opportunityNaira}M` : "—"}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <p className="text-[10px] font-mono text-gold uppercase tracking-wider font-semibold">Strategic Expansion Pathway:</p>
              <p className="text-[11.5px] text-ivory/70 leading-relaxed font-mono mt-1">{activeCustomer.opportunityReason || "No expansion pathway identified"}</p>
            </div>
          </div>

          {/* ────────────────── RISK EVIDENCE ────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4">
            <div className="flex items-center gap-1.5 border-b border-white/[0.05] pb-2.5">
              <ShieldAlert size={14} className={activeCustomer.status === "at-risk" ? "text-crimson" : "text-emerald"} />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono">
                EVIDENCE-BACKED RISK MOTIFS
              </h4>
            </div>

            <div className="mt-3.5 space-y-2">
              {activeCustomer.riskReasons && activeCustomer.riskReasons.length > 0 ? (
                activeCustomer.riskReasons.map((reason, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-[11.5px] font-mono text-ivory/70 leading-relaxed">
                    <span className={`shrink-0 mt-1 h-1.5 w-1.5 rounded-full ${activeCustomer.status === "at-risk" ? "bg-crimson" : "bg-emerald"}`} />
                    <span>{reason}</span>
                  </div>
                ))
              ) : (
                <p className="text-[11.5px] font-mono text-ivory/40 italic">No specific risk motifs recorded</p>
              )}
            </div>
          </div>

          {/* ────────────────── APEX ONE AI INSIGHT & DIRECTIVE ────────────────── */}
          <div className="rounded-xl border border-gold/30 bg-gold/[0.03] p-4 shadow-gold-glow-soft">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-gold animate-pulse" />
              <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-gold font-mono">
                APEX ONE AI RECOMMENDATION ENGINE
              </h4>
            </div>

            <p className="mt-2.5 text-[12.5px] text-ivory/80 leading-relaxed font-mono">
              {activeCustomer?.aiInsight ? (
                <span>&ldquo;{activeCustomer.aiInsight}&rdquo;</span>
              ) : (
                <span className="text-ivory/50 italic">No automated AI recommendation currently logged.</span>
              )}
            </p>

            <div className="mt-4 pt-3.5 border-t border-gold/20 flex flex-col gap-2">
              <span className="text-[9.5px] font-mono uppercase text-gold/60 tracking-wider">Deploy Actionable RM Directive:</span>
              <button 
                onClick={() => triggerHud(`${activeCustomer?.name}: ${activeCustomer?.recommendedAction || "Review account status"}`)}
                className="w-full flex items-center justify-between rounded-lg bg-gold/10 hover:bg-gold/20 border border-gold/35 px-3 py-2 text-[12px] font-mono text-gold font-bold transition-colors"
              >
                <span>{activeCustomer?.recommendedAction || "No active directive"}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

        </div>

      </div>
      )}

      </>
    )}

    </div>
  );
}
