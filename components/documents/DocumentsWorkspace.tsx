"use client";

import { useState, useMemo } from "react";
import { isDemoMode } from "@/lib/demo";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Sparkles,
  Link2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  User,
  ExternalLink,
  ChevronRight,
  UploadCloud,
  FilePlus,
  RefreshCw,
  Send,
  Lock,
  ArrowRight,
  Info
} from "lucide-react";

// Expanded metadata interfaces for rich Document Intelligence
interface ExtractedEntities {
  customers: string[];
  contracts: string[];
  financialValues: string[];
  risks: string[];
  importantDates: string[];
  actions: string[];
  relatedDocs: string[];
}

interface UsefulSummary {
  keyFinding: string;
  obligations: string[];
  risksDetail: string[];
  datesDetail: { event: string; date: string }[];
  financialExposure: string;
  recommendedAction: string;
}

interface DocRelationships {
  relatedCustomer: { name: string; id: string };
  relatedContract: string;
  relatedWorkflow: string;
  relatedEmployee: string;
  relatedTransaction: string;
  relatedDecision: string;
}

interface IntelDocument {
  id: string;
  name: string;
  fileType: "pdf" | "doc" | "xlsx";
  category: "Contract" | "Policy" | "Financial Document" | "Report" | "Compliance Document";
  businessUnit: "Enterprise Operations" | "Commercial Operations" | "Strategic Accounts" | "Customer Operations";
  uploadedBy: string;
  date: string;
  size: string;
  pages: number;
  status: "processed" | "processing";
  usefulSummary: UsefulSummary;
  entities: ExtractedEntities;
  relationships: DocRelationships;
}

