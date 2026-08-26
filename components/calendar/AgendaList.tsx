"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  RefreshCcw,
  Workflow,
  ClipboardCheck,
  Clock,
  PlusCircle,
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  FileText,
  HelpCircle,
  Activity,
  TrendingUp,
  Sliders,
  Check,
  UserCheck
} from "lucide-react";
import clsx from "clsx";
import { isDemoMode } from "@/lib/demo";

// Redefine rich category-oriented metadata
type EventCategory =
  | "Executive Decision"
  | "Customer Meeting"
  | "Renewal"
  | "Strategy"
  | "Operations"
  | "Compliance"
  | "Review"
  | "Workflow"
  | "Internal";

interface DecisionIntellEvent {
  id: string;
  title: string;
  date: string; // e.g. "Aug 18, 2026"
  dayNumber: number; // e.g. 18
  time: string;
  category: EventCategory;
  status: "completed" | "upcoming";
  participants: string[];
  relatedCustomer: string;
  relatedDepartment: "Strategic Accounts" | "Enterprise Operations" | "Commercial Operations" | "Customer Operations";
  relatedWorkflow: string;
  relatedContract: string;
  previousMeetings: string[];
  relevantDocuments: string[];
  decisionRequired: string;
  businessImpact: string; // Naira amount
  dependencies: string[];
  executiveBrief: {
    currentContractValue: string;
    revenueHistory: string;
    lastInteraction: string;
    openSupportIssues: number;
    renewalProbability: string;
    outstandingRisks: string;
    expansionOpportunity: string;
    recommendedDiscussionPoints: string[];
  };
  decisionCapture?: {
    decisionsMade: string[];
    actionItems: { task: string; owner: string; deadline: string }[];
    relatedWorkflows: string[];
    followUpDate: string;
  };
}

