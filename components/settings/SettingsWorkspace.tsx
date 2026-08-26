"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Sliders,
  Users,
  Database,
  Lock,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  Zap,
  Globe,
  RefreshCw,
  Cpu,
  Key,
  Layers,
  ChevronRight,
  Info,
  SlidersHorizontal,
  FileSpreadsheet,
  Check,
  Plus
} from "lucide-react";
import clsx from "clsx";
import SettingsHeader from "./SettingsHeader";
import { useOrganization } from "@/components/layout/OrganizationContext";

type ControlTabId = "identity" | "roles" | "intelligence" | "data" | "security" | "governance" | "audit";

interface AuditLogEntry {
  id: string;
  who: string;
  what: string;
  when: string;
  prevValue: string;
  newValue: string;
  status: "Auto-Approved" | "Pending CEO Signoff" | "Ratified";
}

export default function SettingsWorkspace() {
  const { organization } = useOrganization();
  const [activeTab, setActiveTab] = useState<ControlTabId>("intelligence");

  // AI Governance counts matching spec exactly
  const [autonomousActions, setAutonomousActions] = useState(18);
  const [humanApprovalRequired, setHumanApprovalRequired] = useState(7);
  const [restrictedActions, setRestrictedActions] = useState(4);

  // Stateful interactive parameters
  const [confidenceThreshold, setConfidenceThreshold] = useState(90);
  const [aiAutonomousState, setAiAutonomousState] = useState(true);
  const [requireMultiRoleSla, setRequireMultiRoleSla] = useState(true);
  const [nairaApprovalLimit, setNairaApprovalLimit] = useState(() => `${organization.locale.currencySymbol}50M`);

  // Multi-Factor Auth State
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [geoFencingEnabled, setGeoFencingEnabled] = useState(false);

  // Sync Interval
  const [syncFrequency, setSyncFrequency] = useState("Real-Time (Apex Sync)");

  // Live Audit Trail State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => [
    {
      id: "log-init",
      who: "System Administrator",
      what: "Identity: Initialized Single-Tenant Gateway",
      when: "Initial Setup",
      prevValue: "Uninitialized",
      newValue: "Production Active",
      status: "Ratified"
    }
  ]);

  // Feed update helper
  const addAuditLog = (what: string, prev: string, next: string) => {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      who: "Administrator",
      what,
      when: "Just now",
      prevValue: prev,
      newValue: next,
      status: "Auto-Approved"
    };
    setAuditLogs((prevLogs) => [entry, ...prevLogs]);
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value);
    const prev = `${confidenceThreshold}%`;
    setConfidenceThreshold(newVal);
    addAuditLog("AI Threshold: Signal Trigger Confidence Minimum", prev, `${newVal}%`);
  };

  const handleAutonomousToggle = () => {
    const nextVal = !aiAutonomousState;
    setAiAutonomousState(nextVal);
    addAuditLog("AI Behavior: Autonomous Agent Actions State", aiAutonomousState ? "Active" : "Disabled", nextVal ? "Active" : "Disabled");
    
    // Dynamically shift values
    if (nextVal) {
      setAutonomousActions(18);
      setHumanApprovalRequired(7);
    } else {
      setAutonomousActions(4);
      setHumanApprovalRequired(21);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-1" id="organizational-control-center">
      <SettingsHeader />

      {/* DENSE TOP AI GOVERNANCE STATUS METRIC GRID (AI GOVERNANCE PANEL) */}
      <div className="rounded-2xl border border-gold/20 bg-gold/[0.01] p-5 shadow-glass relative overflow-hidden">
        <div className="absolute top-0 right-0 h-48 w-48 bg-gold/[0.02] rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Cpu className="text-gold animate-pulse" size={18} />
            <div>
              <p className="text-[12.5px] font-mono font-bold text-ivory uppercase tracking-wider">AI GOVERNANCE MONITOR</p>
              <p className="text-[11px] text-ivory/45">Enforces strict parameter guardrails on all background agent loops.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-mono text-emerald uppercase tracking-wider font-bold">
            All Agent Actions Policy Bound
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.01] p-4 text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald/60">Autonomous Actions Allowed</span>
            <p className="font-display text-[26px] font-bold text-emerald font-mono mt-1">{autonomousActions}</p>
            <p className="text-[10.5px] text-ivory/45 mt-1 leading-snug">Requires 0 manual overhead. Executed on real-time parameter clearance.</p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.01] p-4 text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber/60">Human Approval Required</span>
            <p className="font-display text-[26px] font-bold text-amber font-mono mt-1">{humanApprovalRequired}</p>
            <p className="text-[10.5px] text-ivory/45 mt-1 leading-snug">Requires high-level confirmation via Apex Sync or Board interface.</p>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.01] p-4 text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400/60">Restricted Actions</span>
            <p className="font-display text-[26px] font-bold text-red-400 font-mono mt-1">{restrictedActions}</p>
            <p className="text-[10.5px] text-ivory/45 mt-1 leading-snug">Explicitly disabled due to SLA risks or regulatory constraints.</p>
          </div>
        </div>
      </div>

      {/* CORE CONTROL DESK PANEL CONTAINER */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        
        {/* LEFT COLUMN: CONTROL ROOM TABS */}
        <div className="space-y-1.5">
          {[
            { id: "intelligence", label: "Intelligence", icon: Cpu, sub: "AI Guardrails & Limits" },
            { id: "identity", label: "Organization", icon: Globe, sub: "Units, Regions & Identity" },
            { id: "roles", label: "People & Roles", icon: Users, sub: "Roles, Permissions, Seats" },
            { id: "data", label: "Data Integration", icon: Database, sub: "Synergy Sync Channels" },
            { id: "security", label: "Security Guard", icon: Lock, sub: "Access, Auth & Nodes" },
            { id: "governance", label: "Governance Desk", icon: GitBranch, sub: "Escalation & Limits" },
            { id: "audit", label: "Audit Ledger", icon: FileSpreadsheet, sub: "Trace Logs & History" }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "w-full text-left rounded-xl px-4 py-3.5 border transition-all cursor-pointer flex gap-3 items-start",
                  isSelected
                    ? "border-gold/30 bg-gold/10 text-gold shadow-gold-glow-soft"
                    : "border-transparent bg-white/[0.005] text-ivory/50 hover:bg-white/[0.03] hover:text-ivory/80"
                )}
              >
                <Icon size={16} className={clsx("mt-0.5 shrink-0", isSelected ? "text-gold" : "text-ivory/30")} />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider font-mono">{tab.label}</p>
                  <p className="text-[10px] text-ivory/40 mt-0.5 line-clamp-1">{tab.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT COLUMN: ACTIVE TAB PANEL */}
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-6 shadow-glass min-h-[480px]">
          <AnimatePresence mode="wait">
            
            {/* TAB: INTELLIGENCE PANEL */}
            {activeTab === "intelligence" && (
              <motion.div
                key="intelligence"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3">
                  <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">AI Intelligence Guardrails</h3>
                  <p className="text-[12px] text-ivory/45">Configure confidence triggers and background automated decision margins.</p>
                </div>

                <div className="space-y-5">
                  
                  {/* Slider Control */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4.5 space-y-3.5">
                    <div className="flex justify-between items-center">
                      <div style={{ paddingLeft: "3px" }}>
                        <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase tracking-wider">Confidence Signal Trigger</span>
                        <p className="text-[11px] text-ivory/40">Minimum system confidence level required to dispatch dynamic intelligence alerts to the radar.</p>
                      </div>
                      <span className="font-mono text-[14px] font-bold text-gold bg-gold/15 border border-gold/20 px-3 py-1 rounded">
                        {confidenceThreshold}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="75"
                      max="98"
                      value={confidenceThreshold}
                      onChange={handleConfidenceChange}
                      className="w-full accent-gold h-1 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-ivory/30">
                      <span>75% (Relaxed)</span>
                      <span>90% (Recommended)</span>
                      <span>98% (High Precision)</span>
                    </div>
                  </div>

                  {/* Toggle Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex justify-between items-start">
                      <div className="space-y-1 pr-4">
                        <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase">Autonomous Actions</span>
                        <p className="text-[11px] text-ivory/40">Allow AI loops to deploy mitigation workflows without human verification.</p>
                      </div>
                      <button
                        onClick={handleAutonomousToggle}
                        className={clsx(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                          aiAutonomousState ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <span
                          className={clsx(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-matte shadow ring-0 transition duration-200 ease-in-out",
                            aiAutonomousState ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex justify-between items-start">
                      <div className="space-y-1 pr-4">
                        <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase">Multi-Role Clearances</span>
                        <p className="text-[11px] text-ivory/40">Force dual-executive sign-offs on high-volatility pricing models.</p>
                      </div>
                      <button
                        onClick={() => {
                          const next = !requireMultiRoleSla;
                          setRequireMultiRoleSla(next);
                          addAuditLog("Governance: Dual-Executive Multi-Role Clearance Requirement", requireMultiRoleSla ? "Enabled" : "Disabled", next ? "Enabled" : "Disabled");
                        }}
                        className={clsx(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                          requireMultiRoleSla ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <span
                          className={clsx(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-matte shadow ring-0 transition duration-200 ease-in-out",
                            requireMultiRoleSla ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB: ORGANIZATION */}
            {activeTab === "identity" && (
              <motion.div
                key="identity"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3">
                  <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Corporate Identity & Topology</h3>
                  <p className="text-[12px] text-ivory/45">Review physical nodes, operational business segments, and region topologies.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.005] space-y-2">
                    <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">Parent Organization Identity</span>
                    <p className="text-[13.5px] font-bold text-ivory">[Not configured]</p>
                    <p className="text-[11.5px] text-ivory/50">Production Shell Node · Single-Tenant Gateway</p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.005] space-y-2.5">
                    <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">Subsidiary Units</span>
                    <p className="text-[11.5px] text-ivory/40">No subsidiaries configured.</p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.005] space-y-2.5 sm:col-span-2">
                    <span className="text-[10px] font-mono text-gold uppercase tracking-wider block">Departments & Controls</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["Risk Control", "Legal & Compliance", "Systems Engineering", "Portfolio Audit"].map((dept) => (
                        <div key={dept} className="p-2.5 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                          <p className="text-[11.5px] font-bold text-ivory font-mono">{dept}</p>
                          <p className="text-[9px] text-emerald/80 font-mono mt-0.5">Status: ACTIVE</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: PEOPLE & ROLES */}
            {activeTab === "roles" && (
              <motion.div
                key="roles"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Executive Roles & Seat Governance</h3>
                    <p className="text-[12px] text-ivory/45">Review personnel profiles, access clearance levels, and security tokens.</p>
                  </div>
                  <button
                    onClick={() => addAuditLog("People: Allocated new seat", "Active: 5", "Active: 6")}
                    className="flex items-center gap-1.5 rounded-lg bg-gold/10 border border-gold/20 text-gold px-2.5 py-1 text-[11px] font-mono hover:bg-gold/15 transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    Add Seat
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="p-6 rounded-xl border border-white/[0.04] bg-white/[0.005] text-center space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold font-mono text-[14px]">
                      ADM
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-ivory">Administrator / Session User</p>
                      <p className="text-[11px] text-ivory/45">Primary Organization Administrator · Global Access</p>
                    </div>
                    <p className="text-[11px] text-ivory/40 font-mono">Organization operating in Single-Tenant Administrator Mode.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: DATA INTEGRATIONS */}
            {activeTab === "data" && (
              <motion.div
                key="data"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Connected Infrastructure Systems</h3>
                    <p className="text-[12px] text-ivory/45">Review connection latency, sync states, and database synchronization intervals.</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded">
                    <RefreshCw size={10} className="animate-spin" />
                    Syncing
                  </div>
                </div>

                {/* Real-time synchronization frequency configuration */}
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase tracking-wider">Sync Chronology Frequency</span>
                    <p className="text-[11px] text-ivory/40">Configure database ingestion rates across Salesforce and Snowflake ledgers.</p>
                  </div>
                  <select
                    value={syncFrequency}
                    onChange={(e) => {
                      const prev = syncFrequency;
                      setSyncFrequency(e.target.value);
                      addAuditLog("Data: Database Synchronization Interval Mode", prev, e.target.value);
                    }}
                    className="rounded-lg border border-white/[0.08] bg-charcoal px-3 py-1.5 text-[11.5px] text-ivory outline-none focus:border-gold/30 font-mono"
                  >
                    <option value="Real-Time (Apex Sync)">Real-Time (Apex Sync)</option>
                    <option value="Hourly Batch Cycle">Hourly Batch Cycle</option>
                    <option value="Nightly Delta Sweep">Nightly Delta Sweep</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    { name: "Okta Identity Portal", connected: true, category: "SAML Security", latency: "14ms" },
                    { name: "Snowflake Cloud Ledger", connected: true, category: "Data Lakehouse", latency: "108ms" },
                    { name: "Salesforce CRM Core", connected: true, category: "Client Profile", latency: "45ms" },
                    { name: "DocuSign Gateway", connected: false, category: "Signatures", latency: "Offline" }
                  ].map((sys) => (
                    <div key={sys.name} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.005] flex justify-between items-center">
                      <div>
                        <p className="text-[12.5px] font-bold text-ivory">{sys.name}</p>
                        <p className="text-[10px] text-ivory/40 font-mono">{sys.category} · Latency: <strong className="text-gold">{sys.latency}</strong></p>
                      </div>
                      <span className={clsx(
                        "rounded px-2 py-0.5 text-[9px] font-mono uppercase font-bold border",
                        sys.connected
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald"
                          : "bg-white/[0.02] border-white/10 text-ivory/40"
                      )}>
                        {sys.connected ? "Connected" : "Offline"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB: SECURITY TAB */}
            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3">
                  <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Access Security & Authentication policies</h3>
                  <p className="text-[12px] text-ivory/45">Govern geofenced sub-nodes, executive multi-factor, and Okta integration models.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex justify-between items-start">
                    <div className="space-y-1 pr-4">
                      <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase">Multi-Factor SAML Auth (MFA)</span>
                      <p className="text-[11px] text-ivory/40">Force mandatory biometric or app authentications on all organizational sign-ons.</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !mfaEnabled;
                        setMfaEnabled(next);
                        addAuditLog("Security: Forced MFA Authentication Policy", mfaEnabled ? "Enabled" : "Disabled", next ? "Enabled" : "Disabled");
                      }}
                      className={clsx(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                        mfaEnabled ? "bg-gold" : "bg-white/10"
                      )}
                    >
                      <span
                        className={clsx(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-matte shadow ring-0 transition duration-200 ease-in-out",
                          mfaEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex justify-between items-start">
                    <div className="space-y-1 pr-4">
                      <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase">Geofenced Network Security Nodes</span>
                      <p className="text-[11px] text-ivory/40">Only allow connection payloads routing from designated physical operations centers.</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !geoFencingEnabled;
                        setGeoFencingEnabled(next);
                        addAuditLog("Security: Geofenced Network Node Restrictions", geoFencingEnabled ? "Active" : "Inactive", next ? "Active" : "Inactive");
                      }}
                      className={clsx(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none",
                        geoFencingEnabled ? "bg-gold" : "bg-white/10"
                      )}
                    >
                      <span
                        className={clsx(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-matte shadow ring-0 transition duration-200 ease-in-out",
                          geoFencingEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: GOVERNANCE TAB */}
            {activeTab === "governance" && (
              <motion.div
                key="governance"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="border-b border-white/[0.05] pb-3">
                  <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Decision Authority & Escalation rules</h3>
                  <p className="text-[12px] text-ivory/45">Configure financial clearance thresholds, SLA penalty limits, and escalation bypass protocols.</p>
                </div>

                <div className="space-y-4">
                  {/* Select Authority Limit */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.005] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11.5px] font-bold text-ivory block font-mono uppercase tracking-wider">Autonomous Reconciliation Limit</span>
                      <p className="text-[11px] text-ivory/40">Maximum {organization.locale.currencySymbol === "₦" ? "Naira" : "ledger"} mismatch allowed to resolve autonomously before flagging the Board.</p>
                    </div>
                    <select
                      value={nairaApprovalLimit}
                      onChange={(e) => {
                        const prev = nairaApprovalLimit;
                        setNairaApprovalLimit(e.target.value);
                        addAuditLog("Governance: Autonomous Reconciliation Limit Cap", prev, e.target.value);
                      }}
                      className="rounded-lg border border-white/[0.08] bg-charcoal px-3 py-1.5 text-[11.5px] text-ivory outline-none focus:border-gold/30 font-mono"
                    >
                      <option value={`${organization.locale.currencySymbol}10M`}>{organization.locale.currencySymbol}10M Limit</option>
                      <option value={`${organization.locale.currencySymbol}20M`}>{organization.locale.currencySymbol}20M Limit</option>
                      <option value={`${organization.locale.currencySymbol}50M`}>{organization.locale.currencySymbol}50M Limit (Standard)</option>
                      <option value={`${organization.locale.currencySymbol}100M`}>{organization.locale.currencySymbol}100M Limit (High Value)</option>
                    </select>
                  </div>

                  <div className="p-4 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl space-y-2 text-[12px]">
                    <div className="flex items-center gap-1.5 text-amber">
                      <AlertTriangle size={13} />
                      <span className="font-bold font-mono uppercase">Escalation Bypass Policy Active</span>
                    </div>
                    <p className="text-ivory/60 leading-relaxed">
                      SLA warnings and high-priority threshold alerts are instantly prioritized over general operations check-ins, bypassing routine escalation schedules.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: AUDIT LEDGER */}
            {activeTab === "audit" && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                <div className="border-b border-white/[0.05] pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-[15px] font-bold text-ivory uppercase tracking-wider">Operational Audit Trail Ledger</h3>
                    <p className="text-[12px] text-ivory/45">Durable, unalterable trace logs archiving administrative platform settings modifications.</p>
                  </div>
                  <button
                    onClick={() => {
                      setAuditLogs([]);
                      addAuditLog("Audit: Flushed temporary memory buffer", "N/A", "Complete");
                    }}
                    className="text-[10px] font-mono text-red-400 hover:underline cursor-pointer"
                  >
                    Clear History
                  </button>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl text-[12px] space-y-2 text-left">
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div>
                          <p className="font-bold text-ivory">{log.what}</p>
                          <p className="text-[10px] text-ivory/40 font-mono mt-0.5">Changed by: <strong className="text-gold/90">{log.who}</strong></p>
                        </div>
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase",
                          log.status === "Ratified"
                            ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald"
                            : "bg-white/5 border border-white/10 text-ivory/50"
                        )}>
                          {log.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-white/[0.005] p-2 rounded border border-white/[0.03] font-mono text-[11px]">
                        <div>
                          <span className="text-[9.5px] uppercase text-ivory/30 block">Previous State</span>
                          <span className="text-red-400/80 truncate block mt-0.5">{log.prevValue}</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] uppercase text-ivory/30 block">New State</span>
                          <span className="text-emerald truncate block mt-0.5">{log.newValue}</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-ivory/30 font-mono text-right">
                        Timestamp: {log.when}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