const defaultDocuments: IntelDocument[] = [
    {
      id: "doc-1",
      name: "Strategic Accounts — Q2 Investment Management Agreement.pdf",
      fileType: "pdf",
      category: "Contract",
      businessUnit: "Strategic Accounts",
      uploadedBy: "Priya Nair",
      date: "Jul 15, 2026",
      size: "2.4 MB",
      pages: 18,
      status: "processed",
      usefulSummary: {
        keyFinding: "Apex Sync assumes discretionary asset placement rights for Ashford & Vale Wealth. Tiered fee scales are structured dynamically with a baseline commitment of ₦2.99B ($4.60M USD) AUM.",
        obligations: [
          "Quarterly reporting delivered within 15 business days of close.",
          "Discretionary rebalancing restricted to high-liquidity indexes."
        ],
        risksDetail: [
          "90-day static notice period is required for standard termination.",
          "Performance penalty clauses trigger if standard index benchmarks lag by >4%."
        ],
        datesDetail: [
          { event: "Agreement Effective", date: "Feb 1, 2026" },
          { event: "Quarterly Audit Lock", date: "Aug 15, 2026" },
          { event: "Auto-Renewal Review", date: "Jan 15, 2029" }
        ],
        financialExposure: "₦2.99B committed capital at 0.85% base (₦25.4M base ARR yield potential).",
        recommendedAction: "Confirm with Priya Nair that Q2 rebalancing complies strictly with client's new carbon-neutral guidelines."
      },
      entities: {
        customers: ["Ashford & Vale Wealth"],
        contracts: ["IMA-2026-VALE-01"],
        financialValues: ["₦2.99B AUM", "0.85% fee", "10% performance incentive"],
        risks: ["90-day termination notice lockup", "Lag penalty index"],
        importantDates: ["Feb 1, 2026", "Aug 15, 2026", "Jan 15, 2029"],
        actions: ["Execute compliance re-verification", "Lock in Q2 ledger parameters"],
        relatedDocs: ["Ashford & Vale Portfolio Statement Q1.xlsx", "Strategic Accounts Yield Ledger 2026.xlsx"]
      },
      relationships: {
        relatedCustomer: { name: "Ashford & Vale Wealth", id: "cust-5" },
        relatedContract: "Asset Placement Mandate #IMA-2026",
        relatedWorkflow: "Discretionary Allocation & Trading Pipeline",
        relatedEmployee: "Priya Nair (Senior Advisor)",
        relatedTransaction: "TXN-9021-Capital-AUM",
        relatedDecision: "Apex Board allocation approval of February 2026"
      }
    },
    {
      id: "doc-2",
      name: "Meridian Logistics — Renewal Contract Draft.doc",
      fileType: "doc",
      category: "Contract",
      businessUnit: "Commercial Operations",
      uploadedBy: "Elena Cho",
      date: "Jul 16, 2026",
      size: "640 KB",
      pages: 9,
      status: "processed",
      usefulSummary: {
        keyFinding: "Draft renewal framework proposing standard 12-month extension terms for Meridian Logistics Group. A 3% tariff increase has been proposed by sales, but is currently contested.",
        obligations: [
          "Daily credit clearing windows locked to 24-hour cycles.",
          "Overdraft clearing restricted to ₦10M baseline tiers."
        ],
        risksDetail: [
          "Meridian has requested custom SLA response bounds of 2 hours, which exceeds standard 4-hour buffers.",
          "No auto-renewal clauses exist — requires active executive signatures before September."
        ],
        datesDetail: [
          { event: "Draft Expiration Window", date: "Aug 1, 2026" },
          { event: "Core Contract Renewal Limit", date: "Sep 14, 2026" }
        ],
        financialExposure: "₦1.84M current ARR (proposing 3% growth margin lift).",
        recommendedAction: "Loop in Elena Cho to negotiate a 2.5% increase compromise alongside custom SLA pricing overlays."
      },
      entities: {
        customers: ["Meridian Logistics Group"],
        contracts: ["CON-REN-LOG-02"],
        financialValues: ["₦1.84M ARR", "3% tariff adjustment", "₦10M overdraft limits"],
        risks: ["Contested pricing tiers", "Custom SLA overhead risk"],
        importantDates: ["Aug 1, 2026", "Sep 14, 2026"],
        actions: ["Settle tariff compromise rate", "Verify legal signatory credentials"],
        relatedDocs: ["Meridian Q2 Logistics Invoice.pdf", "Apex Group Credit Guidelines v3.pdf"]
      },
      relationships: {
        relatedCustomer: { name: "Meridian Logistics Group", id: "cust-1" },
        relatedContract: "Corporate Credit Account Renewal #CON-REN-LOG",
        relatedWorkflow: "Sales Renewal Pipeline v4",
        relatedEmployee: "Elena Cho (Relationship Lead)",
        relatedTransaction: "TXN-4821-Meridian-Clearing",
        relatedDecision: "Commercial Operations credit risk committee review"
      }
    },
    {
      id: "doc-3",
      name: "Enterprise Operations — Q2 2026 Financial Statement.xlsx",
      fileType: "xlsx",
      category: "Financial Document",
      businessUnit: "Enterprise Operations",
      uploadedBy: "Nina Torres",
      date: "Jul 10, 2026",
      size: "1.1 MB",
      pages: 6,
      status: "processed",
      usefulSummary: {
        keyFinding: "Consolidated Q2 performance shows asset base expanding by 4.1% quarter-on-quarter. Corporate credit products drove the majority of growth, compensating for retail volume slumps.",
        obligations: [
          "Submit verified regulatory filings to central banking regulators by mid-August.",
          "Verify loan-loss reserve balances match ₦21M margin floor allocations."
        ],
        risksDetail: [
          "Slight margin squeezing detected in consumer loan portfolios due to retail interest rate shifts.",
          "Non-performing loan segments saw a transient 0.3% rise."
        ],
        datesDetail: [
          { event: "Filing Submission Deadline", date: "Aug 15, 2026" },
          { event: "Quarterly Board Review", date: "Aug 20, 2026" }
        ],
        financialExposure: "₦18.6B under-management balance sheet, with ₦142M net corporate yield.",
        recommendedAction: "Deploy Automated Reserve Sweeps to hedge retail credit variance ahead of final Q3 calculations."
      },
      entities: {
        customers: ["Internal - Enterprise Operations Treasury"],
        contracts: ["FS-Q2-2026-BANK"],
        financialValues: ["₦18.6B Balance Sheet", "₦142M Yield", "₦21M Loss Reserve"],
        risks: ["Margin squeeze", "Slight non-performing debt drift"],
        importantDates: ["Aug 15, 2026", "Aug 20, 2026"],
        actions: ["File regulatory declarations", "Sync liquidity reserves"],
        relatedDocs: ["Enterprise Operations Q1 Balance Sheet.xlsx", "Audit Clearance Statement.pdf"]
      },
      relationships: {
        relatedCustomer: { name: "Internal Treasury Accounts", id: "cust-6" },
        relatedContract: "Regulatory Compliance Audit #FS-Q2",
        relatedWorkflow: "Regulatory Filing Reporting automation",
        relatedEmployee: "Nina Torres (Treasury Lead)",
        relatedTransaction: "TXN-0091-Reserve-Allocations",
        relatedDecision: "August board strategy meeting agenda"
      }
    },
    {
      id: "doc-4",
      name: "Customer Operations — Claims Audit Report.pdf",
      fileType: "pdf",
      category: "Report",
      businessUnit: "Customer Operations",
      uploadedBy: "Marcus Webb",
      date: "Jul 12, 2026",
      size: "3.0 MB",
      pages: 24,
      status: "processed",
      usefulSummary: {
        keyFinding: "Compliance audit of 340 claims profiles revealed a solid 91/100 score. The single critical outlier is processing delays occurring at the initial claims intake bottleneck.",
        obligations: [
          "Maintain clear SLA response times of 4 days for standard claims.",
          "Re-verify manual processing locks on high-value reinsurance portfolios."
        ],
        risksDetail: [
          "Persistent delays could trigger penalty SLA credit payouts to Meridian Logistics.",
          "Manual interlocks in the claims ledger account for 45% of processing lag."
        ],
        datesDetail: [
          { event: "Mitigation Pipeline Audited", date: "Jul 3, 2026" },
          { event: "SLA Remediation Target", date: "Aug 30, 2026" }
        ],
        financialExposure: "₦3.8M potential monthly lag drag if intake delays are unresolved.",
        recommendedAction: "Approve the immediate deployment of Claims Automation Phase 2 Vetting modules to bypass the manual block."
      },
      entities: {
        customers: ["Solace Home Insurance Co.", "Meridian Logistics Group"],
        contracts: ["AUD-CLAIMS-Q2"],
        financialValues: ["340 Audit profiles", "91/100 Audit score", "₦3.8M lag impact"],
        risks: ["SLA penalty payouts", "Manual interlock queue locks"],
        importantDates: ["Jul 3, 2026", "Aug 30, 2026"],
        actions: ["Approve intake automation workflow", "Issue client SLA warnings"],
        relatedDocs: ["Claims Intake Workflow Diagram.png", "reinsurance_ledger_sync.pdf"]
      },
      relationships: {
        relatedCustomer: { name: "Solace Home Insurance", id: "cust-3" },
        relatedContract: "Claims Quality Audit #AUD-CLAIMS-Q2",
        relatedWorkflow: "Claims Automation Phase 2 Integration",
        relatedEmployee: "Marcus Webb (Risk Officer)",
        relatedTransaction: "TXN-8821-SLA-Credits",
        relatedDecision: "Operations Automation clear directives"
      }
    },
    {
      id: "doc-5",
      name: "Customer Operations — AML Compliance Filing.pdf",
      fileType: "pdf",
      category: "Compliance Document",
      businessUnit: "Customer Operations",
      uploadedBy: "Priya Shah",
      date: "Jul 8, 2026",
      size: "1.8 MB",
      pages: 14,
      status: "processed",
      usefulSummary: {
        keyFinding: "Quarterly transaction review identified 12 transactions requiring secondary manual compliance clearance. All have been analyzed, cleared, and closed with zero regulatory exposure.",
        obligations: [
          "Report flagged files to regulatory bodies within 30 days of detection.",
          "Archive verification records for audit continuity."
        ],
        risksDetail: [
          "Delayed clearances can lead to transaction bottlenecks for high-volume accounts.",
          "Audit trail gaps present compliance penalty risks if documents are misplaced."
        ],
        datesDetail: [
          { event: "Clearance Lock", date: "Jul 28, 2026" },
          { event: "Regulatory Filing Lock", date: "Aug 10, 2026" }
        ],
        financialExposure: "₦0 regulatory penalty exposure (all 12 flags successfully cleared).",
        recommendedAction: "Review transaction screening rule parameters to reduce false-positive rates by 15%."
      },
      entities: {
        customers: ["Brightwell Regional Bank"],
        contracts: ["AML-Q2-2026-REG"],
        financialValues: ["12 Flagged profiles", "30-day reporting limit", "0 penalty liability"],
        risks: ["Auditing trail gaps", "High false-positive rate lag"],
        importantDates: ["Jul 28, 2026", "Aug 10, 2026"],
        actions: ["Optimize compliance scoring parameters", "Archive AML transaction metadata"],
        relatedDocs: ["AML Screening Rules Profile.docx", "Flagged_Trans_Log_Q2.xlsx"]
      },
      relationships: {
        relatedCustomer: { name: "Brightwell Regional Bank", id: "cust-4" },
        relatedContract: "AML Regulatory Audit Filing #AML-Q2",
        relatedWorkflow: "Compliance KYC Auto-Scans Pipeline",
        relatedEmployee: "Priya Shah (Compliance Manager)",
        relatedTransaction: "TXN-3011-Compliance-Audit",
        relatedDecision: "Risk Committee compliance filing checkoff"
      }
    }
];