// Canonical Business Units color indicators
const categoryStyles: Record<EventCategory, { bg: string; text: string; border: string; dot: string }> = {
  "Executive Decision": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-400" },
  "Customer Meeting": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-400" },
  "Renewal": { bg: "bg-gold/10", text: "text-gold", border: "border-gold/20", dot: "bg-gold" },
  "Strategy": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-400" },
  "Operations": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  "Compliance": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
  "Review": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", dot: "bg-cyan-400" },
  "Workflow": { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", dot: "bg-indigo-400" },
  "Internal": { bg: "bg-white/10", text: "text-white/70", border: "border-white/15", dot: "bg-white/40" },
};

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function AgendaList() {
  // Rich baseline organizational schedule
  const [events, setEvents] = useState<DecisionIntellEvent[]>([
    {
      id: "dec-1",
      title: "Meridian Logistics — Renewal & Strategic Pricing Alignment",
      date: "Aug 18, 2026",
      dayNumber: 18,
      time: "10:00 AM",
      category: "Renewal",
      status: "upcoming",
      participants: ["Elena Cho", "Marcus Fenwick", "Sarah Below"],
      relatedCustomer: "Meridian Logistics Group",
      relatedDepartment: "Commercial Operations",
      relatedWorkflow: "Context-Aware Churn Prevention",
      relatedContract: "ML-SLA-2024-RENEW",
      previousMeetings: [
        "Jul 14 - Performance Alignment Review",
        "Jun 02 - Usage Baseline Assessment"
      ],
      relevantDocuments: [
        "Meridian_Logistics_SLA_Variance_Report.pdf",
        "Apex_Sync_Pricing_Hedge_Tier3.xlsx"
      ],
      decisionRequired: "Approve premium custom Naira-indexed pricing matrix to offset the 4.2% mid-market consumer contraction and lock 2-year retention.",
      businessImpact: "₦18.4M",
      dependencies: [
        "Pricing matrix clearance",
        "Operations resource pre-allocation",
        "Strategic accounts director sign-off",
        "Client SLA notification dispatch"
      ],
      executiveBrief: {
        currentContractValue: "₦145.0M ARR",
        revenueHistory: "+18.2% Compound Annual Growth over 3 years",
        lastInteraction: "Email exchange with Sarah Below regarding SLA warning bypass logs",
        openSupportIssues: 3,
        renewalProbability: "84% (Due in 21 days)",
        outstandingRisks: "Sponsor departed last month; custom SLA requirements under discussion.",
        expansionOpportunity: "Upsell Commercial Operations automated vetting API interface (+₦3.5M ARR).",
        recommendedDiscussionPoints: [
          "Acknowledge new Sponsor's feedback and reassure long-term operational commitment.",
          "Propose the ₦18.4M SLA index adjustment with balanced penalty limits.",
          "Offer pre-meeting draft audit documents as structural backup."
        ]
      }
    },
    {
      id: "dec-2",
      title: "Enterprise Operations — Core Gateway Failover Vetting",
      date: "Aug 18, 2026",
      dayNumber: 18,
      time: "1:30 PM",
      category: "Executive Decision",
      status: "upcoming",
      participants: ["Elena Cho", "Tom Reyes", "Nina Torres"],
      relatedCustomer: "Brightwell Regional Bank",
      relatedDepartment: "Enterprise Operations",
      relatedWorkflow: "API Failover & Reconciliation Automation",
      relatedContract: "BRB-CORE-2025-FAIL",
      previousMeetings: ["Aug 05 - Digital Transformation Workshop"],
      relevantDocuments: ["API_Failure_Reconciliation_Security_SLA.docx"],
      decisionRequired: "Approve routing backup payments via the new secondary automated failover gateway to secure high SLA compliance.",
      businessImpact: "₦11.2M",
      dependencies: [
        "Core compliance clearance",
        "IT Security authorization",
        "Gateway deployment switch"
      ],
      executiveBrief: {
        currentContractValue: "₦92.0M ARR",
        revenueHistory: "Stable flat revenue over last 4 quarters",
        lastInteraction: "Workshop with Tom Reyes on systems integration",
        openSupportIssues: 1,
        renewalProbability: "95% (Due in 45 days)",
        outstandingRisks: "API timeouts reported on previous gateway node.",
        expansionOpportunity: "Cloud replication backup redundancy suite onboarding (+₦2.1M ARR).",
        recommendedDiscussionPoints: [
          "Confirm backup gateway latency benchmarks are under 12ms.",
          "Highlight the ₦11.2M potential operational exposure hedge."
        ]
      }
    },
    {
      id: "dec-3",
      title: "Ashford & Vale Wealth — Portfolio Growth Decision",
      date: "Aug 19, 2026",
      dayNumber: 19,
      time: "11:00 AM",
      category: "Strategy",
      status: "upcoming",
      participants: ["Priya Nair", "Diane Okoro"],
      relatedCustomer: "Ashford & Vale Wealth",
      relatedDepartment: "Strategic Accounts",
      relatedWorkflow: "Portfolio Report Auto-Generation",
      relatedContract: "AVW-PORT-STRAT",
      previousMeetings: ["Jul 10 - Initial Asset Exposure Audit"],
      relevantDocuments: ["Ashford_Wealth_Q2_Performance_Dossier.pdf"],
      decisionRequired: "Approve Strategic Accounts structural capital re-allocation limits.",
      businessImpact: "₦32.5M",
      dependencies: [
        "Re-allocation limits approval",
        "Board audit compliance checklist"
      ],
      executiveBrief: {
        currentContractValue: "₦210.0M ARR",
        revenueHistory: "+22.4% YoY Growth",
        lastInteraction: "Dinner meeting with Diane Okoro on strategic scaling",
        openSupportIssues: 0,
        renewalProbability: "98% (Due in 60 days)",
        outstandingRisks: "Minor exposure index fluctuations in fixed-yield bonds.",
        expansionOpportunity: "Strategic Accounts VIP compliance automated audit dashboard (+₦6.0M ARR).",
        recommendedDiscussionPoints: [
          "Congratulate customer champion on recent internal promotion.",
          "Confirm the ₦32.5M transition timelines align with their tax cycle."
        ]
      }
    },
    {
      id: "dec-4",
      title: "Solace Home Insurance — Claims Queue Review",
      date: "Aug 18, 2026",
      dayNumber: 18,
      time: "8:30 AM",
      category: "Operations",
      status: "completed",
      participants: ["Anita Brooks", "Jordan Lee", "Marcus Webb"],
      relatedCustomer: "Solace Home Insurance",
      relatedDepartment: "Customer Operations",
      relatedWorkflow: "Claims Queue Bypass Automation",
      relatedContract: "SHI-CLAIMS-2025",
      previousMeetings: ["Aug 12 - Queue Intake Deep Dive"],
      relevantDocuments: ["Solace_Insurance_Bypass_Audit_Log.docx"],
      decisionRequired: "Approve permanent automated bypass rules for insurance claims below ₦5.0M.",
      businessImpact: "₦5.8M",
      dependencies: [
        "Bypass security threshold checklist",
        "Linter and compliance database updates"
      ],
      executiveBrief: {
        currentContractValue: "₦65.0M ARR",
        revenueHistory: "Steady +10.5% YoY",
        lastInteraction: "Technical review on claims automated classification rules",
        openSupportIssues: 2,
        renewalProbability: "92%",
        outstandingRisks: "Slight bottlenecking during high peak claim incident spikes.",
        expansionOpportunity: "Core automation engine upgrade (+₦1.8M ARR).",
        recommendedDiscussionPoints: [
          "Review the successful ₦5.8M throughput boost from temporary bypass tests."
        ]
      },
      decisionCapture: {
        decisionsMade: [
          "Permanently authorized the ₦5.0M auto-bypass claim limit.",
          "Allocated secondary vetting desk backup hours."
        ],
        actionItems: [
          { task: "Update routing filters in Context Engine", owner: "Elena Cho", deadline: "Aug 19, 2026" },
          { task: "Send finalized operational compliance log", owner: "Marcus Webb", deadline: "Aug 21, 2026" }
        ],
        relatedWorkflows: ["Claims Bottleneck Bypass Automation"],
        followUpDate: "Sep 01, 2026"
      }
    },
    {
      id: "dec-5",
      title: "Quarterly Compliance Audit & Risk Assessment",
      date: "Aug 20, 2026",
      dayNumber: 20,
      time: "3:00 PM",
      category: "Compliance",
      status: "upcoming",
      participants: ["Adefemi Falana", "Nina Torres", "Elena Cho"],
      relatedCustomer: "Apex Sync Group Entities",
      relatedDepartment: "Enterprise Operations",
      relatedWorkflow: "Audit Exception Reconciliation",
      relatedContract: "COMP-INTERNAL-2026",
      previousMeetings: ["Jul 15 - Reconciliation Process Sync"],
      relevantDocuments: ["Apex_Sync_FY26_Regulatory_Audit.pdf"],
      decisionRequired: "Ratify updated regulatory compliance reporting framework across all four business units.",
      businessImpact: "₦15.0M",
      dependencies: ["Internal Audit Signoff", "Legal Counsel clearance"],
      executiveBrief: {
        currentContractValue: "N/A (Internal Security)",
        revenueHistory: "N/A",
        lastInteraction: "Internal briefing with Adefemi Falana on nightly audit exception flags",
        openSupportIssues: 0,
        renewalProbability: "100%",
        outstandingRisks: "New central bank reporting requirements are stricter starting next quarter.",
        expansionOpportunity: "N/A",
        recommendedDiscussionPoints: [
          "Confirm deployment schedules for the Audit Exception Reconciliation workflow.",
          "Verify all units mapped to clean canonical naming guidelines."
        ]
      }
    },
    {
      id: "dec-6",
      title: "Internal Operations Allocation Alignment",
      date: "Aug 18, 2026",
      dayNumber: 18,
      time: "11:30 AM",
      category: "Internal",
      status: "upcoming",
      participants: ["Elena Cho", "Marcus Webb", "Priya Nair"],
      relatedCustomer: "Apex Sync Group Entities",
      relatedDepartment: "Strategic Accounts",
      relatedWorkflow: "Capacity Intelligence Routing",
      relatedContract: "INTERNAL-OPS-CAP",
      previousMeetings: ["Aug 14 - Weekly Staff Allocation"],
      relevantDocuments: ["Operations_Intelligence_Resource_Map.pdf"],
      decisionRequired: "Re-allocate 18% of available human advisor hours from Commercial Operations to Strategic Accounts.",
      businessImpact: "₦8.4M",
      dependencies: ["Advisor allocation balance clearance", "Operational lead verification"],
      executiveBrief: {
        currentContractValue: "N/A",
        revenueHistory: "N/A",
        lastInteraction: "Resource discussion with Elena Cho",
        openSupportIssues: 0,
        renewalProbability: "100%",
        outstandingRisks: "Advisor burnout index increases if re-allocations are delayed.",
        expansionOpportunity: "N/A",
        recommendedDiscussionPoints: [
          "Highlight the 18% capacity impact and direct benefits to Sarah Below's account team."
        ]
      }
    }
  ]);

  // Calendar View Control State
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "agenda">("month");
  const [selectedDay, setSelectedDay] = useState<number | null>(18); // Default to Aug 18, 2026
  const [selectedEventId, setSelectedEventId] = useState<string>("dec-1");

  // Filter category control
  const [categoryFilter, setCategoryFilter] = useState<"all" | EventCategory>("all");

  // Conflict state simulation
  const [hasConflict, setHasConflict] = useState<boolean>(true);
  const [conflictResolved, setConflictResolved] = useState<boolean>(false);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM");
  const [newCategory, setNewCategory] = useState<EventCategory>("Executive Decision");
  const [newAttendees, setNewAttendees] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [newDepartment, setNewDepartment] = useState<"Strategic Accounts" | "Enterprise Operations" | "Commercial Operations" | "Customer Operations">("Strategic Accounts");
  const [newImpact, setNewImpact] = useState("₦5.0M");

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedDay) return;

    const newEvent: DecisionIntellEvent = {
      id: `custom-dec-${Date.now()}`,
      title: newTitle,
      date: `Aug ${selectedDay}, 2026`,
      dayNumber: selectedDay,
      time: newTime,
      category: newCategory,
      status: "upcoming",
      participants: newAttendees ? newAttendees.split(",").map((a) => a.trim()) : ["Elena Cho"],
      relatedCustomer: newCustomer || "Apex Sync Group Entities",
      relatedDepartment: newDepartment,
      relatedWorkflow: "Custom Automated Action",
      relatedContract: "COMP-NEW-2026",
      previousMeetings: ["None - First contact"],
      relevantDocuments: ["Standard_Agreement_Brief.pdf"],
      decisionRequired: "Approve standard terms of the proposed alignment session.",
      businessImpact: newImpact,
      dependencies: ["Compliance verification", "Contract signoff"],
      executiveBrief: {
        currentContractValue: "₦0.0M (New Client Offer)",
        revenueHistory: "N/A",
        lastInteraction: "Initial contact email logs",
        openSupportIssues: 0,
        renewalProbability: "100%",
        outstandingRisks: "None flagged",
        expansionOpportunity: "New integration upgrade pathway",
        recommendedDiscussionPoints: ["Verify parameters align with core guidelines."]
      }
    };

    setEvents((prev) => [newEvent, ...prev]);
    setSelectedEventId(newEvent.id);
    setNewTitle("");
    setNewTime("10:00 AM");
    setNewAttendees("");
    setNewCustomer("");
    setShowAddForm(false);
  };

  // Resolve conflict helper
  const handleResolveConflict = () => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id === "dec-6") {
          return {
            ...evt,
            time: "3:30 PM", // Reschedule internal meeting to resolve overlap
            decisionRequired: "Re-allocate 18% available human hours. Rescheduled from 11:30 AM to resolve conflict."
          };
        }
        return evt;
      })
    );
    setConflictResolved(true);
  };

  // Filter events based on selected filter AND selected day
  const filteredEvents = useMemo(() => {
    let list = events;
    if (categoryFilter !== "all") {
      list = list.filter((e) => e.category === categoryFilter);
    }
    if (selectedDay !== null && viewMode === "month") {
      list = list.filter((e) => e.dayNumber === selectedDay);
    }
    return list;
  }, [events, categoryFilter, selectedDay, viewMode]);

  // Calendar cells generation for August 2026
  // August 1, 2026 is Saturday. Sunday-Friday empty (6 cells offset)
  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; dateStr: string | null; events: DecisionIntellEvent[] }> = [];
    // 6 offset spaces
    for (let i = 0; i < 6; i++) {
      cells.push({ day: null, dateStr: null, events: [] });
    }
    // Days 1 to 31
    for (let day = 1; day <= 31; day++) {
      const dateStr = `Aug ${day}, 2026`;
      const dayEvents = events.filter((e) => e.dayNumber === day);
      cells.push({ day, dateStr, events: dayEvents });
    }
    // Final fillers
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null, events: [] });
    }
    return cells;
  }, [events]);

  const activeEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0];
  }, [events, selectedEventId]);

  if (!isDemoMode()) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass my-12 w-full max-w-2xl mx-auto" id="calendar-empty-state">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/5 border border-gold/15 text-gold mb-5">
          <CalendarDays size={24} className="animate-pulse" />
        </div>
        <h3 className="font-display text-[18px] font-bold tracking-tight text-ivory uppercase">
          No Calendar Events Connected
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-ivory/55">
          Connect your organizational calendars or scheduling services to synchronise timelines, trace strategic decisions, and manage upcoming contract alignments.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
            Calendar Sweeping Offline
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_400px]" id="calendar-intelligence-core">
      
      {/* COLUMN A: CALENDAR NAV & DECISION QUEUE */}
      <div className="space-y-4">
        
        {/* VIEW SELECTOR */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-1.5 shadow-glass flex gap-1">
          {(["month", "week", "day", "agenda"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={clsx(
                "flex-1 rounded-lg py-1.5 text-center text-[11px] font-mono font-bold uppercase transition-all",
                viewMode === mode
                  ? "bg-gold text-matte shadow-gold-glow-soft"
                  : "text-ivory/50 hover:bg-white/[0.02] hover:text-ivory/80"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* AUGUST 2026 CALENDAR CARD */}
        {viewMode === "month" && (
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-[13px] font-bold text-ivory">August 2026</p>
                <p className="text-[10px] text-ivory/45">Apex Sync Coordination Desk</p>
              </div>
              <div className="flex gap-1 text-gold">
                <CalendarDays size={14} />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center text-[10.5px] text-ivory/40 font-mono mb-2">
              {DAYS_OF_WEEK.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                const isSelected = selectedDay === cell.day;
                const hasEvents = cell.events.length > 0;

                return (
                  <button
                    key={idx}
                    disabled={cell.day === null}
                    onClick={() => {
                      if (cell.day) {
                        setSelectedDay(cell.day);
                        // Auto-select first event on that day if exists
                        const firstOnDay = cell.events[0];
                        if (firstOnDay) setSelectedEventId(firstOnDay.id);
                      }
                    }}
                    className={clsx(
                      "relative flex aspect-square flex-col items-center justify-center rounded-lg text-[10.5px] font-medium transition-all cursor-pointer",
                      cell.day === null
                        ? "opacity-0"
                        : isSelected
                          ? "bg-gold text-matte font-bold shadow-gold-glow-soft"
                          : "bg-white/[0.01] border border-white/[0.04] text-ivory hover:bg-white/[0.04]",
                      cell.day === 18 && !isSelected && "border-gold/50 text-gold font-bold" // Today marker (Aug 18)
                    )}
                  >
                    <span>{cell.day}</span>
                    {hasEvents && (
                      <div className="absolute bottom-1 flex gap-0.5 justify-center">
                        {cell.events.slice(0, 3).map((e) => {
                          const sty = categoryStyles[e.category] || categoryStyles["Internal"];
                          return (
                            <span
                              key={e.id}
                              className={clsx("h-1 w-1 rounded-full", isSelected ? "bg-matte" : sty.dot)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-3.5 border-t border-white/[0.05] pt-3 flex items-center justify-between">
                <p className="text-[11px] text-ivory/50 font-mono">
                  Day: <span className="text-gold font-bold">Aug {selectedDay}</span>
                </p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-[10.5px] text-gold font-mono font-medium hover:underline cursor-pointer"
                >
                  All Days
                </button>
              </div>
            )}
          </div>
        )}

        {/* DECISION CATEGORY FILTERS */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass">
          <p className="mb-3 text-[11px] font-mono font-bold text-gold uppercase tracking-wider">Classification filter</p>
          <div className="space-y-1">
            <button
              onClick={() => setCategoryFilter("all")}
              className={clsx(
                "w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all",
                categoryFilter === "all"
                  ? "bg-white/5 text-ivory font-bold border-l-2 border-gold"
                  : "text-ivory/55 hover:bg-white/[0.02] hover:text-ivory/80"
              )}
            >
              <span>Show All Decisions</span>
              <span className="font-mono text-[10px] opacity-45">{events.length}</span>
            </button>
            {(Object.keys(categoryStyles) as EventCategory[]).map((cat) => {
              const count = events.filter((e) => e.category === cat).length;
              if (count === 0) return null;
              const sty = categoryStyles[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={clsx(
                    "w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all",
                    categoryFilter === cat
                      ? "bg-white/5 text-ivory font-bold border-l-2 border-gold"
                      : "text-ivory/55 hover:bg-white/[0.02] hover:text-ivory/80"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={clsx("h-1.5 w-1.5 rounded-full", sty.dot)} />
                    {cat}
                  </span>
                  <span className="font-mono text-[10px] opacity-45">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* UPCOMING DECISIONS QUEUE */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-3">
          <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
            <TrendingUp size={13} className="text-gold" />
            <p className="font-display text-[12px] font-bold text-ivory uppercase tracking-wider">Upcoming Decisions</p>
          </div>

          <div className="space-y-2">
            {[
              { title: "Meridian Logistics Renewal", due: "Decision in 2 days", impact: "₦8.4M", type: "Renewal" },
              { title: "Enterprise Pricing Review", due: "Decision in 4 days", impact: "₦3.2M", type: "Pricing" },
              { title: "Operations Capacity Allocation", due: "Decision tomorrow", impact: "18% Shift", type: "Capacity" }
            ].map((dec, idx) => (
              <div key={idx} className="p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                <div className="flex justify-between items-start">
                  <p className="text-[11.5px] font-bold text-ivory/90 leading-tight">{dec.title}</p>
                  <span className="text-[9px] font-mono px-1.5 py-0.1 bg-gold/15 text-gold border border-gold/10 rounded">
                    {dec.type}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-ivory/40">
                  <span>{dec.due}</span>
                  <span className="text-gold font-bold">{dec.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* COLUMN B: MAIN TIMELINE/AGENDA & CONFLICT INTELLIGENCE */}
      <div className="space-y-4" style={{ marginLeft: "0px" }}>
        
        {/* CONFLICT INTELLIGENCE WARNING BLOCK */}
        {hasConflict && !conflictResolved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex gap-3 shadow-glass"
          >
            <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1.5 flex-1">
              <p className="text-[12px] font-mono font-bold text-red-400 uppercase tracking-wider">
                Decision Conflict Detected
              </p>
              <p className="text-[11.5px] text-ivory/70 leading-relaxed">
                Stakeholder <span className="font-bold text-ivory">Elena Cho</span> is required for overlapping strategic priorities: 
                <br />
                <strong>Meridian Logistics Pricing Review</strong> (10:00 AM) and <strong>Internal Operations Allocation</strong> (11:30 AM). 
                An 18% capacity impact re-allocation and a ₦18.4M contract risk compete.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleResolveConflict}
                  className="rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-mono text-[10.5px] font-bold px-3 py-1 cursor-pointer"
                >
                  Resolve: Shift Internal to 3:30 PM
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* CONFLICT RESOLUTION SUCCESS CONFIRMATION */}
        {conflictResolved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-center gap-2.5 text-[11.5px] text-emerald-400 font-mono"
          >
            <CheckCircle2 size={15} />
            <span>Conflict resolved: shifted Internal Operations Allocation to 3:30 PM. Calendar aligned.</span>
          </motion.div>
        )}

        {/* AGENDA SECTION HEADER */}
        <div className="flex items-center justify-between bg-white/[0.01] border-b border-white/[0.04] pb-3" style={{ paddingLeft: "3px", paddingRight: "3px" }}>
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-ivory">
              {viewMode === "month" 
                ? `Decisions List (Aug ${selectedDay || "All"})`
                : viewMode === "week"
                  ? "Decision Timeline (This Week: Aug 16 - Aug 22)"
                  : viewMode === "day"
                    ? "Decision Timeline (Aug 18, 2026)"
                    : "Comprehensive Decision Archive"}
            </h2>
            <p className="text-[11px] text-ivory/40">Select a scheduled slot to run cognitive intelligence analysis.</p>
          </div>
          <button
            onClick={() => {
              if (!selectedDay) setSelectedDay(18);
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gold/15 px-3 py-1.5 text-[11px] font-mono font-bold text-gold border border-gold/20 hover:bg-gold/20 cursor-pointer"
          >
            <PlusCircle size={12} />
            Add Decision Slot
          </button>
        </div>

        {/* CREATE DECISION EVENT FORM */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddEvent}
              className="overflow-hidden rounded-2xl border border-gold/20 bg-charcoal p-4 shadow-gold-glow-soft space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                <p className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays size={13} />
                  Schedule Decision for Aug {selectedDay}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-ivory/30 hover:text-ivory/80"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Decision Title</label>
                  <input
                    required
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="E.g. Custom Pricing Matrix Approval"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Time Slot</label>
                  <input
                    required
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="E.g. 10:00 AM"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EventCategory)}
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                  >
                    <option value="Executive Decision">Executive Decision</option>
                    <option value="Customer Meeting">Customer Meeting</option>
                    <option value="Renewal">Renewal</option>
                    <option value="Strategy">Strategy</option>
                    <option value="Operations">Operations</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Review">Review</option>
                    <option value="Workflow">Workflow</option>
                    <option value="Internal">Internal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Attendees (comma-separated)</label>
                  <input
                    type="text"
                    value={newAttendees}
                    onChange={(e) => setNewAttendees(e.target.value)}
                    placeholder="Elena Cho, Marcus Webb"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Related Customer</label>
                  <input
                    type="text"
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    placeholder="E.g. Meridian Logistics"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Potential Impact Cost</label>
                  <input
                    type="text"
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value)}
                    placeholder="E.g. ₦18.4M"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ivory outline-none focus:border-gold/30"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-mono tracking-[0.06em] text-ivory/40">Business Unit</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-charcoal px-2.5 py-1.5 text-[12px] text-ivory outline-none"
                  >
                    <option value="Enterprise Operations">Enterprise Operations</option>
                    <option value="Commercial Operations">Commercial Operations</option>
                    <option value="Strategic Accounts">Strategic Accounts</option>
                    <option value="Customer Operations">Customer Operations</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-mono text-ivory/50 hover:bg-white/[0.03] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-gold px-4.5 py-1.5 text-[11px] font-mono font-bold text-matte transition-colors hover:bg-gold/90 cursor-pointer"
                >
                  Create Slot
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* DECISION VIEW RENDER MODES */}
        <div className="space-y-4">
          
          {/* MONTH MODE - VIEWING CHOSEN DAY OR ALL LISTINGS */}
          {viewMode === "month" && (
            <div className="space-y-2" style={{ marginLeft: "-8px", marginRight: "-8px" }}>
              {filteredEvents.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.05] bg-charcoal/20 p-10 text-center">
                  <Clock size={20} className="mx-auto text-gold/40 mb-2" />
                  <p className="text-[12px] font-mono text-ivory/40">No decisions scheduled for Aug {selectedDay || "All"}.</p>
                  <button onClick={() => setSelectedDay(null)} className="text-[11px] font-mono text-gold hover:underline mt-1.5 cursor-pointer">
                    Show full month directory
                  </button>
                </div>
              ) : (
                filteredEvents.map((evt, idx) => {
                  const sty = categoryStyles[evt.category];
                  const isSelected = evt.id === selectedEventId;
                  const isCompleted = evt.status === "completed";

                  let eventCardStyle: React.CSSProperties = {};
                  if (idx >= 0 && idx <= 3) {
                    eventCardStyle = { paddingLeft: "6px", paddingRight: "3px" };
                  }

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={clsx(
                        "rounded-xl border p-4.5 text-left transition-all cursor-pointer relative overflow-hidden",
                        isSelected 
                          ? "bg-white/[0.04] border-gold/40 shadow-gold-glow-soft" 
                          : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]"
                      )}
                      style={eventCardStyle}
                    >
                      {/* Active gold focal border overlay */}
                      {isSelected && <div className="absolute top-0 bottom-0 left-0 w-1 bg-gold" />}

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={clsx("px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase border shrink-0", sty.bg, sty.text, sty.border)}>
                              {evt.category}
                            </span>
                            <span className="text-[10px] font-mono text-ivory/40">{evt.time} · {evt.date}</span>
                          </div>
                          <h3 className="mt-2 text-[13.5px] font-bold text-ivory leading-snug">{evt.title}</h3>
                          <p className="mt-1.5 text-[11px] text-ivory/50 line-clamp-1">{evt.decisionRequired}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[12.5px] font-bold text-gold font-mono">{evt.businessImpact}</p>
                          <span className={clsx("mt-1.5 inline-block px-1.5 py-0.1 text-[9px] font-mono rounded uppercase border", 
                            isCompleted 
                              ? "text-emerald border-emerald/20 bg-emerald/5" 
                              : "text-amber border-amber/20 bg-amber/5"
                          )}>
                            {evt.status}
                          </span>
                        </div>
                      </div>

                      {/* Summary indicator */}
                      <div className="mt-3.5 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-ivory/40">
                        <span className="truncate">Customer: <strong className="text-ivory/75">{evt.relatedCustomer}</strong></span>
                        <span className="shrink-0 flex items-center gap-1.5 text-gold/80 hover:text-gold">
                          Cognitive Audit <ArrowRight size={10} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* WEEK VIEW: TIMELINE */}
          {viewMode === "week" && (
            <div className="space-y-4">
              {[16, 17, 18, 19, 20, 21, 22].map((dayNum) => {
                const dayEvents = events.filter((e) => e.dayNumber === dayNum);
                const isToday = dayNum === 18;

                return (
                  <div key={dayNum} className={clsx("rounded-xl border p-4", isToday ? "border-gold/30 bg-gold/[0.01]" : "border-white/[0.04] bg-white/[0.005]")}>
                    <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2.5">
                      <p className="text-[11.5px] font-mono font-bold text-ivory/80 uppercase">
                        August {dayNum}, 2026 {isToday && <span className="text-gold font-bold ml-1">(Today)</span>}
                      </p>
                      <span className="text-[10px] font-mono text-ivory/40">{dayEvents.length} scheduled</span>
                    </div>

                    {dayEvents.length === 0 ? (
                      <p className="text-[10.5px] font-mono text-ivory/30 italic">No critical decisions scheduled for this day.</p>
                    ) : (
                      <div className="space-y-2">
                        {dayEvents.map((evt) => (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEventId(evt.id)}
                            className={clsx(
                              "p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-4",
                              evt.id === selectedEventId ? "border-gold/40 bg-white/5" : "border-white/[0.03] bg-white/[0.01]"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-ivory truncate">{evt.title}</p>
                              <p className="text-[10.5px] text-ivory/50 font-mono mt-0.5">{evt.time} · {evt.category}</p>
                            </div>
                            <span className="text-[11.5px] font-mono font-bold text-gold shrink-0">{evt.businessImpact}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW: HOURLY TIMELINE */}
          {viewMode === "day" && (
            <div className="space-y-3 rounded-2xl border border-white/[0.05] bg-charcoal/20 p-4">
              <p className="text-[11.5px] font-mono font-bold text-gold uppercase tracking-wider mb-2.5">Tuesday, August 18, 2026 Timeline</p>
              {[
                { hr: "08:00 AM", event: events.find((e) => e.dayNumber === 18 && e.time === "8:30 AM") },
                { hr: "09:00 AM", event: null },
                { hr: "10:00 AM", event: events.find((e) => e.dayNumber === 18 && e.time === "10:00 AM") },
                { hr: "11:00 AM", event: events.find((e) => e.dayNumber === 18 && e.time === "11:30 AM") },
                { hr: "12:00 PM", event: null },
                { hr: "01:00 PM", event: events.find((e) => e.dayNumber === 18 && e.time === "1:30 PM") },
                { hr: "02:00 PM", event: null },
                { hr: "03:00 PM", event: null },
                { hr: "04:00 PM", event: null },
              ].map((slot, i) => (
                <div key={i} className="flex gap-4 items-start min-h-[48px]">
                  <span className="text-[10px] font-mono text-ivory/30 w-16 text-right pt-1">{slot.hr}</span>
                  <div className="flex-1 border-l border-white/[0.06] pl-4 pb-2">
                    {slot.event ? (
                      <div
                        onClick={() => setSelectedEventId(slot.event!.id)}
                        className={clsx(
                          "p-3 rounded-lg border text-left cursor-pointer transition-all",
                          slot.event.id === selectedEventId 
                            ? "bg-white/[0.04] border-gold/40 shadow-gold-glow-soft" 
                            : "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono font-bold text-gold/80 uppercase">{slot.event.category}</span>
                          <span className="text-[10px] font-mono text-emerald">{slot.event.status === "completed" && "Completed"}</span>
                        </div>
                        <p className="text-[12px] font-bold text-ivory mt-1">{slot.event.title}</p>
                      </div>
                    ) : (
                      <div className="py-2.5 text-[10px] font-mono text-ivory/20 italic">Available slot</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AGENDA VIEW: STRAIGHT CHRONOLOGICAL */}
          {viewMode === "agenda" && (
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEventId(evt.id)}
                  className={clsx(
                    "p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer text-left transition-all",
                    evt.id === selectedEventId ? "border-gold/50 bg-white/5" : "border-white/[0.04] bg-white/[0.005]"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-gold/70">{evt.date} · {evt.time}</p>
                    <p className="text-[13px] font-bold text-ivory truncate mt-0.5">{evt.title}</p>
                    <p className="text-[10.5px] text-ivory/45 truncate mt-0.5">{evt.relatedCustomer}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-mono font-bold text-gold">{evt.businessImpact}</p>
                    <span className="text-[9px] uppercase tracking-wide opacity-50 font-mono">{evt.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* COLUMN C: ACTIVE MEETING COGNITIVE INTELLIGENCE PANEL */}
      <div className="space-y-4">
        
        {/* PANEL CARD WRAPPER */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-4" id="intelligence-layer-panel">
          
          <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3">
            <Activity className="text-gold" size={14} />
            <p className="font-display text-[12px] font-bold text-ivory uppercase tracking-wider">
              Cognitive Intelligence Panel
            </p>
          </div>

          {/* MEETING CONTEXT */}
          <div className="space-y-3">
            <div>
              <span className="text-[9.5px] font-mono uppercase bg-gold/10 text-gold border border-gold/15 px-1.5 py-0.5 rounded tracking-wide">
                Meeting Context
              </span>
              <h2 className="mt-2 text-[16px] font-bold text-ivory leading-snug">{activeEvent.title}</h2>
              <p className="text-[11.5px] text-ivory/50 mt-1 font-mono">{activeEvent.time} · {activeEvent.date}</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg text-[11px]">
              <div>
                <p className="text-ivory/35 font-mono uppercase text-[9px]">Related Customer</p>
                <p className="font-bold text-ivory mt-0.5">{activeEvent.relatedCustomer}</p>
              </div>
              <div>
                <p className="text-ivory/35 font-mono uppercase text-[9px]">Business Unit</p>
                <p className="font-bold text-gold/90 mt-0.5">{activeEvent.relatedDepartment}</p>
              </div>
              <div>
                <p className="text-ivory/35 font-mono uppercase text-[9px]">Workflow Engine</p>
                <p className="font-bold text-ivory mt-0.5 truncate">{activeEvent.relatedWorkflow}</p>
              </div>
              <div>
                <p className="text-ivory/35 font-mono uppercase text-[9px]">Contract Code</p>
                <p className="font-bold text-ivory mt-0.5 font-mono">{activeEvent.relatedContract}</p>
              </div>
            </div>

            <div className="text-[11px] space-y-1.5">
              <p className="text-ivory/40 font-mono uppercase text-[9px]">Strategic Participants</p>
              <div className="flex flex-wrap gap-1">
                {activeEvent.participants.map((person, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full font-mono text-[10px] text-ivory/80">
                    {person}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* DECISION REQUIRED */}
          <div className="p-3.5 bg-red-500/[0.01] border border-red-500/10 rounded-xl space-y-1">
            <p className="text-red-400 font-mono uppercase font-bold text-[9px] tracking-wider flex items-center gap-1">
              <AlertTriangle size={10} />
              Decision Required
            </p>
            <p className="text-[11.5px] leading-relaxed text-ivory/90 font-mono">
              {activeEvent.decisionRequired}
            </p>
          </div>

          {/* BUSINESS IMPACT */}
          <div className="p-3.5 bg-gold/5 border border-gold/15 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-gold font-mono uppercase font-bold text-[9px] tracking-wider">
                Business Impact Cost
              </p>
              <p className="text-[11px] text-ivory/50 mt-0.5">Potential financial exposure vector</p>
            </div>
            <p className="text-[22px] font-mono font-bold text-gold">{activeEvent.businessImpact}</p>
          </div>

          {/* DEPENDENCY ROUTING PATH */}
          <div className="space-y-2">
            <p className="text-ivory/35 font-mono uppercase text-[9px]">Downstream Dependencies</p>
            <div className="flex flex-col gap-1">
              {activeEvent.dependencies.map((dep, i) => (
                <div key={i} className="flex items-center gap-2 text-[10.5px] font-mono text-ivory/70 bg-white/[0.01] p-1.5 rounded border border-white/[0.03]">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  <span>{dep}</span>
                  {i < activeEvent.dependencies.length - 1 && (
                    <ChevronRight size={10} className="text-gold/40 ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* AFTER-MEETING DECISION CAPTURE (Shown only for Completed events) */}
        {activeEvent.status === "completed" && activeEvent.decisionCapture && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-glass space-y-3"
          >
            <div className="flex items-center gap-1.5 border-b border-white/[0.05] pb-2 text-emerald-400">
              <CheckCircle2 size={13} />
              <p className="font-mono text-[11px] uppercase tracking-wider font-bold">Decision Capture</p>
            </div>

            <div className="space-y-2.5">
              <div>
                <p className="text-[9px] font-mono uppercase text-ivory/40">Decisions Finalized</p>
                <div className="space-y-1 mt-1">
                  {activeEvent.decisionCapture.decisionsMade.map((dec, i) => (
                    <div key={i} className="text-[11px] font-mono text-ivory/80 flex items-start gap-1.5">
                      <span className="text-emerald font-bold shrink-0">✓</span>
                      <span>{dec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-mono uppercase text-ivory/40">Action Items & Owners</p>
                <div className="space-y-1.5 mt-1">
                  {activeEvent.decisionCapture.actionItems.map((act, i) => (
                    <div key={i} className="text-[11px] font-mono bg-white/[0.01] p-1.5 rounded border border-white/[0.04] flex justify-between gap-2">
                      <span className="text-ivory/85 truncate">{act.task}</span>
                      <span className="text-gold shrink-0 font-bold">@{act.owner}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-ivory/50 border-t border-white/[0.05] pt-2">
                <div>
                  <p className="text-[8px] uppercase">Workflows Auto-Triggered</p>
                  <p className="text-ivory/80 font-bold mt-0.5">{activeEvent.decisionCapture.relatedWorkflows.join(", ")}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase">Follow-up Session</p>
                  <p className="text-gold font-bold mt-0.5">{activeEvent.decisionCapture.followUpDate}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* PRE-MEETING EXECUTIVE BRIEF SECTION */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-3">
          
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
            <div className="flex items-center gap-1.5">
              <FileText className="text-gold" size={13} />
              <p className="font-display text-[12px] font-bold text-ivory uppercase tracking-wider">
                Executive Briefing Dossier
              </p>
            </div>
            <span className="text-[9px] font-mono uppercase bg-emerald-500/15 text-emerald border border-emerald-500/20 px-1.5 py-0.1 rounded">
              Brief Ready
            </span>
          </div>

          <p className="text-[11px] text-ivory/40 font-mono">
            Compiling background analytics for {activeEvent.relatedCustomer || "this session"}.
          </p>

          <div className="space-y-3 text-[11px] font-mono pt-1">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded">
                <p className="text-ivory/30 text-[8.5px] uppercase">Contract Value</p>
                <p className="text-ivory/95 font-bold mt-0.5">{activeEvent.executiveBrief.currentContractValue}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded">
                <p className="text-ivory/30 text-[8.5px] uppercase">Renewal Probability</p>
                <p className="text-gold font-bold mt-0.5">{activeEvent.executiveBrief.renewalProbability}</p>
              </div>
            </div>

            <div className="space-y-2 bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
              <div>
                <p className="text-ivory/30 text-[8.5px] uppercase">Revenue History</p>
                <p className="text-ivory/85 text-[10.5px] mt-0.5">{activeEvent.executiveBrief.revenueHistory}</p>
              </div>
              <div>
                <p className="text-ivory/30 text-[8.5px] uppercase">Last Interaction</p>
                <p className="text-ivory/85 text-[10.5px] mt-0.5">{activeEvent.executiveBrief.lastInteraction}</p>
              </div>
              <div>
                <p className="text-ivory/30 text-[8.5px] uppercase">Open Support Issues</p>
                <p className="text-ivory/85 text-[10.5px] mt-0.5 font-bold">{activeEvent.executiveBrief.openSupportIssues} Tickets active</p>
              </div>
              <div>
                <p className="text-ivory/30 text-[8.5px] uppercase">Outstanding Risks</p>
                <p className="text-red-400 text-[10.5px] mt-0.5 leading-normal">{activeEvent.executiveBrief.outstandingRisks}</p>
              </div>
              <div>
                <p className="text-ivory/30 text-[8.5px] uppercase">Expansion Opportunity</p>
                <p className="text-emerald-400 text-[10.5px] mt-0.5 leading-normal">{activeEvent.executiveBrief.expansionOpportunity}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-ivory/30 text-[8.5px] uppercase">Recommended Discussion Points</p>
              <div className="space-y-1">
                {activeEvent.executiveBrief.recommendedDiscussionPoints.map((pt, i) => (
                  <div key={i} className="bg-white/[0.01] p-2 rounded border border-white/[0.03] text-ivory/80 leading-relaxed text-[10.5px]">
                    • {pt}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-ivory/30 text-[8.5px] uppercase">Relevant Documents ({activeEvent.relevantDocuments.length})</p>
              <div className="space-y-1">
                {activeEvent.relevantDocuments.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 bg-white/[0.01] border border-white/[0.04] rounded hover:bg-white/[0.03] text-gold/80 text-[10.5px] truncate">
                    <FileText size={11} />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
