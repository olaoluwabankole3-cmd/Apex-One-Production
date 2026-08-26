"use client";

import { useState, useEffect, useMemo } from "react";
import { useRole } from "@/components/layout/RoleContext";
import {
  TrendingUp,
  Coins,
  FileCheck2,
  CalendarRange,
  Sparkles,
  ArrowUpRight,
  UserCheck,
  FileUp,
  FileText,
  CheckCircle,
  Calendar,
  ArrowRight,
  Gift,
  Users,
  Award,
  Send,
  MessageSquare,
  Clock,
  Shield,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  ArrowDownLeft,
  LineChart,
  Activity,
  Layers,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const wealthProducts = [
  {
    id: "yield",
    name: "High-Yield Custody Note",
    subsidiary: "Apex Capital",
    return: "9.5% APY",
    minInvestment: "$25,000",
    risk: "Low-Medium",
    desc: "Fixed-income treasury backed vehicle designed for steady, high-liquidity capital preservation.",
    benefits: ["Quarterly payouts", "Sovereign asset backing", "Zero management fees"]
  },
  {
    id: "realestate",
    name: "Prime Real Estate Bond",
    subsidiary: "Apex Finance",
    return: "12.4% Est. IRR",
    minInvestment: "$50,000",
    risk: "Medium",
    desc: "Structured debt backing Tier-1 commercial real estate acquisitions in rapid growth urban centers.",
    benefits: ["Bi-annual dividends", "Hard-asset collateralization", "Premium exit liquidity"]
  },
  {
    id: "wealth",
    name: "Private Wealth Managed Fund",
    subsidiary: "Apex Bank",
    return: "15.8% YTD Performance",
    minInvestment: "$100,000",
    risk: "Medium-High",
    desc: "Actively managed algorithmic & relationship-driven allocation across global equities and corporate debt.",
    benefits: ["Dedicated asset manager", "Bespoke risk hedging", "Daily liquidity access"]
  }
];

export default function ApexConnectDashboard() {
  const {
    appliedProducts,
    applyProduct,
    submittedDocuments,
    addDocument,
    bookedMeetings,
    addMeeting,
    portfolioValue,
    addPortfolioValue
  } = useRole();

  const [activeTab, setActiveTab] = useState<"overview" | "advisor" | "documents" | "meetings" | "rewards">("overview");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: "user" | "ai"; text: string; products?: string[] }>>([
    {
      id: "m1",
      sender: "ai",
      text: "Good afternoon, Olaoluwa. Your investment portfolio has grown 4.8% this quarter. I am your Apex AI Advisor. How can I assist with your private wealth strategy today?"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);

  // Subsidiary Custom Additions (persisted during session)
  const [customCapital, setCustomCapital] = useState<number>(0);
  const [customFinance, setCustomFinance] = useState<number>(0);
  const [customBank, setCustomBank] = useState<number>(0);

  // Hover allocation state for the Donut Chart
  const [hoveredAllocation, setHoveredAllocation] = useState<"capital" | "finance" | "bank" | null>(null);

  // Capital Deployment states
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployAmount, setDeployAmount] = useState<number>(100000);
  const [deployTarget, setDeployTarget] = useState<"capital" | "finance" | "bank">("capital");
  const [deployStep, setDeployStep] = useState<number>(0);
  const [deployingStatusText, setDeployingStatusText] = useState("");

  // Compound simulator states
  const [simulatorYears, setSimulatorYears] = useState<number>(5);
  const [simulatorStrategy, setSimulatorStrategy] = useState<"defensive" | "balanced" | "aggressive">("balanced");
  const [hoveredSimYear, setHoveredSimYear] = useState<number | null>(null);

  // Document Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [docCategory, setDocCategory] = useState("Utility Bill");
  const [scanStep, setScanStep] = useState<number>(0); // 0=idle, 1=integrity, 2=ocr, 3=sanctions, 4=ledgering, 5=complete
  const [scanningFileName, setScanningFileName] = useState<string>("");

  // Meeting Booking States
  const [meetDate, setMeetDate] = useState("2026-07-24");
  const [meetTime, setMeetTime] = useState("10:00 AM");
  const [meetTopic, setMeetTopic] = useState("Portfolio Rebalancing & Tax Planning");

  // Market Summary states
  const [marketSummary, setMarketSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Calculated dynamic holdings
  const holdingCapital = useMemo(() => 6240000 + customCapital, [customCapital]);
  const holdingFinance = useMemo(() => 3120000 + customFinance, [customFinance]);
  const holdingBank = useMemo(() => 1122930 + customBank, [customBank]);
  const dynamicTotalValue = useMemo(() => holdingCapital + holdingFinance + holdingBank, [holdingCapital, holdingFinance, holdingBank]);

  // Sync initial contextual differences if they occur, otherwise rely on computed total
  const currentTotal = dynamicTotalValue;

  // Donut values mapping
  const allocationPercents = useMemo(() => {
    return {
      capital: holdingCapital / currentTotal,
      finance: holdingFinance / currentTotal,
      bank: holdingBank / currentTotal,
    };
  }, [holdingCapital, holdingFinance, holdingBank, currentTotal]);

  const handleCopyReferral = () => {
    navigator.clipboard.writeText("https://canarypoint.com/ref/olaoluwa99");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;
    const userMsg = { id: `msg-${Date.now()}`, sender: "user" as const, text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let aiResponseText = "";
      let recommended: string[] = [];

      const query = textToSend.toLowerCase();
      if (query.includes("10 million") || query.includes("₦10") || query.includes("where should i invest") || query.includes("invest")) {
        aiResponseText = "An allocation of ₦10,000,000 (~$6,500) or equivalent is ideal for a balanced, yield-generating strategy. Based on your client profile, I highly recommend distributing this across: \n\n1. **High-Yield Custody Note (60% allocation)**: To secure a guaranteed 9.5% APY payout for short-term liquidity.\n2. **Prime Real Estate Bond (40% allocation)**: For medium-term capital appreciation with hard asset backing yielding up to 12.4%.\n\nWould you like me to initiate the digital application for these selected products?";
        recommended = ["yield", "realestate"];
      } else if (query.includes("custody") || query.includes("yield") || query.includes("note")) {
        aiResponseText = "The High-Yield Custody Note is Apex Capital's flagship institutional preservation vehicle. It offers 9.5% APY with quarterly interest payouts and zero management fees. It is backed by sovereign asset registries, making it a defensive pillar for your portfolio.";
        recommended = ["yield"];
      } else if (query.includes("real estate") || query.includes("bond") || query.includes("house")) {
        aiResponseText = "The Prime Real Estate Bond is backed by high-density Tier-1 commercial assets managed by Apex Finance. It offers an estimated 12.4% IRR with bi-annual dividends, yielding consistent passive cashflow secured directly by premium land titles.";
        recommended = ["realestate"];
      } else {
        aiResponseText = "I have scanned our current private client offerings. Your profile indicates high compliance health and a preference for steady income. I suggest reviewing the High-Yield Custody Note or scheduling a call with your Relationship Manager, Elena Cho.";
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: "ai",
          text: aiResponseText,
          products: recommended.length > 0 ? recommended : undefined
        }
      ]);
    }, 1500);
  };

  // High-Tech multi-step compliance OCR document scanner
  const handleFileUploadSimulate = (fileName: string) => {
    setScanningFileName(fileName);
    setScanStep(1);

    setTimeout(() => {
      setScanStep(2); // OCR alignment
      setTimeout(() => {
        setScanStep(3); // registry audit
        setTimeout(() => {
          setScanStep(4); // blockchain ledgering
          setTimeout(() => {
            setScanStep(5); // completion
            setTimeout(() => {
              addDocument({
                name: fileName,
                category: docCategory,
                status: "Verified",
                size: "1.4 MB",
              });
              setScanStep(0);
              setScanningFileName("");
            }, 800);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  // Institutional Capital Deployment Flow
  const triggerCapitalDeployment = () => {
    setIsDeploying(true);
    setDeployStep(1);
    setDeployingStatusText("Initiating secure multi-tier bank authorization...");

    setTimeout(() => {
      setDeployStep(2);
      setDeployingStatusText("Running automated compliance & KYC registry audit...");

      setTimeout(() => {
        setDeployStep(3);
        setDeployingStatusText("Registering cryptographic custody token on APEX ONE Ledger...");

        setTimeout(() => {
          // Commit values
          if (deployTarget === "capital") setCustomCapital((prev) => prev + deployAmount);
          if (deployTarget === "finance") setCustomFinance((prev) => prev + deployAmount);
          if (deployTarget === "bank") setCustomBank((prev) => prev + deployAmount);

          addPortfolioValue(deployAmount);

          setDeployStep(4);
          setDeployingStatusText("Sovereign Ledger post success! Capital active.");

          setTimeout(() => {
            setIsDeploying(false);
            setDeployStep(0);
          }, 1500);
        }, 1200);
      }, 1200);
    }, 1200);
  };

  const generateMarketSummary = () => {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      setIsGeneratingSummary(false);
      setMarketSummary(
        "GLOBAL MARKETS UPDATE: Equities remain robust with technology and real estate sectors leading indices. Treasury yields eased slightly, driving record capital inflows into alternative high-yield custody notes (+14% QoQ). Your private portfolio (10.48M) remains highly defensive, outperforming the benchmark index by +1.4% this quarter due to strategic allocations in Apex Capital institutional bonds."
      );
    }, 1200);
  };

  // Compound Projection Math
  const simInterestRate = useMemo(() => {
    if (simulatorStrategy === "defensive") return 0.095;
    if (simulatorStrategy === "aggressive") return 0.158;
    return 0.124; // balanced
  }, [simulatorStrategy]);

  const simulatedDataPoints = useMemo(() => {
    const points = [];
    let accumulated = currentTotal;
    for (let i = 0; i <= simulatorYears; i++) {
      if (i > 0) {
        accumulated = accumulated * (1 + simInterestRate);
      }
      points.push({
        year: i,
        val: accumulated,
        interestEarned: accumulated - currentTotal,
        bonusPoints: Math.floor((accumulated - currentTotal) / 1000)
      });
    }
    return points;
  }, [currentTotal, simulatorYears, simInterestRate]);

  // Compute dynamic SVG path for Compounding Curve
  const svgLinePath = useMemo(() => {
    if (simulatedDataPoints.length === 0) return "";
    const minVal = currentTotal;
    const maxVal = simulatedDataPoints[simulatedDataPoints.length - 1].val;
    const valRange = maxVal - minVal || 1;

    const coords = simulatedDataPoints.map((pt, i) => {
      const x = 40 + (i / simulatorYears) * 520;
      const y = 160 - ((pt.val - minVal) / valRange) * 120;
      return { x, y };
    });

    const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const areaD = `${pathD} L ${coords[coords.length - 1].x} 170 L ${coords[0].x} 170 Z`;

    return { pathD, areaD, coords };
  }, [simulatedDataPoints, simulatorYears, currentTotal]);

  // Render SVG concentric segmented donut details
  const radius = 50;
  const circ = 2 * Math.PI * radius; // 314.159
  const dashCapital = `${allocationPercents.capital * circ} ${circ}`;
  const dashFinance = `${allocationPercents.finance * circ} ${circ}`;
  const dashBank = `${allocationPercents.bank * circ} ${circ}`;

  const offsetCapital = 0;
  const offsetFinance = -allocationPercents.capital * circ;
  const offsetBank = -(allocationPercents.capital + allocationPercents.finance) * circ;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" id="apex-connect-root">
      
      {/* Premium Connection Header Banner */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-r from-charcoal-light/90 via-charcoal/95 to-charcoal-light/90 p-5 sm:p-6 shadow-gold-glow">
        <div className="absolute inset-0 bg-grain-radial pointer-events-none opacity-40" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 items-center justify-center rounded bg-gold/10 px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-gold">
                APEX CONNECT
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
              <p className="text-[11.5px] text-ivory/50">Unified Client Portal</p>
            </div>
            <h1 className="font-display text-[22px] sm:text-[26px] font-bold tracking-tight text-white">
              Welcome back, Olaoluwa Bankole
            </h1>
            <p className="text-[13px] text-ivory/60">
              Private wealth vault: <span className="font-semibold text-gold font-mono">${(currentTotal / 1000000).toFixed(2)}M USD</span> active in ecosystem custody.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateMarketSummary}
              className="flex items-center gap-2 rounded-lg border border-gold/35 bg-gold/5 px-4 py-2 text-[12.5px] font-medium text-gold transition-all duration-200 hover:bg-gold/10"
            >
              <Sparkles size={14} className="text-gold" />
              {isGeneratingSummary ? "Analyzing market..." : "Get AI Market Summary"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("advisor")}
              className="rounded-lg bg-gold-gradient px-4 py-2 text-[12.5px] font-semibold text-matte transition-all duration-200 hover:opacity-90 shadow-md shadow-gold/10"
            >
              Consult AI Advisor
            </motion.button>
          </div>
        </div>

        {/* AI market summary slider */}
        <AnimatePresence>
          {marketSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative mt-5 border-t border-white/[0.08] pt-4"
            >
              <button
                onClick={() => setMarketSummary(null)}
                className="absolute right-0 top-4 text-ivory/40 hover:text-white"
              >
                <X size={15} />
              </button>
              <div className="flex gap-3">
                <Sparkles size={16} className="text-gold mt-1 shrink-0" />
                <div className="space-y-1 pr-6">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold">Live Intelligence Synthesis</p>
                  <p className="text-[13px] text-ivory/80 leading-relaxed font-sans">{marketSummary}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Grid: Navigation Sidebar + Tab Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        
        {/* Quick Access Menu Cards */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ivory/35 font-medium">TOTAL AUM BALANCE</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-[26px] font-extrabold text-white font-mono">
                ${(currentTotal / 1000000).toFixed(2)}M
              </span>
              <span className="text-[12px] text-emerald font-semibold font-mono">+4.8%</span>
            </div>
            <p className="text-[11px] text-ivory/40 mt-1 font-mono">
              Equivalent: ₦{(currentTotal * 1550 / 1000000000).toFixed(1)} Billion
            </p>

            <div className="mt-4 border-t border-white/[0.05] pt-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-ivory/50">Client Class</span>
                <span className="text-gold font-bold flex items-center gap-1">
                  <Award size={12} /> Platinum Private
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-ivory/50">Assigned Partner</span>
                <span className="text-white font-medium">Elena Cho (RM)</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-ivory/50">Ecosystem Trust</span>
                <span className="text-emerald font-bold">100% Verified</span>
              </div>
            </div>
          </div>

          {/* Quick tab switcher list with animated backdrop slider */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-1.5 shadow-glass space-y-1 relative">
            {[
              { id: "overview", label: "My Wealth Portfolio", icon: Coins },
              { id: "advisor", label: "Interactive AI Advisor", icon: Sparkles },
              { id: "documents", label: "Document Vault", icon: FileCheck2 },
              { id: "meetings", label: "Book RM Consultation", icon: CalendarRange },
              { id: "rewards", label: "Referrals & Rewards", icon: Gift }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium transition-all duration-200 relative z-10",
                    active ? "text-gold font-bold" : "text-ivory/60 hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-gold/10 border-l-2 border-gold rounded-xl z-[-1]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon size={16} className={clsx(active ? "text-gold" : "text-ivory/45")} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Connected System Live Feed Tracker */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 text-[12px] space-y-2.5">
            <div className="flex items-center gap-1.5 text-gold font-bold">
              <Shield size={12} />
              <p className="uppercase tracking-wider text-[10px]">ECOSYSTEM INTERACTION BRAIN</p>
            </div>
            <p className="text-ivory/45 text-[11px] leading-relaxed">
              Every action taken here seamlessly routes alerts and creates workflow instances in APEX ONE for the compliance & advisory teams.
            </p>
          </div>
        </div>

        {/* Dynamic Tab Panel */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            
            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Visual portfolio tracking card */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 lg:p-6 shadow-glass relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.01] via-transparent to-transparent pointer-events-none" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.05]">
                    <div>
                      <h3 className="font-display text-[16px] font-bold text-white">Bespoke Wealth Holdings</h3>
                      <p className="text-[12px] text-ivory/50 mt-0.5">Active asset allocation across connected subsidiaries</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="text-[11.5px] text-gold/80 hover:text-gold flex items-center gap-1 bg-white/[0.02] border border-white/[0.08] px-2.5 py-1 rounded-lg">
                        <Download size={13} /> Statement
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setIsDeploying(true);
                          setDeployStep(0);
                        }}
                        className="text-[11.5px] bg-gold text-matte hover:opacity-90 font-bold px-3 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Plus size={13} /> Deploy Funds
                      </motion.button>
                    </div>
                  </div>

                  {/* Interactive Donut Allocation Visualizer */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                    
                    {/* SVG Donut */}
                    <div className="md:col-span-2 flex flex-col items-center justify-center relative">
                      <div className="relative w-44 h-44 flex items-center justify-center">
                        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                          {/* Background Track */}
                          <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="rgba(255,255,255,0.02)"
                            strokeWidth="9"
                          />
                          {/* Capital segment */}
                          <motion.circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="#D4AF37" // light gold
                            strokeWidth={hoveredAllocation === "capital" ? "12" : "9"}
                            strokeDasharray={dashCapital}
                            strokeDashoffset={offsetCapital}
                            strokeLinecap="round"
                            className="transition-all duration-300 cursor-pointer origin-center"
                            onMouseEnter={() => setHoveredAllocation("capital")}
                            onMouseLeave={() => setHoveredAllocation(null)}
                          />
                          {/* Finance segment */}
                          <motion.circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="#967B2F" // medium gold
                            strokeWidth={hoveredAllocation === "finance" ? "12" : "9"}
                            strokeDasharray={dashFinance}
                            strokeDashoffset={offsetFinance}
                            strokeLinecap="round"
                            className="transition-all duration-300 cursor-pointer origin-center"
                            onMouseEnter={() => setHoveredAllocation("finance")}
                            onMouseLeave={() => setHoveredAllocation(null)}
                          />
                          {/* Bank segment */}
                          <motion.circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="#E9DFB8" // pale white gold
                            strokeWidth={hoveredAllocation === "bank" ? "12" : "9"}
                            strokeDasharray={dashBank}
                            strokeDashoffset={offsetBank}
                            strokeLinecap="round"
                            className="transition-all duration-300 cursor-pointer origin-center"
                            onMouseEnter={() => setHoveredAllocation("bank")}
                            onMouseLeave={() => setHoveredAllocation(null)}
                          />
                        </svg>

                        {/* Central details template */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                          <AnimatePresence mode="wait">
                            {hoveredAllocation === null ? (
                              <motion.div
                                key="total"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="space-y-0.5"
                              >
                                <span className="text-[9px] uppercase tracking-widest text-ivory/40 font-mono font-semibold">TOTAL</span>
                                <p className="text-[17px] font-extrabold text-white font-mono leading-none">${(currentTotal / 1000000).toFixed(2)}M</p>
                                <span className="text-[10px] text-emerald font-bold font-mono">100%</span>
                              </motion.div>
                            ) : hoveredAllocation === "capital" ? (
                              <motion.div
                                key="cap"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="space-y-0.5"
                              >
                                <span className="text-[9px] uppercase tracking-widest text-gold font-mono font-semibold">STRATEGIC ACCOUNTS</span>
                                <p className="text-[17px] font-extrabold text-white font-mono leading-none">${(holdingCapital / 1000000).toFixed(2)}M</p>
                                <span className="text-[10px] text-gold font-bold font-mono">{(allocationPercents.capital * 100).toFixed(1)}%</span>
                              </motion.div>
                            ) : hoveredAllocation === "finance" ? (
                              <motion.div
                                key="fin"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="space-y-0.5"
                              >
                                <span className="text-[9px] uppercase tracking-widest text-gold/80 font-mono font-semibold font-bold">COMMERCIAL OPERATIONS</span>
                                <p className="text-[17px] font-extrabold text-white font-mono leading-none">${(holdingFinance / 1000000).toFixed(2)}M</p>
                                <span className="text-[10px] text-gold/80 font-bold font-mono">{(allocationPercents.finance * 100).toFixed(1)}%</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="bnk"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="space-y-0.5"
                              >
                                <span className="text-[9px] uppercase tracking-widest text-ivory/60 font-mono font-semibold font-bold">ENTERPRISE OPERATIONS</span>
                                <p className="text-[17px] font-extrabold text-white font-mono leading-none">${(holdingBank / 1000000).toFixed(2)}M</p>
                                <span className="text-[10px] text-ivory/60 font-bold font-mono">{(allocationPercents.bank * 100).toFixed(1)}%</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Interactive legend details */}
                    <div className="md:col-span-3 space-y-2.5">
                      <div
                        onMouseEnter={() => setHoveredAllocation("capital")}
                        onMouseLeave={() => setHoveredAllocation(null)}
                        className={clsx(
                          "rounded-xl bg-white/[0.01] border p-3.5 flex items-center justify-between transition-all duration-300",
                          hoveredAllocation === "capital" ? "border-gold bg-gold/5 scale-[1.01]" : "border-white/[0.04] hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-gold shrink-0" />
                          <div>
                            <p className="text-[13px] font-bold text-white">Strategic Accounts Portfolio</p>
                            <p className="text-[11px] text-ivory/40">Sovereign Bonds & Institutional Custody Notes</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13.5px] font-extrabold text-white font-mono">${(holdingCapital / 1000000).toFixed(2)}M</p>
                          <p className="text-[10px] text-emerald font-semibold font-mono">{(allocationPercents.capital * 100).toFixed(1)}%</p>
                        </div>
                      </div>

                      <div
                        onMouseEnter={() => setHoveredAllocation("finance")}
                        onMouseLeave={() => setHoveredAllocation(null)}
                        className={clsx(
                          "rounded-xl bg-white/[0.01] border p-3.5 flex items-center justify-between transition-all duration-300",
                          hoveredAllocation === "finance" ? "border-gold bg-gold/5 scale-[1.01]" : "border-white/[0.04] hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#967B2F] shrink-0" />
                          <div>
                            <p className="text-[13px] font-bold text-white">Commercial Operations Real Estate</p>
                            <p className="text-[11px] text-ivory/40">Tier-1 Real Estate Debt & High-Yield Bonds</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13.5px] font-extrabold text-white font-mono">${(holdingFinance / 1000000).toFixed(2)}M</p>
                          <p className="text-[10px] text-emerald font-semibold font-mono">{(allocationPercents.finance * 100).toFixed(1)}%</p>
                        </div>
                      </div>

                      <div
                        onMouseEnter={() => setHoveredAllocation("bank")}
                        onMouseLeave={() => setHoveredAllocation(null)}
                        className={clsx(
                          "rounded-xl bg-white/[0.01] border p-3.5 flex items-center justify-between transition-all duration-300",
                          hoveredAllocation === "bank" ? "border-gold bg-gold/5 scale-[1.01]" : "border-white/[0.04] hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-ivory/60 shrink-0" />
                          <div>
                            <p className="text-[13px] font-bold text-white">Enterprise Operations Cash Accounts</p>
                            <p className="text-[11px] text-ivory/40">Direct checking and premium wealth cash flow holdings</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13.5px] font-extrabold text-white font-mono">${(holdingBank / 1000000).toFixed(2)}M</p>
                          <p className="text-[10px] text-ivory/40 font-semibold font-mono">{(allocationPercents.bank * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Capital Deployment Drawer */}
                <AnimatePresence>
                  {isDeploying && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl border border-gold/30 bg-gold/[0.01] p-5 shadow-inner"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-[14.5px] font-bold text-white flex items-center gap-1.5">
                            <Plus size={16} className="text-gold" />
                            Deploy Simulations Capital
                          </h4>
                          <p className="text-[12px] text-ivory/50 mt-0.5">Wire sandbox funds to Canary subsidiaries instantly for asset allocation.</p>
                        </div>
                        <button
                          onClick={() => setIsDeploying(false)}
                          className="text-ivory/40 hover:text-white"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {deployStep === 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10.5px] text-ivory/40 uppercase font-mono font-semibold">Deployment Target Business Unit</label>
                              <div className="grid grid-cols-3 gap-2 mt-1.5">
                                {[
                                  { id: "capital", label: "Strategic Accounts" },
                                  { id: "finance", label: "Commercial Operations" },
                                  { id: "bank", label: "Enterprise Operations" }
                                ].map((sub) => (
                                  <button
                                    key={sub.id}
                                    onClick={() => setDeployTarget(sub.id as any)}
                                    className={clsx(
                                      "px-3 py-2 text-[12px] font-bold rounded-lg border transition-all text-center",
                                      deployTarget === sub.id
                                        ? "bg-gold/15 border-gold text-gold"
                                        : "bg-white/[0.02] border-white/[0.08] text-ivory/60 hover:border-white/[0.2]"
                                    )}
                                  >
                                    {sub.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10.5px] text-ivory/40 uppercase font-mono font-semibold">Bespoke Amount</label>
                              <div className="flex items-center gap-2 mt-1.5">
                                {[50000, 100000, 250000, 500000].map((amt) => (
                                  <button
                                    key={amt}
                                    onClick={() => setDeployAmount(amt)}
                                    className={clsx(
                                      "flex-1 py-2 text-[11.5px] font-bold rounded-lg border font-mono transition-all",
                                      deployAmount === amt
                                        ? "bg-gold/15 border-gold text-gold"
                                        : "bg-white/[0.01] border-white/[0.05] text-ivory/60 hover:bg-white/[0.03]"
                                    )}
                                  >
                                    ${amt / 1000}K
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
                            <div className="text-[12px] text-ivory/50">
                              Proposed Allocation: <span className="font-bold text-white font-mono">${deployAmount.toLocaleString()}</span> to <span className="font-bold text-gold">{deployTarget === "capital" ? "Strategic Accounts" : deployTarget === "finance" ? "Commercial Operations" : "Enterprise Operations"}</span>.
                            </div>
                            <button
                              onClick={triggerCapitalDeployment}
                              className="rounded-lg bg-gold-gradient px-5 py-2 text-[12px] font-bold text-matte hover:opacity-90 transition-opacity flex items-center gap-1"
                            >
                              Confirm Custody Ledger Deposit <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center justify-center text-center space-y-4 font-mono">
                          {deployStep < 4 ? (
                            <Loader2 size={32} className="text-gold animate-spin" />
                          ) : (
                            <CheckCircle size={32} className="text-emerald" />
                          )}
                          <div className="space-y-1">
                            <div className="text-[11px] text-gold uppercase tracking-widest font-semibold">
                              Ecosystem Security Protocol Step {deployStep}/4
                            </div>
                            <p className="text-[13px] text-white font-medium">{deployingStatusText}</p>
                          </div>
                          
                          {/* visual timeline indicator */}
                          <div className="flex gap-1.5 w-40 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                "h-full bg-gold transition-all duration-300",
                                deployStep === 1 ? "w-1/4" : deployStep === 2 ? "w-2/4" : deployStep === 3 ? "w-3/4" : "w-full bg-emerald"
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Capital Compounder Simulator Graph */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 lg:p-6 shadow-glass relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.05] mb-5">
                    <div>
                      <h3 className="font-display text-[16px] font-bold text-white">Institutional Compounding Simulator</h3>
                      <p className="text-[12.5px] text-ivory/50 mt-0.5">Project sandbox capital growth under active subsidiary portfolios</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 bg-white/[0.02] border border-white/[0.08] p-1 rounded-xl">
                      {[
                        { id: "defensive", label: "Defensive (9.5%)" },
                        { id: "balanced", label: "Balanced (12.4%)" },
                        { id: "aggressive", label: "Aggressive (15.8%)" }
                      ].map((strat) => (
                        <button
                          key={strat.id}
                          onClick={() => setSimulatorStrategy(strat.id as any)}
                          className={clsx(
                            "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                            simulatorStrategy === strat.id
                              ? "bg-gold text-matte shadow-sm"
                              : "text-ivory/60 hover:text-white"
                          )}
                        >
                          {strat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Simulator Controls & Metric Rows */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    
                    <div className="md:col-span-2 space-y-4">
                      {/* Timeline Horizon Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-ivory/40 uppercase">Investment Horizon</span>
                          <span className="text-gold font-bold">{simulatorYears} Years</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={simulatorYears}
                          onChange={(e) => setSimulatorYears(parseInt(e.target.value))}
                          className="w-full accent-gold bg-white/[0.08] h-1.5 rounded-lg outline-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-ivory/30 font-mono">
                          <span>1 Year</span>
                          <span>10 Years</span>
                          <span>20 Years</span>
                        </div>
                      </div>

                      {/* Interactive Compounding Outputs */}
                      <div className="rounded-xl bg-white/[0.01] border border-white/[0.04] p-4 space-y-3.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11.5px] text-ivory/50">Initial Value:</span>
                          <span className="text-[13px] font-semibold text-white font-mono">${(currentTotal / 1000000).toFixed(2)}M</span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-white/[0.03] pt-2.5">
                          <span className="text-[11.5px] text-ivory/50">Accumulated Interest:</span>
                          <span className="text-[14px] font-bold text-emerald font-mono">
                            +${((simulatedDataPoints[simulatedDataPoints.length - 1].val - currentTotal) / 1000000).toFixed(2)}M
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-white/[0.03] pt-2.5">
                          <span className="text-[11.5px] text-ivory/50">Projected Balance:</span>
                          <motion.span
                            key={`${simulatorYears}-${simulatorStrategy}`}
                            initial={{ scale: 0.95, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-[18px] font-extrabold text-gold font-mono"
                          >
                            ${(simulatedDataPoints[simulatedDataPoints.length - 1].val / 1000000).toFixed(2)}M
                          </motion.span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/[0.03] pt-2.5 text-[11px]">
                          <span className="text-ivory/40">Ecosystem Loyalty Credits:</span>
                          <span className="bg-gold/15 text-gold px-2 py-0.5 rounded font-bold">
                            {simulatedDataPoints[simulatedDataPoints.length - 1].bonusPoints.toLocaleString()} PTS
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive projection line graph */}
                    <div className="md:col-span-3 bg-white/[0.01] border border-white/[0.04] rounded-xl p-3 flex flex-col justify-between min-h-[190px]">
                      <div className="text-[11px] font-mono text-ivory/40 uppercase tracking-wider flex items-center justify-between">
                        <span>Dynamic Growth Trajectory</span>
                        <span className="text-gold font-bold">APY Rate: {(simInterestRate * 100).toFixed(1)}%</span>
                      </div>

                      {/* SVG graph container */}
                      <div className="relative w-full h-[150px] mt-2">
                        <svg viewBox="0 0 600 180" className="w-full h-full overflow-visible">
                          <defs>
                            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
                              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          <line x1="40" y1="30" x2="560" y2="30" stroke="rgba(255,255,255,0.02)" strokeDasharray="2 2" />
                          <line x1="40" y1="100" x2="560" y2="100" stroke="rgba(255,255,255,0.02)" strokeDasharray="2 2" />
                          <line x1="40" y1="170" x2="560" y2="170" stroke="rgba(255,255,255,0.04)" />

                          {/* Dynamic Line & Area Paths */}
                          {svgLinePath && (
                            <>
                              {/* Filled Area */}
                              <motion.path
                                key={`area-${simulatorStrategy}`}
                                initial={{ d: svgLinePath.areaD, opacity: 0 }}
                                animate={{ d: svgLinePath.areaD, opacity: 1 }}
                                transition={{ duration: 0.4 }}
                                fill="url(#curveGradient)"
                              />
                              
                              {/* Glowing Stroke */}
                              <motion.path
                                key={`line-${simulatorStrategy}`}
                                initial={{ pathLength: 0, opacity: 0.5 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                d={svgLinePath.pathD}
                                fill="none"
                                stroke="#D4AF37"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />

                              {/* Interactive Nodes */}
                              {svgLinePath.coords.map((c, i) => (
                                <g key={i}>
                                  <motion.circle
                                    cx={c.x}
                                    cy={c.y}
                                    r={hoveredSimYear === i ? "6" : "3.5"}
                                    className="transition-all duration-150 cursor-pointer"
                                    fill={hoveredSimYear === i ? "#ffffff" : "#D4AF37"}
                                    stroke="#574929"
                                    strokeWidth="1.5"
                                    onMouseEnter={() => setHoveredSimYear(i)}
                                    onMouseLeave={() => setHoveredSimYear(null)}
                                  />
                                  {hoveredSimYear === i && (
                                    <foreignObject
                                      x={c.x - 60}
                                      y={c.y - 45}
                                      width="120"
                                      height="40"
                                      className="overflow-visible pointer-events-none"
                                    >
                                      <div className="bg-charcoal border border-gold/30 rounded-lg p-1.5 text-center text-[10px] font-mono leading-none shadow-xl">
                                        <p className="text-ivory/50">Year {i}</p>
                                        <p className="text-white font-bold mt-0.5">${(simulatedDataPoints[i].val / 1000000).toFixed(2)}M</p>
                                      </div>
                                    </foreignObject>
                                  )}
                                </g>
                              ))}
                            </>
                          )}
                        </svg>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Intelligent Wealth Recommendations Catalog */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-[16px] font-bold text-white">Recommended Financial Products</h3>
                    <p className="text-[12.5px] text-ivory/50">Personalized smart financial catalog matched to your risk profile.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {wealthProducts.map((p) => {
                      const applied = appliedProducts.includes(p.id);
                      return (
                        <motion.div
                          key={p.id}
                          whileHover={{ y: -2 }}
                          className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-r from-charcoal/50 to-charcoal-light/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-transform hover:border-gold/20 shadow-sm"
                        >
                          <div className="space-y-2 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                                {p.subsidiary}
                              </span>
                              <span className="text-[11px] text-ivory/40">Min: {p.minInvestment}</span>
                              <span className="text-[11px] text-ivory/40">Risk: {p.risk}</span>
                            </div>
                            <h4 className="font-display text-[15.5px] font-bold text-white">{p.name}</h4>
                            <p className="text-[12.5px] text-ivory/60 leading-relaxed">{p.desc}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {p.benefits.map((b, i) => (
                                <span key={i} className="text-[11px] text-gold/70 bg-white/[0.02] px-2 py-0.5 rounded flex items-center gap-1">
                                  <CheckCircle size={10} /> {b}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col items-start md:items-end justify-between shrink-0 gap-3 border-t md:border-t-0 border-white/[0.05] pt-4 md:pt-0">
                            <div className="text-left md:text-right">
                              <p className="text-[10px] uppercase tracking-wider text-ivory/40">Target Payout</p>
                              <p className="font-display text-[19px] font-extrabold text-gold font-mono">{p.return}</p>
                            </div>

                            <motion.button
                              whileHover={!applied ? { scale: 1.02 } : {}}
                              whileTap={!applied ? { scale: 0.98 } : {}}
                              disabled={applied}
                              onClick={() => applyProduct(p.id)}
                              className={clsx(
                                "w-full md:w-auto rounded-lg px-4 py-2 text-[12px] font-bold transition-all flex items-center justify-center gap-1.5",
                                applied
                                  ? "bg-white/[0.05] text-emerald border border-emerald/20 cursor-default"
                                  : "bg-white/[0.04] text-white hover:bg-gold/10 hover:text-gold border border-white/[0.08]"
                              )}
                            >
                              {applied ? (
                                <>
                                  <CheckCircle2 size={13} /> Active Application
                                </>
                              ) : (
                                <>
                                  Apply Online <ArrowUpRight size={13} />
                                </>
                              )}
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: INTERACTIVE AI ADVISOR */}
            {activeTab === "advisor" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col rounded-2xl border border-white/[0.07] bg-charcoal/40 h-[560px]"
              >
                {/* Chat header */}
                <div className="flex items-center justify-between border-b border-white/[0.05] p-4 bg-charcoal-light/20 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
                      <Sparkles size={16} className="text-gold animate-pulse" />
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald ring-2 ring-matte" />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-bold text-white">Apex AI Private Advisor</p>
                      <p className="text-[11px] text-ivory/40">Instant portfolio analysis & recommendation model</p>
                    </div>
                  </div>
                  <span className="rounded-md bg-gold/10 px-2 py-0.5 text-[10.5px] text-gold font-mono uppercase font-bold">
                    ACTIVE GROUNDING
                  </span>
                </div>

                {/* Messages panel */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
                  {chatMessages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={clsx(
                        "flex max-w-[85%] flex-col gap-1.5 rounded-2xl p-4 text-[13px] leading-relaxed",
                        msg.sender === "user"
                          ? "ml-auto bg-gold/15 text-white rounded-tr-none border border-gold/20"
                          : "bg-white/[0.02] text-ivory/90 rounded-tl-none border border-white/[0.04]"
                      )}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>

                      {/* AI product attachment cards */}
                      {msg.products && (
                        <div className="mt-3.5 pt-3.5 border-t border-white/[0.05] space-y-2">
                          <p className="text-[10px] uppercase font-bold text-gold">Direct Purchase Recommendations:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {msg.products.map((pId) => {
                              const p = wealthProducts.find((wp) => wp.id === pId);
                              if (!p) return null;
                              const applied = appliedProducts.includes(p.id);
                              return (
                                <div key={p.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg border border-white/[0.05] p-2.5">
                                  <div>
                                    <p className="text-[12px] font-bold text-white">{p.name}</p>
                                    <p className="text-[10.5px] text-gold font-semibold">{p.return}</p>
                                  </div>
                                  <button
                                    onClick={() => applyProduct(p.id)}
                                    disabled={applied}
                                    className={clsx(
                                      "px-2.5 py-1 rounded text-[11px] font-bold transition-all",
                                      applied ? "bg-white/[0.03] text-emerald" : "bg-gold text-matte hover:opacity-90"
                                    )}
                                  >
                                    {applied ? "Applied" : "Apply Now"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {isTyping && (
                    <div className="flex max-w-[100px] flex-col gap-1.5 rounded-2xl bg-white/[0.02] p-3 border border-white/[0.04]">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggestions dock */}
                <div className="px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01] flex flex-wrap gap-2">
                  {[
                    "I have ₦10 million. Where should I invest?",
                    "Tell me about the Custody Note yield",
                    "Compare real estate IRR returns"
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(s)}
                      className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[11px] text-ivory/60 hover:border-gold/30 hover:text-white transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Chat input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(chatInput);
                  }}
                  className="p-4 border-t border-white/[0.05] bg-charcoal-light/10 rounded-b-2xl flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AI advisor about yield notes, custom asset allocations, or portfolio growth..."
                    className="flex-1 bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white outline-none focus:border-gold/30 placeholder:text-ivory/30"
                  />
                  <button
                    type="submit"
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gold text-matte hover:opacity-95 transition-opacity"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </motion.div>
            )}

            {/* TAB: DOCUMENTS VAULT */}
            {activeTab === "documents" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* File Drop & Upload Simulation */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 lg:p-6 shadow-glass">
                  <h3 className="font-display text-[16px] font-bold text-white mb-1">AI-Assisted Document Vault</h3>
                  <p className="text-[12px] text-ivory/50 mb-4">
                    Upload official identification, tax declarations, or utility bills for automatic structured compliance checks.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-[11px] text-ivory/40 uppercase font-mono">KYC Category</label>
                      <select
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 text-[12px] text-white focus:border-gold/30 outline-none"
                      >
                        <option value="Utility Bill">Utility Bill (Verification)</option>
                        <option value="Compliance KYC">Government ID / Passport</option>
                        <option value="Financial Statement">Bank Statement</option>
                        <option value="Tax Declaration">Tax Declaration (W-8BEN / Form 16)</option>
                      </select>
                    </div>
                  </div>

                  {/* Drag-and-drop simulated field or Interactive Scanning Terminal */}
                  {scanStep === 0 ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileUploadSimulate(file.name);
                      }}
                      className={clsx(
                        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer",
                        isDragging ? "border-gold bg-gold/5" : "border-white/[0.08] bg-white/[0.01] hover:border-white/[0.15]"
                      )}
                      onClick={() => {
                        const fileNames = {
                          "Utility Bill": "Utility_Bill_Proof_Of_Address.pdf",
                          "Compliance KYC": "International_Passport_Scan.pdf",
                          "Financial Statement": "Bank_Statement_Holdings.pdf",
                          "Tax Declaration": "Tax_W8_Declaration_Signed.pdf"
                        };
                        handleFileUploadSimulate(fileNames[docCategory as keyof typeof fileNames] || "KYC_Document.pdf");
                      }}
                    >
                      <FileUp size={36} className="mb-2.5 text-ivory/30" />
                      <p className="text-[13px] font-bold text-white">
                        Drag and drop document or click to upload
                      </p>
                      <p className="text-[11px] text-ivory/40 mt-1 max-w-sm">
                        Supported extensions: PDF, PNG, JPG (Max 10MB). System runs compliance scans instantly.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gold/30 bg-gold/[0.01] rounded-xl p-6 space-y-4 font-mono">
                      <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="text-gold animate-spin" />
                          <span className="text-[12px] text-white font-bold uppercase tracking-wider">APEX AI SECURE SCANNER</span>
                        </div>
                        <span className="text-[11px] text-ivory/40">Target: {scanningFileName}</span>
                      </div>

                      <div className="space-y-3 text-[12.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-ivory/50">1. File Hashing & Security Integrity</span>
                          <span className={clsx(
                            "font-bold",
                            scanStep > 1 ? "text-emerald" : scanStep === 1 ? "text-gold animate-pulse" : "text-ivory/30"
                          )}>
                            {scanStep > 1 ? "✓ COMPLETE (SHA-256)" : scanStep === 1 ? "⟳ RUNNING..." : "WAITING"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-ivory/50">2. Intelligent OCR Alignment (Name matching)</span>
                          <span className={clsx(
                            "font-bold",
                            scanStep > 2 ? "text-emerald" : scanStep === 2 ? "text-gold animate-pulse" : "text-ivory/30"
                          )}>
                            {scanStep > 2 ? "✓ MATCHED (Olaoluwa Bankole)" : scanStep === 2 ? "⟳ ANALYZING TEXT..." : "WAITING"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-ivory/50">3. Sanctions Registry & PEP Cross-Audit</span>
                          <span className={clsx(
                            "font-bold",
                            scanStep > 3 ? "text-emerald" : scanStep === 3 ? "text-gold animate-pulse" : "text-ivory/30"
                          )}>
                            {scanStep > 3 ? "✓ CLEAN (No alerts)" : scanStep === 3 ? "⟳ SEARCHING DATABASES..." : "WAITING"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-ivory/50">4. Sovereign Ledger Custody Posting</span>
                          <span className={clsx(
                            "font-bold",
                            scanStep > 4 ? "text-emerald" : scanStep === 4 ? "text-gold animate-pulse" : "text-ivory/30"
                          )}>
                            {scanStep > 4 ? "✓ POSTED (TX #93a28c)" : scanStep === 4 ? "⟳ COMMITTING LEDGER..." : "WAITING"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gold-gradient h-full transition-all duration-300"
                            style={{ width: `${(scanStep / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Listing previously verified documents */}
                <div className="space-y-3">
                  <h4 className="font-display text-[14.5px] font-bold text-white">Compliance Document Log</h4>
                  <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 overflow-hidden">
                    <table className="w-full text-left text-[12.5px]">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/[0.05] text-ivory/35 uppercase text-[10px] tracking-wider font-mono">
                          <th className="p-4">Document Name</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Upload Date</th>
                          <th className="p-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {submittedDocuments.map((doc: any) => (
                          <tr key={doc.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-4 font-medium text-white flex items-center gap-2">
                              <FileText size={14} className="text-ivory/40" /> {doc.name}
                            </td>
                            <td className="p-4 text-ivory/60">{doc.category}</td>
                            <td className="p-4 text-ivory/40">{doc.date}</td>
                            <td className="p-4 text-right">
                              <span className="rounded-full bg-emerald/10 border border-emerald/20 px-2 py-0.5 text-[10.5px] text-emerald font-bold">
                                {doc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: MEETINGS BOOKING */}
            {activeTab === "meetings" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-5 gap-5"
              >
                {/* Booking scheduling form */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 lg:p-6 shadow-glass md:col-span-3 space-y-4">
                  <div>
                    <h3 className="font-display text-[16px] font-bold text-white">Schedule Private Consultation</h3>
                    <p className="text-[12px] text-ivory/50 mt-0.5">Book high-touch video calls directly with your designated partner, Elena Cho.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-ivory/40 uppercase font-mono font-semibold">Meeting Subject</label>
                      <input
                        type="text"
                        value={meetTopic}
                        onChange={(e) => setMeetTopic(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 text-[12.5px] text-white focus:border-gold/30 outline-none placeholder:text-ivory/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-ivory/40 uppercase font-mono font-semibold">Date</label>
                        <input
                          type="date"
                          value={meetDate}
                          onChange={(e) => setMeetDate(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 text-[12.5px] text-white focus:border-gold/30 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ivory/40 uppercase font-mono font-semibold">Preferred Time Slot</label>
                        <select
                          value={meetTime}
                          onChange={(e) => setMeetTime(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 text-[12.5px] text-white focus:border-gold/30 outline-none"
                        >
                          <option value="09:30 AM">09:30 AM (London/Lagos Sync)</option>
                          <option value="10:00 AM">10:00 AM</option>
                          <option value="11:30 AM">11:30 AM</option>
                          <option value="02:30 PM">02:30 PM</option>
                          <option value="04:00 PM">04:00 PM</option>
                        </select>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        addMeeting({
                          title: meetTopic,
                          date: new Date(meetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                          time: meetTime,
                          rmName: "Elena Cho",
                          type: "Video",
                        });
                        setMeetTopic("Strategic Asset Allocation Review");
                      }}
                      className="w-full rounded-lg bg-gold-gradient py-2.5 text-[13px] font-bold text-matte transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-gold/5"
                    >
                      <Calendar size={14} /> Schedule Video Consultation
                    </motion.button>
                  </div>
                </div>

                {/* RM Info Card + Upcoming bookings list */}
                <div className="md:col-span-2 flex flex-col gap-4">
                  {/* Elena Cho RM Info Card */}
                  <div className="rounded-2xl border border-gold/15 bg-gold/[0.02] p-4 text-[12.5px] space-y-3 shadow-glass">
                    <p className="text-[10px] uppercase text-gold font-bold tracking-wider font-mono">YOUR ADVISORY PARTNER</p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-gradient font-display text-[12px] font-bold text-matte">
                        EC
                      </div>
                      <div>
                        <p className="font-bold text-white">Elena Cho</p>
                        <p className="text-[11px] text-ivory/50">Senior Relationship Director, London</p>
                      </div>
                    </div>
                    <p className="text-ivory/60 leading-relaxed text-[11.5px]">
                      Elena coordinates institutional asset distribution and portfolio structuring for high-net-worth clients across Apex Sync business units.
                    </p>
                  </div>

                  {/* Booked Meetings log */}
                  <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass flex-1">
                    <h4 className="font-display text-[13.5px] font-bold text-white mb-2">Confirmed Consultations</h4>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {bookedMeetings.map((meet: any) => (
                        <div key={meet.id} className="rounded-lg bg-white/[0.01] border border-white/[0.04] p-3 text-[12px] space-y-1">
                          <p className="font-bold text-white">{meet.title}</p>
                          <div className="flex justify-between items-center text-ivory/50 text-[11px]">
                            <span>{meet.date} at {meet.time}</span>
                            <span className="text-emerald font-semibold font-mono flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald" /> {meet.status}
                            </span>
                          </div>
                          <p className="text-ivory/40 text-[10px]">Host: {meet.rmName} ({meet.type} Meeting)</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: REWARDS & REFERRALS */}
            {activeTab === "rewards" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Referrals & Trust Banner */}
                <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 lg:p-6 shadow-glass">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                      <Gift size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-[16px] font-bold text-white">Elite Referral Program</h3>
                      <p className="text-[12.5px] text-ivory/60 leading-relaxed">
                        Refer qualified high-net-worth clients to the Canary Point platform. Receive up to <span className="font-semibold text-gold">0.25% fee-share rebate</span> on their initial capital deployment, while your colleagues lock in premium onboarding perks.
                      </p>
                    </div>
                  </div>

                  {/* Referral URL copy container */}
                  <div className="mt-5 max-w-md">
                    <label className="text-[11px] text-ivory/40 uppercase font-mono font-semibold">Bespoke Invite Link</label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5 pl-3">
                      <span className="text-[12.5px] text-white font-mono truncate select-all flex-1">
                        https://canarypoint.com/ref/olaoluwa99
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCopyReferral}
                        className={clsx(
                          "rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors",
                          copied ? "bg-emerald/15 text-emerald" : "bg-gold text-matte hover:opacity-90"
                        )}
                      >
                        {copied ? "Copied" : "Copy Link"}
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Loyalty / Club tier tracking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-2">
                    <div className="flex items-center gap-2 text-gold">
                      <Award size={16} />
                      <h4 className="font-display text-[14.5px] font-bold text-white">Platinum Tier Benefits</h4>
                    </div>
                    <ul className="text-[12px] text-ivory/60 space-y-1.5 pl-4 list-disc leading-relaxed">
                      <li>Bespoke collateral ratios for credit limits</li>
                      <li>Express 2-hour SLA review for compliance KYC documents</li>
                      <li>Bypass standard queue for senior advisory video calls</li>
                      <li>Exclusive allocations in high-yield seed investment rounds</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass space-y-3">
                    <h4 className="font-display text-[14.5px] font-bold text-white">Unlock Private Banking</h4>
                    <p className="text-[12px] text-ivory/50">
                      Private Banking class unlocks automatically at AUM balances over <span className="font-bold text-gold">$15.00M</span>.
                    </p>
                    {/* Progress tracking bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10.5px] font-mono text-ivory/35">
                        <span>Current: ${(currentTotal / 1000000).toFixed(2)}M</span>
                        <span>Goal: $15.00M</span>
                      </div>
                      <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-gold-gradient h-full transition-all duration-300" style={{ width: `${(currentTotal / 15000000) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