export default function DocumentsWorkspace() {
  const [documents, setDocuments] = useState<IntelDocument[]>(
    isDemoMode() ? defaultDocuments : []
  );

  const [selectedId, setSelectedId] = useState<string>("doc-1");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [uploading, setUploading] = useState<boolean>(false);

  // Q&A / Memory Engine State
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, { id: string; role: "user" | "assistant"; content: string }[]>>({});
  const [chatInput, setChatInput] = useState<string>("");
  const [thinking, setThinking] = useState<boolean>(false);

  const selectedDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedId) || documents[0] || null;
  }, [documents, selectedId]);

  // Compute stats dynamically for DOCUMENT OVERVIEW section
  const documentOverview = useMemo(() => {
    if (!isDemoMode()) {
      return {
        total: documents.length,
        contracts: documents.filter((d) => d.category === "Contract").length,
        policies: documents.filter((d) => d.category === "Policy").length,
        financials: documents.filter((d) => d.category === "Financial Document").length,
        reports: documents.filter((d) => d.category === "Report").length,
        compliance: documents.filter((d) => d.category === "Compliance Document").length,
        recentlyChanged: 0
      };
    }
    const total = documents.length + 144; // Real-looking base
    const contracts = documents.filter((d) => d.category === "Contract").length + 62;
    const policies = documents.filter((d) => d.category === "Policy").length + 22;
    const financials = documents.filter((d) => d.category === "Financial Document").length + 31;
    const reports = documents.filter((d) => d.category === "Report").length + 18;
    const compliance = documents.filter((d) => d.category === "Compliance Document").length + 11;
    const recentlyChanged = 4;

    return { total, contracts, policies, financials, reports, compliance, recentlyChanged };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategory]);

  const handleSimulateUpload = () => {
    if (uploading) return;
    setUploading(true);

    const id = `doc-${Date.now()}`;
    const newDoc: IntelDocument = {
      id,
      name: "Customer Operations — Onboarding Services Agreement.pdf",
      fileType: "pdf",
      category: "Contract",
      businessUnit: "Customer Operations",
      uploadedBy: "Elena Cho",
      date: "Aug 18, 2026",
      size: "1.3 MB",
      pages: 11,
      status: "processing",
      usefulSummary: {
        keyFinding: "Agreement covering onboarding services framework. This legal binding guarantees automated workflows integration guidelines.",
        obligations: ["Delivery of system parameters within 30 days.", "Provide level 1 core client services access."],
        risksDetail: ["Subject to standard dispute arbitration limits.", "No secondary liability clauses are configured."],
        datesDetail: [{ event: "Execution Launch", date: "Aug 18, 2026" }],
        financialExposure: "$420K standard contract volume (₦352M equivalent ARR).",
        recommendedAction: "Review automated integration steps with founder Elena Cho."
      },
      entities: {
        customers: ["Sterling & Ives Underwriters"],
        contracts: ["CON-STERL-2026"],
        financialValues: ["$420K contract volume", "15% standard commission tier"],
        risks: ["Standard arbitration boundaries"],
        importantDates: ["Aug 18, 2026"],
        actions: ["Approve digital services scope"],
        relatedDocs: ["Sterling Services Statement.xlsx"]
      },
      relationships: {
        relatedCustomer: { name: "Sterling & Ives Underwriters", id: "cust-7" },
        relatedContract: "Onboarding Services Protocol #CON-STERL",
        relatedWorkflow: "Client Ingestion Protocol Pipeline",
        relatedEmployee: "Elena Cho (Integration Executive)",
        relatedTransaction: "TXN-2911-Sterling-Onboard",
        relatedDecision: "Advisory desk authorization profile"
      }
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedId(id);

    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "processed" } : d))
      );
      setUploading(false);
    }, 2000);
  };

  // Pre-configured questions for Document Memory
  const suggestedQueries = [
    "What changed between these two contracts?",
    "What obligations exist in this agreement?",
    "Which customers are mentioned?",
    "What financial commitments are contained here?"
  ];

  const handleSendQuery = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || !selectedDoc) return;

    const userMsg = { id: `msg-u-${Date.now()}`, role: "user" as const, content: trimmed };
    const currentDocId = selectedDoc.id;

    setChatsByDoc((prev) => ({
      ...prev,
      [currentDocId]: [...(prev[currentDocId] || []), userMsg]
    }));
    setChatInput("");
    setThinking(true);

    setTimeout(() => {
      let answer = "";
      const q = trimmed.toLowerCase();

      if (q.includes("change") || q.includes("between")) {
        answer = `Comparing this draft with our historical baseline: Standard core terms remain aligned with company regulations. However, custom clauses in the appendix introduce a 3% price fluctuation rate and lock standard SLA support response expectations.`;
      } else if (q.includes("obligation")) {
        answer = `Under section 4.2 of this agreement, the following strict legal obligations exist:\n\n1. ${selectedDoc.usefulSummary.obligations.join("\n2. ")}\n\nNon-compliance triggers automated penalty review mechanisms.`;
      } else if (q.includes("customer")) {
        answer = `This document explicitly mentions and binds client entity "${selectedDoc.entities.customers.join(", ")}", referencing core parent organizational profiles within the group ledger.`;
      } else if (q.includes("financial") || q.includes("commitment") || q.includes("value")) {
        answer = `Financial Exposure: ${selectedDoc.usefulSummary.financialExposure}. This commitment has been registered and synced automatically to Apex Sync's live Value Opportunity pipeline.`;
      } else {
        answer = `Document Intelligence Synthesis:\n\nKey Finding: ${selectedDoc.usefulSummary.keyFinding}\n\nRisks Flagged: ${selectedDoc.usefulSummary.risksDetail.join(", ")}`;
      }

      const assistantMsg = { id: `msg-a-${Date.now()}`, role: "assistant" as const, content: answer };
      setChatsByDoc((prev) => ({
        ...prev,
        [currentDocId]: [...(prev[currentDocId] || []), assistantMsg]
      }));
      setThinking(false);
    }, 800);
  };

  const currentChats = selectedDoc ? (chatsByDoc[selectedDoc.id] || []) : [];

  return (
    <div className="space-y-6" id="document-intelligence-workspace">
      
      {/* HEADER BAR */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
            APEX ONE
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
            Document Intelligence
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ivory/50">
            APEX ONE turns raw files into structured organizational knowledge, extracting core parameters, auditing contracts, and syncing dates.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 text-[12px] font-mono text-gold/80">
          <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
          Active Intelligence Sync: <span className="font-bold text-ivory">Connected</span>
        </div>
      </div>

      {/* ────────────────── DOCUMENT OVERVIEW METRICS PANEL ────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7" id="document-overview-deck">
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Total Indexed</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.total}</p>
          <p className="text-[9.5px] text-emerald/80 font-mono mt-0.5">Live vector nodes</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Contracts</p>
          <p className="mt-1 font-display text-[22px] font-bold text-gold">{documentOverview.contracts}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Active agreements</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Policies</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.policies}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Internal rules</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Financials</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.financials}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Yield & balance sheets</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Audit Reports</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.reports}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Compliance reviews</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Compliance Filings</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.compliance}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Active submissions</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Recently Changed</p>
          <p className="mt-1 font-display text-[22px] font-bold text-crimson flex items-center gap-1">
            {documentOverview.recentlyChanged} <span className="h-2 w-2 rounded-full bg-crimson animate-pulse" />
          </p>
          <p className="text-[9.5px] text-crimson/80 font-mono mt-0.5">Requires reviews</p>
        </div>
      </div>

      {/* ────────────────── TWO-COLUMN WORKSPACE: LEFT SEARCH / LIST, RIGHT INTEL DOSSIER ────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        
        {/* LEFT WORKSPACE PANELS */}
        <div className="space-y-4">
          
          {/* DRAG-AND-DROP FILE INGESTION SIMULATOR */}
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-charcoal/25 p-4 text-center transition-all hover:bg-charcoal/30">
            <UploadCloud size={24} className="mx-auto text-gold/60 mb-2" />
            <p className="text-[12.5px] font-bold text-ivory">Drag New Document Here</p>
            <p className="text-[10.5px] text-ivory/40 mt-1 leading-normal font-mono">Supports PDF, DOC, XLSX files up to 25MB.</p>
            <button
              onClick={handleSimulateUpload}
              disabled={uploading}
              className="mt-3.5 w-full rounded-lg bg-gold/10 hover:bg-gold/15 border border-gold/30 px-3 py-1.5 text-[11px] font-mono font-bold text-gold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {uploading ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-gold" />
                  Apex Parser Reading...
                </>
              ) : (
                <>
                  <FilePlus size={11} />
                  Simulate Document Upload
                </>
              )}
            </button>
          </div>

          {/* SEARCH & CATEGORY FILTERING */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4 space-y-3 shadow-glass">
            <div className="relative">
              <input
                type="text"
                placeholder="Search index..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-[12px] text-ivory focus:outline-none focus:border-gold/50"
              />
              <Search size={12} className="absolute left-3 top-2.5 text-ivory/40" />
            </div>

            {/* Micro Categories buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["All", "Contract", "Financial Document", "Report", "Compliance Document"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono border transition-all cursor-pointer ${
                    selectedCategory === cat 
                      ? "bg-gold/10 border-gold text-gold font-bold" 
                      : "bg-white/[0.02] border-white/[0.05] text-ivory/50 hover:bg-white/[0.04]"
                  }`}
                >
                  {cat === "Financial Document" ? "Financial" : cat === "Compliance Document" ? "Compliance" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* DOCUMENTS LIST QUEUE */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-3 space-y-2 shadow-glass max-h-[480px] overflow-y-auto scrollbar-none">
            <p className="text-[10px] font-mono text-ivory/30 uppercase tracking-wider pl-2 mb-1">Index Feed</p>
            {filteredDocuments.map((docItem) => {
              const isSelected = docItem.id === selectedId;
              const isProcessing = docItem.status === "processing";
              return (
                <button
                  key={docItem.id}
                  onClick={() => setSelectedId(docItem.id)}
                  className={`w-full text-left rounded-lg p-3 transition-all flex items-start gap-3 border ${
                    isSelected 
                      ? "bg-white/[0.05] border-gold/40 shadow-gold-glow-soft" 
                      : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]"
                  }`}
                >
                  <FileText size={18} className={`mt-0.5 shrink-0 ${isSelected ? "text-gold" : "text-ivory/40"}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[12.5px] font-bold text-ivory truncate">{docItem.name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-ivory/45 font-mono mt-1">
                      <span className="bg-white/5 px-1 py-0.1 rounded uppercase text-[8.5px]">{docItem.category}</span>
                      <span>·</span>
                      <span>{docItem.size}</span>
                      {isProcessing && (
                        <span className="text-gold font-bold flex items-center gap-1 animate-pulse">
                          <RefreshCw size={8} className="animate-spin" /> Ingesting
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* RIGHT COLUMN: RICH DOCUMENT INTELLIGENCE DOSSIER */}
        <div className="space-y-6">
          
          {!selectedDoc ? (
            <div className="rounded-2xl border border-white/[0.08] bg-charcoal/40 p-12 text-center shadow-glass flex flex-col items-center justify-center min-h-[450px]">
              <div className="h-16 w-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                <FileText size={28} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-wide uppercase bg-white/[0.04] border border-white/[0.08] text-ivory/60 mb-3">
                Document Intelligence Repository
              </span>
              <h3 className="font-display text-xl font-bold text-ivory">No documents uploaded</h3>
              <p className="mt-2 text-sm text-ivory/50 max-w-md">
                Upload or sync your enterprise documents, contracts, and regulatory filings to enable deep entity extraction, clause analysis, and AI synthesis.
              </p>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDoc.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass"
            >
              {/* Dossier Header Area */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/[0.05] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-gold/80 bg-gold/10 border border-gold/20 px-2 py-0.5 rounded uppercase font-semibold">
                      {selectedDoc.category}
                    </span>
                    <span className="text-[10px] font-mono text-ivory/40 bg-white/5 px-2 py-0.5 rounded">
                      {selectedDoc.businessUnit}
                    </span>
                    <span className="text-[10px] font-mono text-ivory/40">
                      Uploaded by {selectedDoc.uploadedBy} on {selectedDoc.date}
                    </span>
                  </div>
                  <h2 className="font-display text-[19px] font-bold text-ivory mt-2 flex items-center gap-2 leading-snug">
                    <FileText className="text-gold shrink-0" size={20} />
                    {selectedDoc.name}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-stretch md:self-auto justify-between md:justify-start border-t border-white/[0.04] pt-3 md:pt-0 md:border-0">
                  <div className="text-left md:text-right font-mono">
                    <p className="text-[10.5px] text-ivory/40 uppercase">Metadata Nodes</p>
                    <p className="text-[12px] text-ivory font-bold">{selectedDoc.pages} Pages · {selectedDoc.size}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${selectedDoc.status === "processed" ? "bg-emerald" : "bg-gold animate-ping"}`} />
                </div>
              </div>

              {selectedDoc.status === "processing" ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={28} className="animate-spin text-gold" />
                  <p className="text-[13.5px] text-ivory/60 font-mono">APEX ONE Sync Intelligence is scanning and extracting metadata...</p>
                  <p className="text-[11.5px] text-ivory/35 font-mono">Vector locks and cross-system calendar signals are being calculated.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-6">

                  {/* ── USEFUL AI SUMMARY BOX ── */}
                  <div className="rounded-xl border border-gold/25 bg-gold/[0.02] p-5 shadow-gold-glow-soft">
                     <div className="flex items-center gap-2 text-gold mb-3">
                       <Sparkles size={15} className="animate-pulse" />
                       <h3 className="text-[11.5px] font-bold uppercase tracking-[0.08em] font-mono">APEX ONE DEEP INTELLIGENCE SUMMARY</h3>
                     </div>

                     <div className="space-y-4">
                       <div>
                         <span className="text-[10px] font-mono text-ivory/40 uppercase block">Key Finding</span>
                         <p className="text-[13px] text-ivory leading-relaxed font-mono mt-0.5">{selectedDoc.usefulSummary.keyFinding}</p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <span className="text-[10px] font-mono text-gold/70 uppercase block font-semibold">Important Obligations</span>
                           <ul className="mt-1.5 space-y-1.5 text-[12px] text-ivory/80 font-mono">
                             {selectedDoc.usefulSummary.obligations.map((ob, i) => (
                               <li key={i} className="flex items-start gap-2">
                                 <span className="text-gold shrink-0 mt-1">•</span>
                                 <span>{ob}</span>
                               </li>
                             ))}
                           </ul>
                         </div>

                         <div>
                           <span className="text-[10px] font-mono text-crimson uppercase block font-semibold">Legal & Technical Risks</span>
                           <ul className="mt-1.5 space-y-1.5 text-[12px] text-ivory/80 font-mono">
                             {selectedDoc.usefulSummary.risksDetail.map((rk, i) => (
                               <li key={i} className="flex items-start gap-2">
                                 <span className="text-crimson shrink-0 mt-1">•</span>
                                 <span className="text-ivory/80">{rk}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/[0.04] pt-3.5">
                         <div>
                           <span className="text-[10px] font-mono text-ivory/40 uppercase block">Obligation Dates Detected</span>
                           <div className="mt-1.5 space-y-2">
                             {selectedDoc.usefulSummary.datesDetail.map((dt, i) => (
                               <div key={i} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] rounded px-2.5 py-1 text-[11px] font-mono">
                                 <span className="text-ivory/50">{dt.event}</span>
                                 <span className="text-gold font-semibold flex items-center gap-1">
                                   <Calendar size={10} />
                                   {dt.date}
                                 </span>
                               </div>
                             ))}
                           </div>
                         </div>

                         <div className="flex flex-col justify-between">
                           <div>
                             <span className="text-[10px] font-mono text-ivory/40 uppercase block">Financial Commitment</span>
                             <p className="text-[13px] font-mono text-gold font-bold mt-1">
                               {selectedDoc.usefulSummary.financialExposure}
                             </p>
                           </div>
                           <div className="mt-4 bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-lg flex items-start gap-2">
                             <span className="text-[10px] font-mono text-gold font-bold shrink-0 mt-0.5">DIRECTIVE:</span>
                             <p className="text-[11px] font-mono text-ivory/85 leading-relaxed">
                               {selectedDoc.usefulSummary.recommendedAction}
                             </p>
                           </div>
                         </div>
                       </div>

                     </div>
                  </div>

                  {/* ── ENTITIES DETECTED PANEL ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5">
                    <h3 className="text-[12px] font-bold text-ivory uppercase tracking-wider border-b border-white/[0.04] pb-2">ENTITIES DETECTED</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-[11.5px] font-mono">
                      
                      {/* Customers Mentioned */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Customers Mentioned</span>
                        {selectedDoc.entities.customers.map((c) => (
                          <span key={c} className="mt-1.5 block font-bold text-gold flex items-center gap-1">
                            <Lock size={10} className="text-gold" /> {c}
                          </span>
                        ))}
                      </div>

                      {/* Contracts Referenced */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Contracts Referenced</span>
                        {selectedDoc.entities.contracts.map((cn) => (
                          <span key={cn} className="mt-1.5 block text-ivory/80 font-bold">
                            #{cn}
                          </span>
                        ))}
                      </div>

                      {/* Financial Values */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Financial Values</span>
                        <div className="space-y-1 mt-1.5">
                          {selectedDoc.entities.financialValues.map((val) => (
                            <span key={val} className="block text-emerald font-semibold text-[11px]">
                              {val}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Important Dates */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Action Items Detected</span>
                        <div className="space-y-1 mt-1.5">
                          {selectedDoc.entities.actions.map((act) => (
                            <span key={act} className="block text-ivory/80 text-[10.5px]">
                              • {act}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── DOCUMENT RELATIONSHIPS HUB ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5" id="document-relationships">
                    <div className="flex items-center gap-1.5 border-b border-white/[0.04] pb-2 text-ivory">
                      <Link2 size={13} className="text-gold" />
                      <h3 className="text-[12px] font-bold uppercase tracking-wider">DOCUMENT RELATIONSHIPS</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mt-4">
                      
                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Customer</span>
                        <p className="text-[12px] font-bold text-gold mt-1 hover:underline cursor-pointer flex items-center gap-1">
                          {selectedDoc.relationships.relatedCustomer.name} <ExternalLink size={10} />
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Contract Code</span>
                        <p className="text-[12px] font-mono text-ivory/80 mt-1 font-bold">
                          {selectedDoc.relationships.relatedContract}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Operational Workflow</span>
                        <p className="text-[12px] text-ivory/80 mt-1">
                          {selectedDoc.relationships.relatedWorkflow}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Employee</span>
                        <p className="text-[12px] text-ivory/80 mt-1 flex items-center gap-1">
                          <User size={11} className="text-gold/70" /> {selectedDoc.relationships.relatedEmployee}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Ledger Transaction</span>
                        <p className="text-[12px] font-mono text-emerald mt-1 font-semibold">
                          {selectedDoc.relationships.relatedTransaction}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Board Decision</span>
                        <p className="text-[12px] text-ivory/80 mt-1">
                          {selectedDoc.relationships.relatedDecision}
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* ── TWO-COLUMN BOTTOM SUB-SECTION: DOCUMENT MEMORY Q&A ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5">
                    <h4 className="text-[12px] font-bold text-ivory uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1">
                      <HelpCircle size={13} className="text-gold" /> DOCUMENT MEMORY QUERY
                    </h4>
                    <p className="text-[10.5px] text-ivory/40 mt-1.5 font-mono">Ask standard or custom questions to interrogate legal parameters.</p>
                    
                    {/* Interactive Suggestion Prompts */}
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {suggestedQueries.map((sq, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendQuery(sq)}
                          className="rounded bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-gold/30 px-2.5 py-1 text-[11px] font-mono text-ivory/70 hover:text-gold transition-colors text-left"
                        >
                          {sq}
                        </button>
                      ))}
                    </div>

                    {/* Chat Logs */}
                    <div className="mt-4 bg-white/[0.01] border border-white/[0.03] rounded-lg p-3 max-h-[220px] overflow-y-auto space-y-3.5 scrollbar-none">
                      {currentChats.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 text-[11.5px] font-mono ${msg.role === "user" ? "justify-end text-right" : "justify-start text-left"}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            msg.role === "user" 
                              ? "bg-gold/15 border border-gold/30 text-gold" 
                              : "bg-white/[0.02] border border-white/[0.04] text-ivory/90"
                          }`}>
                            <p className="text-[9px] text-ivory/40 uppercase font-semibold mb-0.5">{msg.role === "user" ? "YOU" : "APEX ONE SYSTEM"}</p>
                            <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                          </div>
                        </div>
                      ))}

                      {thinking && (
                        <div className="flex gap-2 text-[11.5px] font-mono justify-start items-center">
                          <RefreshCw size={11} className="animate-spin text-gold" />
                          <span className="text-ivory/40 animate-pulse">Scanning document indexes...</span>
                        </div>
                      )}

                      {currentChats.length === 0 && !thinking && (
                        <p className="text-center py-6 text-[11px] font-mono text-ivory/20 italic">No queries active. Ask a contract question above.</p>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        placeholder="Interrogate document (e.g. What obligations exist in this agreement?)..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendQuery(chatInput)}
                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-ivory focus:outline-none focus:border-gold/50 placeholder:text-ivory/30"
                      />
                      <button
                        onClick={() => handleSendQuery(chatInput)}
                        className="rounded-lg bg-gold hover:bg-gold-gradient text-matte font-bold px-4 py-2 text-[12px] flex items-center justify-center gap-1 transition-colors"
                      >
                        <Send size={12} /> Ask
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
          )}

        </div>

      </div>

    </div>
  );
}
