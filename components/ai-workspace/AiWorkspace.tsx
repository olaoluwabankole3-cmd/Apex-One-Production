"use client";

import { useState, useRef, useEffect, KeyboardEvent, useMemo } from "react";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";
import { useOrganization } from "@/components/layout/OrganizationContext";

import { isDemoMode } from "@/lib/demo";
import { 
  Database, 
  Radio, 
  Sparkles, 
  Clock, 
  Shield, 
  Workflow, 
  TrendingUp, 
  Coins, 
  Users, 
  FileText, 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Briefcase, 
  History, 
  Sliders, 
  Layers, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  ArrowUp,
  Search,
  MessageSquare,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/ui/GlassCard";

interface ConfidenceType {
  score: number;
  sources: number;
  consistency: string;
}

interface IntelligenceMessage {
  id: string;
  role: "user" | "assistant" | "system";
  timestamp: string;
  mode?: string;
  year?: string;
  confidence?: ConfidenceType;
  contextUsed?: string;
  finding?: string;
  evidence?: string[];
  financialImpact?: string;
  recommendations?: string[];
  sources?: string[];
  trace?: string[];
  text?: string;
}

const AI_MODES = [
  { id: "Executive", label: "Executive Mode", desc: "Strategic impact, high-level leakage, performance outliers.", icon: Briefcase },
  { id: "Sales", label: "Sales & CRM", desc: "Pipeline, accounts, opportunities, and enterprise ARR expansion.", icon: Users },
  { id: "Operations", label: "Operations", desc: "Bottlenecks, processing SLA, capacity, and system reconciliations.", icon: Workflow },
  { id: "Finance", label: "Finance & Value", desc: "Revenue leaks, billing, cash flow, margins, and financial exposure.", icon: Coins },
  { id: "Customer Intelligence", label: "Client Sentiment", desc: "Engagement trends, churn risk signals, relationship history.", icon: MessageSquare },
  { id: "Risk", label: "Risk Mitigation", desc: "Portfolio concentration, credit vulnerability, and revenue threats.", icon: AlertTriangle },
  { id: "Compliance", label: "Compliance & Legal", desc: "Regulatory posture, flagged events, audit trails, policy changes.", icon: Shield },
  { id: "Strategy", label: "Strategy Engine", desc: "Multi-year forecasting, market positioning, capital efficiency.", icon: TrendingUp }
];

const MEMORY_CATEGORIES = [
  { id: "Customers", label: "Customers", count: "8,420 profiles", icon: Users, desc: "Depositors, loans, capital assets & policies" },
  { id: "Transactions", label: "Transactions", count: "1.8M entries", icon: Coins, desc: "Banking, trade settlements & billing records" },
  { id: "Documents", label: "Documents", count: "42,681 files", icon: FileText, desc: "Board minutes, credit agreements & contracts" },
  { id: "Contracts", label: "Contracts", count: "6,284 agreements", icon: Shield, desc: "Active / historical vendor & client treaties" },
  { id: "Interactions", label: "Interactions", count: "928K records", icon: MessageSquare, desc: "Support histories, emails & relationship logs" },
  { id: "Operations", label: "Operations", count: "214K events", icon: Activity, desc: "Workflow cycles, database latencies & bottlenecks" },
  { id: "Decisions", label: "Decisions", count: "12,481 items", icon: Brain, desc: "Board rulings, credit committee approvals" },
  { id: "Knowledge", label: "Knowledge Index", count: "18,392 topics", icon: Sliders, desc: "Standard operating guides, policies & compliance manuals" }
];

const HISTORICAL_TIMELINE = [
  { year: "2019", label: "Enterprise Founded", desc: "Core infrastructure set up for Apex Sync" },
  { year: "2020", label: "Regional Expansion", desc: "Launched secondary banking products across regions" },
  { year: "2021", label: "Subsidiary Launch", desc: "Consolidated Commercial and Customer Operations" },
  { year: "2022", label: "Portfolio Scaling", desc: "Major client portfolio expansion, hitting 1M transactions" },
  { year: "2023", label: "Restructuring Phase", desc: "Internal systems modernization, core banking upgrade" },
  { year: "2024", label: "Strategic Accounts division", desc: "Launched wealth & investment management division" },
  { year: "2025", label: "Workflow Automation", desc: "Automated claims settlement implemented in insurance" },
  { year: "2026", label: "Current State", desc: "Operational memory completely active & optimized" }
];

const HISTORICAL_QUESTIONS = [
  { q: "Why did enterprise revenue slow down in Q2?", icon: TrendingUp },
  { q: "How did our top 20 customers perform over the last five years?", icon: Users },
  { q: "Which customers have gradually reduced spending?", icon: Coins },
  { q: "Why did revenue increase in 2024?", icon: History },
  { q: "Which contracts generated the highest lifetime value?", icon: Shield },
  { q: "Which operational problems repeatedly occurred?", icon: Activity },
  { q: "Which decisions from last year produced the strongest results?", icon: Brain },
  { q: "Compare this quarter with the same period three years ago?", icon: Sliders }
];

const PROACTIVE_NOTICES = [
  {
    id: "notice-1",
    type: "revenue",
    title: "Revenue Anomaly Detected",
    summary: "Enterprise revenue is 11.8% below expected trajectory.",
    whyItMatters: "Unmitigated deviations risk multi-quarter budget deficits and client friction.",
    evidence: "Enterprise Operations wire revenues contract by ₦12.5M, tracking beneath 5-year seasonal averages.",
    impact: "Estimated exposure: ₦18.4M by next fiscal close.",
    action: "Run intelligent transaction routing audit on international clearing accounts."
  },
  {
    id: "notice-2",
    type: "behavior",
    title: "Customer Behavior Change",
    summary: "14 strategic accounts have reduced activity significantly.",
    whyItMatters: "Activity drops are historically high-correlating churn indicators within 90 days.",
    evidence: "Average transaction velocity across flagged accounts dropped by 34.2% since June.",
    impact: "Active revenue at risk: ₦42.5M ARR across logistics and finance clients.",
    action: "Initiate direct client touchpoints for Acme Corp and Vertex Holdings."
  },
  {
    id: "notice-3",
    type: "bottleneck",
    title: "Operational Bottleneck",
    summary: "Claims processing is creating an estimated ₦4.2M monthly opportunity cost.",
    whyItMatters: "Lengthy processing durations degrade trust and escalate customer support volume.",
    evidence: "Average claims queue time increased to 6.8 days from the standard 2.0-day benchmark.",
    impact: "Excess support overheads & claim interest penalties: ₦4.2M monthly.",
    action: "Trigger automatic re-indexing and load balancing on database claims table."
  },
  {
    id: "notice-4",
    type: "exposure",
    title: "Contract Exposure Flagged",
    summary: "8 high-value contracts enter renewal windows within 60 days.",
    whyItMatters: "Delayed contract reviews represent severe pricing slippage and loss risk.",
    evidence: "Brightwell Regional Bank SLA and Meridian Logistics master agreement are among the 8.",
    impact: "Consolidated contract value in review: ₦114.6M.",
    action: "Schedule automated proposal generation with updated pricing schedules."
  }
];

export default function AiWorkspace() {
  const { role } = useRole();
  const { organization } = useOrganization();

  const isDemo = isDemoMode();

  const timeline = useMemo(() => {
    if (!isDemo) {
      return [
        { year: "2026", label: "Live Session", desc: "Awaiting historical telemetry connection" }
      ];
    }
    return HISTORICAL_TIMELINE.map((item) => {
      if (item.year === "2019") {
        return { ...item, desc: `Core infrastructure set up for ${organization.displayName}` };
      }
      return item;
    });
  }, [isDemo, organization.displayName]);

  const memoryCategories = useMemo(() => {
    if (!isDemo) {
      return MEMORY_CATEGORIES.map(cat => ({
        ...cat,
        count: "0 records",
        desc: "No data sources connected"
      }));
    }
    return MEMORY_CATEGORIES;
  }, [isDemo]);

  const [activeYear, setActiveYear] = useState("2026");
  const [activeMode, setActiveMode] = useState("Executive");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<Record<string, boolean>>({});
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  // Pre-seed some messages
  const [messages, setMessages] = useState<IntelligenceMessage[]>([]);

  useEffect(() => {
    if (!isDemoMode()) {
      setMessages([
        {
          id: "init-msg-offline",
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: "Executive",
          year: "2026",
          confidence: { score: 0, sources: 0, consistency: "Offline" },
          contextUsed: "Standby (No Data Sources Connected)",
          finding: "Operational memory is in Standby. Connect enterprise databases in Settings, or enable Demo Mode to explore simulated historical ledgers.",
          evidence: [],
          recommendations: []
        }
      ]);
    } else {
      setMessages([
        {
          id: "init-msg",
          role: "assistant",
          timestamp: "13:18",
          mode: "Executive",
          year: "2026",
          confidence: { score: 98, sources: 24, consistency: "Optimal" },
          contextUsed: "2019–2026 (7 Years Consolidated Memory)",
          finding: "Apex Sync Intelligence initialized. The complete operational memory of Apex Sync is synchronized. Current reasoning is optimized for the Chief of Staff and strategic executive focus.",
          evidence: [
            "7 fiscal years of general ledgers completely indexed",
            "18 corporate application systems synced (CRM, ERP, Contracts, Support logs, Core Banking)",
            "42,681 internal document files, board resolutions, and SLAs analyzed",
            "8,420 customer nodes and 1.8M discrete ledger entries synchronized"
          ],
          financialImpact: "Full alignment across business units (Enterprise Operations, Commercial Operations, Strategic Accounts, Customer Operations) is active. Ready for analytical inquiry.",
          recommendations: [
            "Select a temporal anchor from the Timeline above to query past years.",
            "Toggle specific Intelligence Modes to focus neural synthesis on Finance, Sales, or Operations.",
            "Click on any 'What APEX ONE Noticed' items in the sidebar to review proactive opportunities."
          ],
          sources: ["CRM", "ERP", "Contracts", "Support", "Finance", "Operations"],
          trace: ["Database Connection", "Neural Index Retrieval", "Temporal Alignments", "Cross-System Synthesis", "Aligning Role Context"]
        }
      ]);
    }
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const handleSend = (textToSend?: string) => {
    const finalVal = textToSend || input;
    const trimmed = finalVal.trim();
    if (!trimmed || thinking) return;

    if (!textToSend) {
      setInput("");
    }

    // Add user message
    const userMsgId = `user-${Date.now()}`;
    const userMsg: IntelligenceMessage = {
      id: userMsgId,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: trimmed
    };

    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    if (!isDemoMode()) {
      setTimeout(() => {
        const response: IntelligenceMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: activeMode,
          year: activeYear,
          confidence: { score: 0, sources: 0, consistency: "N/A" },
          contextUsed: "No active database indexed",
          finding: "AI Workspace Offline. Please enable Demo Mode in Settings to query fictional demonstration ledgers, or establish a live database connector.",
          evidence: [
            "0 applications connected",
            "No active transactional data in production index",
          ],
          recommendations: [
            "Enable Demo Mode in Settings to test features.",
          ],
          sources: [],
          trace: []
        };
        setMessages(prev => [...prev, response]);
        setThinking(false);
      }, 1000);
      return;
    }

    // Simulate thinking process
    setTimeout(() => {
      let response: IntelligenceMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: activeMode,
        year: activeYear,
        confidence: { score: 94, sources: 18, consistency: "High" },
        contextUsed: `${activeYear} locked (2019-${activeYear} historical records)`
      };

      // Match queries
      const lowerQuery = trimmed.toLowerCase();
      if (lowerQuery.includes("slow down in q2") || lowerQuery.includes("revenue slow")) {
        response = {
          ...response,
          confidence: { score: 95, sources: 12, consistency: "High" },
          contextUsed: `${activeYear} locked context (Fiscal Timeline)`,
          finding: `Enterprise revenue growth slowed by 8.4% in Q2 ${activeYear === "2026" ? "this year" : "of " + activeYear}, primarily driven by a decline in customer expansion revenue across 17 high-yield accounts in our logistics and banking verticals.`,
          evidence: [
            "17 core enterprise accounts dropped below their historical annual expansion projections",
            "4 high-value customer contracts approaching renewal showed zero expansion upsells",
            "3 accounts with declining overall transactional frequency and core API usage",
            "2 accounts flagged with unresolved service level SLA violations (ticket resolution delays)"
          ],
          financialImpact: "Estimated revenue exposure: ₦18.4M annualized contraction if expansion programs remain stale.",
          recommendations: [
            "Initiate high-touch account audits immediately for Meridian Logistics, Acme Corporation, and Brightwell Regional Bank.",
            "Verify pricing flexibility guidelines and adjust auto-renewal multipliers for the 4 expiring treaties.",
            "Schedule automated SLA remedy check for logistics clients experiencing ticketing friction."
          ],
          sources: ["CRM", "ERP", "Contracts", "Support", "Finance", "Operations"],
          trace: ["Retrieving billing general ledgers", "Aligning customer relationship database (CRM)", "Scanning support logs for SLA delays", "Mapping historical expansion averages", "Generating consolidated audit report"]
        };
      } else if (lowerQuery.includes("top 20 customers") || lowerQuery.includes("top 20")) {
        response = {
          ...response,
          confidence: { score: 97, sources: 14, consistency: "Optimal" },
          finding: `The top 20 enterprise portfolios contributed ₦412M in gross lifetime value from 2019 to ${activeYear}. Retention within this group stands at an optimal 96.2%, but 62% of this revenue remains heavily concentrated within the top 5 strategic nodes.`,
          evidence: [
            "Meridian Logistics expanded by +42% since 2021, anchoring the entire transportation tier",
            "Zenith Retail represents our fastest scaling client, contributing ₦34M ARR as of late",
            "Portfolio concentration metrics reveal high vulnerability to individual account migrations"
          ],
          financialImpact: "Consolidated revenue exposure: ₦120M annual recurring revenue vulnerable to individual customer departures.",
          recommendations: [
            "Implement a formal Executive Sponsor program assigning C-suite members to the top 5 accounts.",
            "Review customized service SLA criteria on the Vertex Holdings contract before the Q4 renewal window.",
            "Establish multi-product loyalty discounts to cross-sell Customer Operations packages into corporate client nodes."
          ],
          sources: ["CRM", "ERP", "Contracts", "Finance"],
          trace: ["Aggregating customer accounts by ARR", "Cross-referencing historical billing tables", "Synthesizing contracts and renewal metadata", "Calculating group concentration coefficients"]
        };
      } else if (lowerQuery.includes("reduced spending") || lowerQuery.includes("spending")) {
        response = {
          ...response,
          confidence: { score: 93, sources: 10, consistency: "High" },
          finding: `A 36-month retrospective analysis flags 14 strategic customer accounts exhibiting a progressive, multi-quarter contraction in trade settlements and transaction velocity. Brightwell Regional Bank shows the steepest decline.`,
          evidence: [
            "Brightwell Regional Bank average monthly wire volume dropped from ₦45M to ₦36.9M (-18%) over 3 quarters",
            "Zenith Retail transaction velocity has contracted steadily due to manual clearance bottlenecks in their system",
            "SLA complaints and unresolved support escalations rose 34% among these 14 flagged nodes"
          ],
          financialImpact: "Estimated annualized contraction leakage: ₦24.5M across the group if current friction is left unaddressed.",
          recommendations: [
            "Schedule an urgent partnership review with the relationship manager assigned to Brightwell Regional Bank.",
            "Deploy automatic database optimization tips to Zenith Retail to ease their manual clearance overhead.",
            "Create a specialized 'Risk Response Unit' to resolve pending SLA compliance tickets for these accounts."
          ],
          sources: ["CRM", "Support", "Finance"],
          trace: ["Querying client transaction ledgers", "Correlating customer support ticket velocity", "Mapping multi-quarter spending trends", "Determining leakage probability scores"]
        };
      } else if (lowerQuery.includes("increase in 2024") || lowerQuery.includes("2024")) {
        response = {
          ...response,
          confidence: { score: 98, sources: 16, consistency: "Absolute" },
          finding: "Revenue experienced a substantial increase of ₦184M (+22.4% YoY) in FY 2024. This growth was primary propelled by the successful launch of the specialized Strategic Accounts division and major expansion campaigns in the logistics vertical.",
          evidence: [
            "Strategic Accounts division generated ₦74.2M in net new wealth advisory fees within 3 quarters of launch",
            "Logistics sector clients expanded their transaction volumes by an average of 28.1%",
            "84% of existing high-net-worth bank depositors added at least one cross-subsidiary service contract"
          ],
          financialImpact: "Operational margin improvements yielded a net profitability increase of ₦42.1M.",
          recommendations: [
            "Replicate the 2024 logistics sector expansion playbook across our retail and trading client segments.",
            "Further expand the Strategic Accounts allocation framework into specialized trust offerings.",
            "Lock in core 2024 expansion clients into long-term 3-year recurring service agreements."
          ],
          sources: ["ERP", "Finance", "Operations", "Documents"],
          trace: ["Retrieving FY2024 general ledger logs", "Extracting divisional performance breakdowns", "Analyzing customer contract expansion files", "Compiling comparative margin indicators"]
        };
      } else if (lowerQuery.includes("contracts generated") || lowerQuery.includes("highest lifetime")) {
        response = {
          ...response,
          confidence: { score: 96, sources: 8, consistency: "High" },
          finding: "The highest lifetime value agreements are centered in the transport logistics and state-government clearing contracts. Meridian Logistics represents the single highest yielding master treaty under management.",
          evidence: [
            "Meridian Logistics master service agreement generated a cumulative ₦280M in clearing and custody fees since 2020",
            "Customer Operations state-pension treaty stands as the second largest, yielding ₦185M in pooled premiums",
            "The top 8 enterprise contracts represent 45.4% of total group service revenues"
          ],
          financialImpact: "Annualized contract base value: ₦465M. Securing renewals is our highest core priority.",
          recommendations: [
            "Formulate tailored pricing models for Meridian Logistics to secure a 5-year extension before Q4.",
            "Deploy dedicated compliance officers to monitor state-pension SLA standards continuously.",
            "Cross-sell corporate treasury accounts to Zenith Retail to establish secondary contract anchors."
          ],
          sources: ["Contracts", "Finance", "Documents"],
          trace: ["Filtering active contract archives", "Matching billing histories to specific treaty IDs", "Calculating cumulative lifetime fee schedules", "Compiling cohort risk metrics"]
        };
      } else if (lowerQuery.includes("operational problems") || lowerQuery.includes("repeatedly")) {
        response = {
          ...response,
          confidence: { score: 94, sources: 12, consistency: "Optimal" },
          finding: "A multi-year operational audit identifies manual reconciliation loops in Customer Operations and database index lockups as our primary, high-frequency systemic bottlenecks.",
          evidence: [
            "Claims processing manual verifications failed to meet SLA parameters 18% of the time",
            "API clearing gateway experienced periodic timeouts during peak trade settlement hours in Q4",
            "Unresolved support tickets escalated to level 3 support averaged 5.4 days to clear due to missing doc linkages"
          ],
          financialImpact: "Direct administrative cost leakage: estimated at ₦11.2M annually in support overheads and delay penalties.",
          recommendations: [
            "Expedite the deployment of the automated claims settlement AI workflow across all insurance lines.",
            "Configure database query caching and transaction routing rules to mitigate peak-hour timeouts.",
            "Deploy automated OCR parsing to automatically index incoming customer documents upon submission."
          ],
          sources: ["Operations", "Support", "ERP"],
          trace: ["Analyzing system performance files", "Filtering customer support ticket descriptions", "Measuring SLA queue turnaround averages", "Identifying manual validation bottlenecks"]
        };
      } else if (lowerQuery.includes("decisions from last year") || lowerQuery.includes("decisions")) {
        response = {
          ...response,
          confidence: { score: 95, sources: 18, consistency: "High" },
          finding: "Our retroactive indexing of 12,481 institutional decisions isolates the Q1 2025 board directive to automate claim validation workflows inside Customer Operations as the single highest-performing action.",
          evidence: [
            "Average claim resolution cycle contracted from 6.2 days to 1.8 days post-implementation",
            "Operational processing overheads on automated lines dropped by 38.2%",
            "Direct customer NPS scores rose from a neutral 3.4 to a premium 4.6 within the division"
          ],
          financialImpact: "Direct operational expense reduction: ₦32.0M realized savings annualized.",
          recommendations: [
            "Replicate the automated claims workflow engine to handle Enterprise Operations' commercial credit assessments.",
            "Publish this implementation framework as our internal benchmark for cross-subsidiary efficiency.",
            "Evaluate secondary operations suitable for AI-driven semantic parsing and ingestion."
          ],
          sources: ["Documents", "Operations", "Finance"],
          trace: ["Indexing corporate board directive minutes", "Measuring divisional efficiency changes", "Calculating ROI and operational cost improvements", "Verifying customer sentiment changes"]
        };
      } else if (lowerQuery.includes("compare this quarter") || lowerQuery.includes("compare")) {
        response = {
          ...response,
          confidence: { score: 96, sources: 15, consistency: "High" },
          finding: `Consolidated gross yields are up 42.4% compared to the identical quarter three years ago. However, operational efficiency margins have contracted by 3.1% due to increased infrastructure loads and manual reconciliation dependencies.`,
          evidence: [
            "Quarterly gross revenue reached ₦284M compared to ₦199M three years prior",
            "Total operational transactions handled expanded by 180% to 214K, indicating massive scaling success",
            "Infrastructure and manual overhead costs grew by 24% to sustain the throughput"
          ],
          financialImpact: "Scale advantage: +₦85M revenue growth, partially offset by ₦8.2M in recurring server and system overheads.",
          recommendations: [
            "Accelerate system consolidation to streamline database cross-queries and reduce server charges.",
            "Re-negotiate high-volume API contracts with cloud providers to leverage our increased scale.",
            "Introduce volume-based pricing adjustments for low-margin accounts to absorb overhead weights."
          ],
          sources: ["ERP", "Finance", "Operations"],
          trace: ["Extracting current quarter general ledger", "Aligning historical Q3 ledgers from 3 years ago", "Evaluating volume-to-overhead multipliers", "Synthesizing consolidated performance indices"]
        };
      } else {
        // Fallback custom response that incorporates role, year, mode
        response = {
          ...response,
          confidence: { score: 91, sources: 8, consistency: "Medium" },
          finding: `Apex One Intelligence synthesized Apex Sync's operational database matching the temporal anchor (${activeYear}) under ${activeMode} Mode rules.`,
          evidence: [
            `Query: "${trimmed}" resolved within our ${activeYear} data silos.`,
            `Active context covers 7 years of institutional records up to the year ${activeYear}.`,
            `Role authorization '${role}' applied, limiting synthesis to verified, non-speculative data nodes.`
          ],
          financialImpact: "Aligned to standard group financial baselines. No anomalous leakages detected for this isolated query.",
          recommendations: [
            "For deep quantitative insights, try asking one of the suggested historical questions in the sidebar.",
            "Ensure the appropriate AI Mode is active to focus the reasoning on the correct department records.",
            "Refine your query to target specific accounts like Acme Corporation, Meridian Logistics, or Zenith Retail."
          ],
          sources: ["CRM", "ERP", "Finance", "Operations"],
          trace: ["Parsing user text constraints", "Scanning active database index structures", "Validating compliance role clearances", "Formulating tailored executive response"]
        };
      }

      setMessages(prev => [...prev, response]);
      setThinking(false);
    }, 1500);
  };

  const selectYear = (year: string) => {
    setActiveYear(year);
    // Print custom system notification to the chat indicating temporal shift
    const sysMsg: IntelligenceMessage = {
      id: `sys-${Date.now()}`,
      role: "system",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `⚡ Temporal Anchor Shifted to ${year}. Synced 18 connected applications. Loading ${year === "2026" ? "current operating ledgers" : `FY${year} archived ledgers, executive directives, and transactional registries`} for ${organization.name}... Active.`
    };
    setMessages(prev => [...prev, sysMsg]);
  };

  const selectMode = (modeId: string) => {
    setActiveMode(modeId);
    const modeObj = AI_MODES.find(m => m.id === modeId);
    const sysMsg: IntelligenceMessage = {
      id: `sys-mode-${Date.now()}`,
      role: "system",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `⚙️ Intelligence Engine tuned to [${modeObj?.label}]. Re-prioritizing reasoning rules to focus on: ${modeObj?.desc}`
    };
    setMessages(prev => [...prev, sysMsg]);
  };

  const handleCategoryClick = (category: string) => {
    const catObj = MEMORY_CATEGORIES.find(c => c.id === category);

    if (!isDemoMode()) {
      const sysMsg: IntelligenceMessage = {
        id: `sys-cat-${Date.now()}`,
        role: "system",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `🔍 Checking ${catObj?.label || category} Index • Telemetry Standby (0 data sources connected)`
      };
      setMessages(prev => [...prev, sysMsg]);

      setThinking(true);
      setTimeout(() => {
        const content: IntelligenceMessage = {
          id: `ai-cat-${Date.now()}`,
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mode: activeMode,
          year: activeYear,
          confidence: { score: 0, sources: 0, consistency: "Offline" },
          contextUsed: `Memory Index: ${category} (0 Records)`,
          finding: `No active data source connectors for ${catObj?.label || category}. Operational records are currently unmapped in this environment.`,
          evidence: [
            "0 data sources connected in Settings",
            "Production schema waiting for database integration"
          ],
          recommendations: [
            "Enable Demo Mode in Settings to query synthetic demonstration datasets.",
            "Connect live enterprise databases to index real organizational records."
          ]
        };
        setMessages(prev => [...prev, content]);
        setThinking(false);
      }, 700);
      return;
    }

    // Simulated category deep-dive response in demo mode
    const sysMsg: IntelligenceMessage = {
      id: `sys-cat-${Date.now()}`,
      role: "system",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `🔍 Auditing ${catObj?.label} Database • Connected across 4 subsidiaries. Running deep semantic verification...`
    };
    setMessages(prev => [...prev, sysMsg]);

    setThinking(true);
    setTimeout(() => {
      let content: IntelligenceMessage = {
        id: `ai-cat-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: activeMode,
        year: activeYear,
        confidence: { score: 99, sources: 12, consistency: "Optimal" },
        contextUsed: `Organizational Memory: ${category} Index`
      };

      if (category === "Customers") {
        content = {
          ...content,
          finding: "Unified Customer Registry maps 8,420 high-value client portfolios across Enterprise Operations, Commercial Operations, Strategic Accounts, and Customer Operations.",
          evidence: [
            "4,120 active savings and corporate depositors in banking archives",
            "2,180 commercial credit accounts managed under Commercial Operations",
            "940 capital advisory assets managed under Strategic Accounts",
            "1,180 commercial risk and insurance accounts under management"
          ],
          financialImpact: "Consolidated group customer lifetime value (LTV): ₦1.42B. Customer acquisition cost (CAC) amortized at 4.2% group-wide.",
          recommendations: [
            "Prioritize cross-selling high-margin wealth advisory packages to high-net-worth Insurance account holders.",
            "Deploy auto-risk triggers for accounts showing trade settlement contractions greater than 15%."
          ],
          sources: ["CRM", "ERP", "Finance"],
          trace: ["Ingesting client master records", "Deduplicating cross-subsidiary portfolios", "Calculating cumulative group LTV", "Validating CRM interaction trails"]
        };
      } else if (category === "Transactions") {
        content = {
          ...content,
          finding: "1.8M transaction entries compiled from real-time core banking general ledgers, premium payments, and portfolio clearances.",
          evidence: [
            "Average trade transaction velocity: 14.2 successful operations per second",
            "Historical transaction settlement reconciliation failure rate: <0.002% (Optimal)",
            "Apex Value Engine actively scanning transaction registries for manual correction gaps"
          ],
          financialImpact: "Total consolidated transaction volume analyzed: ₦24.8B since 2019.",
          recommendations: [
            "Optimize clearing pipeline latency on high-value corporate transfers to reduce intra-day exposure risk.",
            "Transition lower-tier manual verifications to automated workflow gateways."
          ],
          sources: ["ERP", "Finance", "Operations"],
          trace: ["Reading core transaction ledger tables", "Filtering outliers and reconciliation states", "Synthesizing cross-border clearing records"]
        };
      } else if (category === "Documents") {
        content = {
          ...content,
          finding: "42,681 indexed documents containing corporate board resolutions, executive briefings, credit memos, and regulatory filings.",
          evidence: [
            "14,200 PDF credit agreements and commercial mortgages indexed",
            "8,240 executive briefings and meeting records mapped into the neural space",
            "20,241 operating files, compliance logs, and external audit briefs active"
          ],
          financialImpact: "Semantic index vector space fully mapped. Critical terms extraction operating with 99.4% accuracy.",
          recommendations: [
            "Automate review of historic Q3 2025 credit committee minutes to extract binding risk guidelines.",
            "Run automated compliance scanning on incoming loan contract files to verify policy matches."
          ],
          sources: ["Documents"],
          trace: ["Reading un-structured text indexes", "Performing semantic entity alignment", "Compiling vector embeddings"]
        };
      } else if (category === "Contracts") {
        content = {
          ...content,
          finding: "6,284 active and historical master service contracts, vendor agreements, and client SLAs compiled and monitored.",
          evidence: [
            "4,120 client master service agreements (MSAs) mapped across transport, retail, and finance tiers",
            "1,244 inter-subsidiary clearing agreements verified",
            "920 third-party vendor treaties active with automated SLA compliance tracking"
          ],
          financialImpact: "Total consolidated recurring contract value under management: ₦465M ARR.",
          recommendations: [
            "Address upcoming Meridian Logistics contract renewal (₦82M ARR) expiring within 45 days.",
            "Flag contracts with flat pricing multipliers for automated inflationary adjustment adjustments."
          ],
          sources: ["Contracts", "Finance", "Documents"],
          trace: ["Extracting active contract expiration calendars", "Aligning contract rates with ledger invoices", "Compiling client SLA performance profiles"]
        };
      } else if (category === "Interactions") {
        content = {
          ...content,
          finding: "928K records of client communications, support logs, email chains, and relationship manager notes.",
          evidence: [
            "612K client-facing chat and support tickets indexed and analyzed",
            "218K relationship manager notes extracted from the centralized CRM",
            "98K executive letters, partnership proposals, and email correspondences synced"
          ],
          financialImpact: "Consolidated client sentiment score: 84% positive/neutral. Support backlog decreased by 18% YoY.",
          recommendations: [
            "Proactively dispatch RM agents to high-value client nodes presenting over 2 open support tickets.",
            "Optimize support queue auto-responses with historical resolution matches."
          ],
          sources: ["CRM", "Support"],
          trace: ["Correlating customer helpdesk tickets", "Extracting sentiment indexes via NLP", "Mapping relationship notes to timeline"]
        };
      } else if (category === "Operations") {
        content = {
          ...content,
          finding: "214K operational events mapped, tracking workflow cycles, database execution logs, and manual clearances.",
          evidence: [
            "Average insurance claim processing queue: 1.8 days (using the automated 2025 workflow)",
            "Database query latencies stabilized at an optimal 12ms group-wide",
            "Automated processing success rate verified at 94.1%"
          ],
          financialImpact: "Operational bottleneck mitigation has reclaimed an estimated ₦14.2M in monthly administrative overhead.",
          recommendations: [
            "Migrate the automated insurance claims parser to power the Commercial Operations credit validation pipeline.",
            "Establish real-time latency alarms for peak-hour clearance cycles."
          ],
          sources: ["Operations", "Support", "ERP"],
          trace: ["Reading application workflow execution timelines", "Filtering system failure rates", "Aligning database queries with transactional volumes"]
        };
      } else if (category === "Decisions") {
        content = {
          ...content,
          finding: "12,481 indexed corporate decisions, investment authorizations, credit board rulings, and strategic directives.",
          evidence: [
            "4,120 investment and capital allocation committee rulings logged",
            "3,180 commercial credit approvals from 2019 to present compiled",
            "5,181 operational adjustments and workflow reorganizations tracked"
          ],
          financialImpact: "Enables multi-year retroactive decision correlation to prove strategy-to-yield performance.",
          recommendations: [
            "Audit performance metrics of the Q1 2025 automation directive to justify expanding capital allocation for IT in 2027.",
            "Compile historical credit committee approvals to calibrate automatic loan risk scorecards."
          ],
          sources: ["Documents", "Operations", "Finance"],
          trace: ["Filtering institutional action files", "Correlating historical decisions with subsequent revenue charts"]
        };
      } else if (category === "Knowledge") {
        content = {
          ...content,
          finding: "18,392 internal knowledge assets, training manuals, SOPs, regulatory rulebooks, and compliance directives.",
          evidence: [
            "12,180 standard operating procedures (SOPs) synced across all subsidiaries",
            "4,120 competitive market intelligence dossiers cataloged",
            "2,092 local and international regulatory compliance rulebooks indexed"
          ],
          financialImpact: "Establishes zero-error guidance layer for customer-facing teams and legal departments.",
          recommendations: [
            "Verify all outgoing commercial agreements automatically against updated Central Bank compliance manuals.",
            "Integrate knowledge base references directly into customer service support macros."
          ],
          sources: ["Documents"],
          trace: ["Ingesting training manuals", "Extracting compliance guidelines", "Mapping rules to operating workflows"]
        };
      }

      setMessages(prev => [...prev, content]);
      setThinking(false);
    }, 1200);
  };

  const toggleTrace = (msgId: string) => {
    setExpandedTrace(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleNoticeClick = (notice: typeof PROACTIVE_NOTICES[0]) => {
    setThinking(true);
    // Add user question
    const userMsg: IntelligenceMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `Analyze proactive notice: "${notice.title} — ${notice.summary}"`
    };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const response: IntelligenceMessage = {
        id: `ai-notice-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: "Executive",
        year: activeYear,
        confidence: { score: 96, sources: 14, consistency: "High" },
        contextUsed: "Proactive Scanning Engine",
        finding: `PROACTIVE AUDIT: ${notice.title}. This event is flagged beneath high-priority operational oversight.`,
        evidence: [
          `Reason for flag: ${notice.whyItMatters}`,
          `Direct evidence detected: ${notice.evidence}`
        ],
        financialImpact: `Estimated exposure: ${notice.impact}`,
        recommendations: [
          `Recommended remediation: ${notice.action}`,
          "Establish automated alarms in Commercial Operations ledger to monitor secondary volatility on these accounts.",
          "Dispatch client success agents to confirm satisfaction status on flagged portfolios."
        ],
        sources: ["CRM", "Finance", "ERP", "Operations"],
        trace: ["Proactive sensor trigger", "Retrieving historical trends", "Estimating exposure and opportunity bounds", "Compiling actionable mitigation playbook"]
      };
      setMessages(prev => [...prev, response]);
      setThinking(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6" id="ai-workspace-dashboard">
      
      {/* 1. REPLACE THE GENERIC CHATBOT HERO & HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col justify-between gap-4 md:flex-row md:items-end border-b border-white/[0.04] pb-6"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gold animate-pulse" />
            <p className="text-[12.5px] font-mono font-bold uppercase tracking-[0.15em] text-gold">
              AI EXECUTIVE INTELLIGENCE
            </p>
          </div>
          <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight text-ivory lg:text-[30px]">
            Institutional Memory Workspace
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ivory/50">
            {!isDemo
              ? "Operational memory is in standby. Connect live organization data connectors or enable Demo Mode in Settings to query operational memory."
              : "Connected to the organization's complete operational memory. Reasoning across multi-year subsidiary archives."}
          </p>
        </div>

        {/* Supporting info block */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/20 bg-charcoal/30 px-4 py-3">
          {!isDemo ? (
            <>
              <div className="flex items-center gap-1.5 border-r border-white/[0.08] pr-3 mr-1">
                <div className="h-1.5 w-1.5 rounded-full bg-ivory/30" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-ivory/40">Memory Standby</span>
              </div>
              <div className="grid grid-cols-3 gap-x-5 gap-y-1 text-[11px] font-mono text-ivory/40">
                <div>History: <span className="text-ivory/60 font-bold">0 Years</span></div>
                <div>Systems: <span className="text-ivory/60 font-bold">0</span></div>
                <div>Docs: <span className="text-ivory/60 font-bold">0</span></div>
                <div>Customers: <span className="text-ivory/60 font-bold">0</span></div>
                <div>Txn: <span className="text-ivory/60 font-bold">0</span></div>
                <div>Decisions: <span className="text-ivory/60 font-bold">0</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 border-r border-white/[0.08] pr-3 mr-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald">Memory Active</span>
              </div>
              <div className="grid grid-cols-3 gap-x-5 gap-y-1 text-[11px] font-mono text-ivory/60">
                <div>History: <span className="text-gold font-bold">7 Years</span></div>
                <div>Systems: <span className="text-gold font-bold">18</span></div>
                <div>Docs: <span className="text-gold font-bold">42,681</span></div>
                <div>Customers: <span className="text-gold font-bold">8,420</span></div>
                <div>Txn: <span className="text-gold font-bold">1.8M</span></div>
                <div>Decisions: <span className="text-gold font-bold">12,481</span></div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* 3. MEMORY TIMELINE SECTION */}
      <GlassCard delay={0.05} hover={false} className="p-4 border-gold/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-16 w-16 bg-gold/5 blur-xl rounded-full" />
        <div className="flex items-center gap-2 mb-3">
          <Clock size={13} className="text-gold" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-[0.15em] text-gold font-mono">
            ORGANIZATIONAL MEMORY TIMELINE
          </h3>
          <span className="text-[10px] text-ivory/40 font-mono italic">(Select a year to shift AI&apos;s temporal focus)</span>
        </div>
        
        <div className="relative flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-2 scrollbar-thin">
          {/* Timeline background bar */}
          <div className="absolute left-4 right-4 top-[28px] h-[1px] bg-white/[0.06]" />
          
          {timeline.map((item, idx) => {
            const isActive = activeYear === item.year;
            return (
              <button
                key={item.year}
                onClick={() => selectYear(item.year)}
                className="relative z-10 flex flex-col items-center group min-w-[90px] focus:outline-none"
              >
                <div className={`text-[12px] font-mono font-bold transition-colors ${isActive ? 'text-gold' : 'text-ivory/45 group-hover:text-ivory/80'}`}>
                  {item.year}
                </div>
                
                {/* Timeline node */}
                <div className={`my-1.5 flex h-4 w-4 items-center justify-center rounded-full border transition-all ${isActive ? 'border-gold bg-gold/25 scale-110 shadow-[0_0_8px_rgba(201,169,97,0.4)]' : 'border-white/10 bg-charcoal group-hover:border-white/35'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-gold' : 'bg-transparent'}`} />
                </div>
                
                <div className="text-center">
                  <p className={`text-[10px] font-medium leading-none truncate max-w-[100px] transition-colors ${isActive ? 'text-ivory' : 'text-ivory/30'}`}>
                    {item.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* MAIN REDESIGNED WORKSPACE GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        
        {/* LEFT COLUMN: THE ACTUAL AI CONVERSATION AREA */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col h-[650px] overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal/30 shadow-glass">
            
            {/* Active context indicators */}
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3 text-[12px]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-gold font-bold">
                  <Sliders size={12} /> Mode: {AI_MODES.find(m => m.id === activeMode)?.label}
                </span>
                <span className="text-ivory/25">•</span>
                <span className="flex items-center gap-1.5 font-mono text-gold font-bold">
                  <Clock size={12} /> Temporal Anchor: {activeYear}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                {!isDemo ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-ivory/30" />
                    <span className="text-ivory/40">Neural Pipeline Standby (0 Data Sources)</span>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-emerald/80">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald"></span>
                    </span>
                    Neural Pipeline Synced
                  </div>
                )}
              </div>
            </div>

            {/* Messages Scroll Box */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const isSystem = m.role === "system";

                  if (isSystem) {
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center"
                      >
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.01] px-4 py-2 text-[11.5px] font-mono text-gold/75 flex items-center gap-2">
                          <Zap size={11} className="animate-pulse text-gold" />
                          <span>{m.text}</span>
                        </div>
                      </motion.div>
                    );
                  }

                  if (isUser) {
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-gold/25 bg-gold/5 px-4 py-3 shadow-[0_0_15px_rgba(201,169,97,0.03)]">
                          <div className="flex items-center gap-2 mb-1.5 border-b border-white/[0.04] pb-1">
                            <Users size={12} className="text-gold" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-gold font-bold">{role}</span>
                            <span className="text-[10px] font-mono text-ivory/30 ml-auto">{m.timestamp}</span>
                          </div>
                          <p className="text-[13.5px] leading-relaxed text-ivory/90">{m.text}</p>
                        </div>
                      </motion.div>
                    );
                  }

                  // Otherwise, assistant response - true enterprise analyst layout!
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-4"
                    >
                      {/* Premium corporate AI logo node */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold bg-gold/10 shadow-[0_0_10px_rgba(201,169,97,0.2)]">
                        <Brain size={16} className="text-gold animate-pulse" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-3">
                        
                        {/* Upper indicators strip */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                          {/* 8. MEMORY INDICATOR */}
                          <div className="flex items-center gap-1 text-gold">
                            <History size={11} />
                            <span className="font-bold uppercase tracking-wider">Historical Context Used:</span>
                            <span className="text-ivory/80">{m.contextUsed}</span>
                          </div>
                          <span className="text-ivory/15">•</span>
                          {/* 11. MEMORY CONFIDENCE */}
                          {m.confidence && (
                            <div className="flex items-center gap-2 text-ivory/50">
                              <span>Confidence: <span className="text-emerald font-bold">{m.confidence.score}%</span></span>
                              <span>•</span>
                              <span>Sources: <span className="text-gold font-bold">{m.confidence.sources}</span></span>
                              <span>•</span>
                              <span>Consistency: <span className="text-emerald font-bold">{m.confidence.consistency}</span></span>
                            </div>
                          )}
                          <span className="text-ivory/20 ml-auto">{m.timestamp}</span>
                        </div>

                        {/* Executive Finding Card */}
                        <div className="rounded-xl border border-white/[0.07] bg-charcoal-light/40 p-4 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold" />
                          <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-gold font-mono mb-1.5 flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-gold" /> Executive Finding
                          </h4>
                          <p className="text-[13.5px] leading-relaxed text-ivory/90 font-medium">
                            {m.finding}
                          </p>
                        </div>

                        {/* Evidence & Impact Split row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          
                          {/* Evidence Block */}
                          {m.evidence && m.evidence.length > 0 && (
                            <div className="rounded-xl border border-white/[0.05] bg-charcoal-light/20 p-4">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ivory/50 font-mono mb-2">
                                Supporting Evidence
                              </h4>
                              <ul className="space-y-1.5">
                                {m.evidence.map((ev, i) => (
                                  <li key={i} className="text-[12.5px] leading-relaxed text-ivory/75 flex items-start gap-2">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                                    <span>{ev}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Impact & Recommendations */}
                          <div className="space-y-3">
                            {m.financialImpact && (
                              <div className="rounded-xl border border-crimson/20 bg-crimson/[0.02] p-4 relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-crimson" />
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-crimson/70 font-mono mb-1">
                                  Financial Exposure / Impact
                                </h4>
                                <p className="text-[15px] font-mono font-bold text-crimson animate-pulse">
                                  {m.financialImpact}
                                </p>
                              </div>
                            )}

                            {m.recommendations && m.recommendations.length > 0 && (
                              <div className="rounded-xl border border-emerald/20 bg-emerald/[0.02] p-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald/70 font-mono mb-2">
                                  Recommended Directives
                                </h4>
                                <ul className="space-y-1.5">
                                  {m.recommendations.map((rec, i) => (
                                    <li key={i} className="text-[12.5px] leading-relaxed text-ivory/80 flex items-start gap-1.5">
                                      <ArrowRight size={11} className="mt-1 text-emerald shrink-0" />
                                      <span className="font-medium hover:text-gold cursor-pointer transition-colors">
                                        {rec}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 5. INTRODUCE "REASONING TRACE" */}
                        {m.trace && (
                          <div className="rounded-xl border border-white/[0.05] bg-charcoal-light/10">
                            <button
                              onClick={() => toggleTrace(m.id)}
                              className="flex w-full items-center justify-between px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-ivory/50 font-mono hover:text-gold transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Brain size={12} className="text-gold/60" /> WHY APEX ONE THINKS THIS (REASONING TRACE)
                              </span>
                              {expandedTrace[m.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            {expandedTrace[m.id] && (
                              <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px] font-mono text-ivory/60 bg-white/[0.01] p-3 rounded-lg">
                                  <div className="flex flex-col md:flex-row flex-wrap items-center gap-1.5">
                                    <span className="text-gold font-bold">Trace sequence:</span>
                                    {m.trace.map((step, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-ivory/80 border border-white/[0.05]">
                                          {step}
                                        </span>
                                        {idx < (m.trace?.length || 0) - 1 && (
                                          <ArrowRight size={10} className="text-gold/50" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-[10px] text-emerald font-bold border border-emerald/20 rounded px-1 bg-emerald/5 shrink-0 self-end md:self-auto">
                                    Veracity Checked
                                  </div>
                                </div>
                                
                                <div className="mt-2.5 text-[11px] text-ivory/40 leading-relaxed pl-1">
                                  The neural synthesis layer evaluated client behavioral matrices, credit registry general ledger receipts, and transaction timestamps across cross-subsidiary databases to confirm absolute systemic alignment before outputting this briefing.
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. CROSS-SYSTEM REASONING */}
                        {m.sources && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-ivory/30 bg-white/[0.02] py-1 px-3 rounded-full w-fit">
                            <span>Unified Context Sources:</span>
                            {m.sources.map((src, i) => (
                              <span key={i} className="text-gold font-bold">
                                {src}{i < (m.sources?.length || 0) - 1 ? " ·" : ""}
                              </span>
                            ))}
                          </div>
                        )}

                      </div>
                    </motion.div>
                  );
                })}

                {/* Thinking indicator */}
                {thinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold bg-gold/10 shadow-[0_0_10px_rgba(201,169,97,0.2)]">
                      <Brain size={16} className="text-gold animate-spin" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-gold">
                        <Activity size={12} className="animate-pulse" />
                        <span>Apex Reasoning Engine active... scanning general ledgers & contract databases</span>
                      </div>
                      <div className="h-2 w-24 bg-white/5 rounded overflow-hidden">
                        <div className="h-full bg-gold rounded animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Conversation Input bar */}
            <div className="border-t border-white/[0.06] bg-white/[0.01] p-4">
              <div className="flex items-end gap-2.5 rounded-xl border border-white/[0.08] bg-charcoal-light/40 p-2.5 focus-within:border-gold/30 transition-all duration-200">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Ask Apex institutional memory about ${organization.name}…`}
                  rows={1}
                  disabled={thinking}
                  className="max-h-[140px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ivory placeholder:text-ivory/30 outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={thinking || !input.trim()}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                    input.trim() && !thinking
                      ? "bg-gold text-charcoal hover:shadow-[0_0_10px_rgba(201,169,97,0.4)]"
                      : "bg-white/[0.04] text-ivory/20"
                  }`}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-ivory/30 font-mono">
                {!isDemo 
                  ? "Standby: Operational memory awaiting data source connections. Enable Demo Mode in Settings to simulate enterprise memory."
                  : `Institutional query clearances active under ${role} credentials. Sync: Live.`}
              </p>
            </div>

          </div>

          {/* 7. HISTORICAL QUESTIONS SECTION */}
          <GlassCard delay={0.1} hover={false} className="p-4 border-white/[0.05]">
            <h4 className="text-[11.5px] font-bold uppercase tracking-[0.15em] text-ivory/50 font-mono mb-3 flex items-center gap-1.5">
              <Search size={12} className="text-gold/60" /> ASK THE ORGANIZATION (HISTORICAL REASONING)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {HISTORICAL_QUESTIONS.map((qObj, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qObj.q)}
                  disabled={thinking}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5 text-left text-[12px] text-ivory/70 hover:border-gold/30 hover:bg-white/[0.04] hover:text-gold transition-all duration-200 group focus:outline-none"
                >
                  <qObj.icon size={13} className="text-gold/40 group-hover:text-gold shrink-0" />
                  <span className="truncate">{qObj.q}</span>
                  <ArrowRight size={10} className="text-gold/0 group-hover:text-gold/100 ml-auto transition-all shrink-0" />
                </button>
              ))}
            </div>
          </GlassCard>

        </div>

        {/* RIGHT COLUMN: INTELLIGENCE SIDEBAR */}
        <div className="flex flex-col gap-5">
          
          {/* 9. EXECUTIVE MODES PANEL */}
          <GlassCard delay={0.12} hover={false} className="p-4 border-gold/15">
            <div className="flex items-center gap-2 mb-3">
              <Sliders size={13} className="text-gold" />
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.15em] text-gold font-mono">
                AI REASONING MODES
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AI_MODES.map((mode) => {
                const isActive = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => selectMode(mode.id)}
                    className={`flex flex-col rounded-lg border p-2.5 text-left transition-all duration-200 relative group focus:outline-none ${
                      isActive 
                        ? "border-gold/30 bg-gold/5 shadow-[0_0_12px_rgba(201,169,97,0.06)]" 
                        : "border-white/[0.04] bg-charcoal-light/10 hover:border-white/20 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <mode.icon size={12} className={isActive ? "text-gold" : "text-ivory/40 group-hover:text-ivory/75"} />
                      <span className={`text-[11.5px] font-bold ${isActive ? "text-gold" : "text-ivory/70"}`}>
                        {mode.id}
                      </span>
                    </div>
                    <p className="text-[9.5px] leading-tight text-ivory/40">
                      {mode.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* 2. ORGANIZATIONAL MEMORY PANEL */}
          <GlassCard delay={0.15} hover={false} className="p-4 border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database size={13} className="text-gold" />
                <h3 className="text-[11.5px] font-bold uppercase tracking-[0.15em] text-gold font-mono">
                  ORGANIZATIONAL MEMORY
                </h3>
              </div>
              {!isDemo ? (
                <span className="text-[10px] font-mono text-ivory/40 bg-white/[0.03] border border-white/[0.08] px-1.5 py-0.5 rounded">
                  STANDBY (0 CONNECTED)
                </span>
              ) : (
                <span className="text-[10px] font-mono text-emerald/80 bg-emerald/5 border border-emerald/10 px-1.5 py-0.5 rounded animate-pulse">
                  LIVE VERIFIED
                </span>
              )}
            </div>

            <p className="text-[11.5px] text-ivory/45 mb-3.5 leading-relaxed">
              {!isDemo
                ? "No live database connectors connected. Connect data sources in Settings or toggle Demo Mode to audit operational memory indices:"
                : "Consolidated registry covering 4 corporate subsidiaries. Select a category to audit current semantic index state:"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {memoryCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="flex flex-col text-left p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-gold/30 hover:bg-white/[0.03] transition-all duration-200 group focus:outline-none"
                >
                  <div className="flex items-center gap-1.5 mb-1 text-gold/60 group-hover:text-gold transition-colors">
                    <cat.icon size={12} />
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                      {cat.label}
                    </span>
                  </div>
                  <div className="text-[11.5px] font-bold text-ivory font-mono tabular-nums">
                    {cat.count}
                  </div>
                  <p className="text-[9px] text-ivory/30 mt-0.5 leading-snug">
                    {cat.desc}
                  </p>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* 10. PROACTIVE INTELLIGENCE: WHAT APEX ONE NOTICED */}
          <GlassCard delay={0.18} hover={false} className="p-4 border-crimson/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-16 w-16 bg-crimson/5 blur-xl rounded-full" />
            
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={13} className="text-crimson animate-pulse" />
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.15em] text-crimson font-mono">
                WHAT APEX ONE NOTICED
              </h3>
            </div>

            <div className="space-y-2.5">
              {!isDemoMode() ? (
                <div className="text-center py-6">
                  <span className="text-[11px] font-mono uppercase text-ivory/30 block">No operational anomalies</span>
                  <p className="text-[10px] text-ivory/25 mt-1 leading-normal max-w-[220px] mx-auto">
                    Proactive telemetry is clear. Active system anomalies generate as operations run.
                  </p>
                </div>
              ) : (
                PROACTIVE_NOTICES.map((notice) => {
                  const isExpanded = expandedNotice === notice.id;
                  return (
                    <div
                      key={notice.id}
                      className="rounded-lg border border-white/[0.05] bg-charcoal-light/10 overflow-hidden transition-all duration-200"
                    >
                      <button
                        onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                        className="w-full flex items-center justify-between p-2.5 text-left hover:bg-white/[0.01] transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
                            <span className="text-[11.5px] font-bold text-ivory/90">{notice.title}</span>
                          </div>
                          <p className="text-[10.5px] text-ivory/40 mt-0.5 truncate max-w-[240px]">{notice.summary}</p>
                        </div>
                        {isExpanded ? <ChevronUp size={12} className="text-ivory/30" /> : <ChevronDown size={12} className="text-ivory/30" />}
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 bg-white/[0.01] border-t border-white/[0.04] text-[11px] leading-relaxed space-y-2">
                          <div>
                            <span className="text-gold font-mono uppercase text-[9px] block">Why it matters:</span>
                            <span className="text-ivory/70">{notice.whyItMatters}</span>
                          </div>
                          <div>
                            <span className="text-gold font-mono uppercase text-[9px] block">Evidence chain:</span>
                            <span className="text-ivory/70">{notice.evidence}</span>
                          </div>
                          <div className="bg-crimson/[0.02] border border-crimson/10 p-1.5 rounded">
                            <span className="text-crimson font-mono uppercase text-[9.5px] font-bold block">Estimated Impact:</span>
                            <span className="text-crimson font-bold font-mono">{notice.impact}</span>
                          </div>
                          <button
                            onClick={() => handleNoticeClick(notice)}
                            className="w-full mt-1.5 py-1 px-2 text-[10px] bg-gold/10 border border-gold/25 hover:bg-gold/20 text-gold rounded font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5"
                          >
                            <Brain size={10} /> Analyze Deeper in Chat
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
