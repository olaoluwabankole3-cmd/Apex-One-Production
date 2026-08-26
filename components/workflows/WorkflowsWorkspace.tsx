"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Clock,
  ArrowRight,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  History,
  Play,
  RotateCcw,
  ThumbsUp,
  X,
  Sliders,
  ChevronRight,
  Info,
  Lock,
  ShieldAlert,
  HelpCircle,
  Database,
  ArrowDown,
  User,
  Zap,
  Calendar,
  Check
} from "lucide-react";
import { WorkflowDef, WorkflowNode, WorkflowNodeStatus, WorkflowNodeType, WorkflowConnection } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import WorkflowsHeader from "./WorkflowsHeader";
import WorkflowCanvas from "./WorkflowCanvas";
import NodePalette from "./NodePalette";
import NodeInspector from "./NodeInspector";

// Define structured interfaces for Context-Aware Execution Logs
interface ContextAwareLog {
  trigger: { label: string; details: string; active: boolean; done: boolean };
  context: { label: string; details: string; active: boolean; done: boolean };
  aiReasoning: { label: string; details: string; active: boolean; done: boolean; content: string };
  decision: { label: string; details: string; active: boolean; done: boolean; content: string };
  action: { label: string; details: string; active: boolean; done: boolean; content: string; approvalRequired: boolean };
  outcome: { label: string; details: string; active: boolean; done: boolean; content: string };
}

// Define structured interfaces for Workflow Memory (Historical runs)
interface HistoricalRun {
  id: string;
  status: "success" | "failed" | "escalated" | "modified";
  timestamp: string;
  duration: string;
  triggeredBy: string;
  outcomeText: string;
  logs: string[];
}

interface CustomWorkflowDef extends WorkflowDef {
  businessUnit: "Enterprise Operations" | "Commercial Operations" | "Strategic Accounts" | "Customer Operations";
  contextAwareDetails: ContextAwareLog;
  history: HistoricalRun[];
}

let nodeIdCounter = 100;
function nextNodeId() {
  nodeIdCounter += 1;
  return `custom-${nodeIdCounter}`;
}

export default function WorkflowsWorkspace() {
  // Model our advanced local context-aware workflows
  const [workflowsState, setWorkflowsState] = useState<CustomWorkflowDef[]>([
    {
      id: "wf-1",
      name: "Strategic Accounts — Context-Aware Churn Prevention",
      description: "Monitors account metrics and triggers AI retention routing on decline signals.",
      subsidiary: "Strategic Accounts",
      businessUnit: "Strategic Accounts",
      status: "active",
      successRate: 95.8,
      runsPerWeek: 48,
      lastRun: "2 hours ago",
      nodes: [
        { id: "n1", type: "trigger", label: "Customer Usage Declines", subtitle: "Usage dropped >15% over 30d", x: 40, y: 50 },
        { id: "n2", type: "context", label: "Multi-Signal Context Evaluator", subtitle: "Renewal < 90d AND Tickets > 3", x: 280, y: 50 },
        { id: "n3", type: "ai_analyze", label: "AI Analyze Account Health", subtitle: "Correlate financial exposure metrics", x: 520, y: 50 },
        { id: "n4", type: "ai_predict", label: "AI Predict Churn Risk", subtitle: "Calculated risk score: 92% probability", x: 760, y: 50 },
        { id: "n5", type: "ai_recommend", label: "AI Recommend RM Routing", subtitle: "Suggest route to Elena Cho", x: 760, y: 180 },
        { id: "n6", type: "ai_decide_approval", label: "AI Decide RM Assignment", subtitle: "Awaiting Senior Sign-Off", x: 520, y: 180 },
        { id: "n7", type: "action", label: "Human Approval Desk", subtitle: "RM review & verification of proposal", x: 280, y: 180 },
        { id: "n8", type: "ai_generate", label: "AI Generate Retention Dossier", subtitle: "Create alignment briefing & script", x: 40, y: 180 },
        { id: "n9", type: "integration", label: "Google Calendar Sync", subtitle: "Auto-schedule client strategic review", x: 40, y: 310 }
      ],
      connections: [
        { id: "c1", from: "n1", to: "n2" },
        { id: "c2", from: "n2", to: "n3" },
        { id: "c3", from: "n3", to: "n4" },
        { id: "c4", from: "n4", to: "n5" },
        { id: "c5", from: "n5", to: "n6" },
        { id: "c6", from: "n6", to: "n7" },
        { id: "c7", from: "n7", to: "n8" },
        { id: "c8", from: "n8", to: "n9" }
      ],
      contextAwareDetails: {
        trigger: { label: "Trigger: Churn Signal Detect", details: "Meridian Logistics platform API logs dropped by 18.4% over 30 days.", active: false, done: false },
        context: { label: "Context: Compounding Hazards", details: "Core subscription renewal falls on Sep 14 (within 90d Limit) AND active support load holds 2 open SLA level-1 warnings.", active: false, done: false },
        aiReasoning: { label: "AI Cognitive Analysis", details: "Evaluating multi-faceted exposure vectors...", active: false, done: false, content: "CRITICAL ALERT: Compounded financial exposure model calculates a 92.4% probability of churn. Total group ARR at risk equals ₦1.84M." },
        decision: { label: "Strategic AI Recommendation", details: "Recommending premium strategic path...", active: false, done: false, content: "Deploy high-touch customer protection playbook. Route account relationship manager assignment to senior lead Elena Cho." },
        action: { label: "Action: Human Approver Signal", details: "Verifying advisor credentials...", active: false, done: false, content: "Assign Elena Cho. Await senior director execution sign-off on the generated client remediation briefing.", approvalRequired: true },
        outcome: { label: "Outcome: Enterprise Sync Completed", details: "Updating core databases...", active: false, done: false, content: "Remediation dossier archived to Knowledge Hub. Strategic alignment session scheduled in Google Calendar for Aug 20, 2026." }
      },
      history: [
        { id: "run-904", status: "success", timestamp: "Aug 18, 2026, 09:12", duration: "1.8s", triggeredBy: "System Cron", outcomeText: "Remediation scheduled with Sarah Below, Priya Nair assigned.", logs: ["Trigger: Flag raised on Sarah Below", "Context: High risk profile met", "AI Decision: Auto-assigned RM", "Outcome: Event synced"] },
        { id: "run-903", status: "modified", timestamp: "Aug 17, 2026, 14:02", duration: "2.4s", triggeredBy: "Elena Cho", outcomeText: "Assigned advisor overrode from Elena Cho to Marcus Webb", logs: ["Trigger: Manual start by Elena Cho", "AI Recommended: Elena Cho", "Human Action: Changed routing to Marcus Webb", "Outcome: Overrode success"] },
        { id: "run-902", status: "escalated", timestamp: "Aug 15, 2026, 11:30", duration: "0.9s", triggeredBy: "System Cron", outcomeText: "Escalated to Compliance Director", logs: ["Trigger: Usage Drop detect", "Context: AML audit overlap found", "AI: Critical regulatory signal", "Outcome: Blocked and Escalated"] },
        { id: "run-901", status: "failed", timestamp: "Aug 12, 2026, 08:24", duration: "3.2s", triggeredBy: "System Cron", outcomeText: "Execution aborted: external CRM timeout", logs: ["Trigger: Flag raised", "AI: Executing routing", "Error: CRM API connection lost", "Status: Failed"] }
      ]
    },
    {
      id: "wf-2",
      name: "Commercial Operations — Credit Overdraft Escalation",
      description: "Detects overdraft balance spikes and deploys compliant holds dynamically.",
      subsidiary: "Commercial Operations",
      businessUnit: "Commercial Operations",
      status: "active",
      successRate: 89.2,
      runsPerWeek: 112,
      lastRun: "1 day ago",
      nodes: [
        { id: "n1", type: "trigger", label: "Overdraft Breach Detect", subtitle: "Balance below compliance baseline", x: 40, y: 50 },
        { id: "n2", type: "context", label: "Exposure Context Evaluation", subtitle: "Overdraft > ₦10M AND history flag true", x: 280, y: 50 },
        { id: "n3", type: "ai_classify", label: "AI Classify Compliance", subtitle: "Auto-tag as High Risk Exposure", x: 520, y: 50 },
        { id: "n4", type: "ai_decide_approval", label: "AI Decide Account Hold", subtitle: "Requires legal check", x: 760, y: 50 },
        { id: "n5", type: "action", label: "Human Limit Verification", subtitle: "Apply hold parameters", x: 760, y: 180 },
        { id: "n6", type: "integration", label: "Notify Compliance Slack", subtitle: "Broadcast transaction reference", x: 520, y: 180 }
      ],
      connections: [
        { id: "c1", from: "n1", to: "n2" },
        { id: "c2", from: "n2", to: "n3" },
        { id: "c3", from: "n3", to: "n4" },
        { id: "c4", from: "n4", to: "n5" },
        { id: "c5", from: "n5", to: "n6" }
      ],
      contextAwareDetails: {
        trigger: { label: "Trigger: Balance Drop Alert", details: "Institutional account ledger registered credit drop of ₦14.5M.", active: false, done: false },
        context: { label: "Context: Credit Portfolio limits", details: "Overdraft exceeds ₦10M threshold margin AND account history reports zero prior breaches.", active: false, done: false },
        aiReasoning: { label: "AI Cognitive Analysis", details: "Calculating capital regulatory impact...", active: false, done: false, content: "MODERATE RISK: Liquidity parameters remain stable, but overdraft limit exceeds standard commercial portfolio buffers." },
        decision: { label: "AI Classification Choice", details: "Classifying exception type...", active: false, done: false, content: "Classified as TIER-2 COMMERCIAL EXPOSURE. Automated limits hold proposed pending relationship verification." },
        action: { label: "Action: Signatory Review", details: "Awaiting auditor verification...", active: false, done: false, content: "Initiate secondary credit verification with signatory lead Elena Cho. Hold status flagged as pending.", approvalRequired: true },
        outcome: { label: "Outcome: Slack Notification Broadcast", details: "Writing security notification logs...", active: false, done: false, content: "Overdraft context details broadcast to internal compliance Slack channel. Account parameters synced cleanly." }
      },
      history: [
        { id: "run-802", status: "success", timestamp: "Aug 18, 2026, 08:00", duration: "1.4s", triggeredBy: "Ledger Webhook", outcomeText: "Exception routed, verified overdraft accepted", logs: ["Trigger: Overdraft ₦12M", "Context: Checked limits", "Human Action: Accepted", "Outcome: Logged"] },
        { id: "run-801", status: "success", timestamp: "Aug 16, 2026, 17:45", duration: "1.5s", triggeredBy: "Ledger Webhook", outcomeText: "Exception routed, verified overdraft accepted", logs: ["Trigger: Overdraft ₦11M", "Context: Checked limits", "Human Action: Accepted", "Outcome: Logged"] }
      ]
    },
    {
      id: "wf-3",
      name: "Customer Operations — Claims Bottleneck Bypass",
      description: "Monitors processing queue and triggers bypass workflows dynamically.",
      subsidiary: "Customer Operations",
      businessUnit: "Customer Operations",
      status: "paused",
      successRate: 91.5,
      runsPerWeek: 15,
      lastRun: "3 days ago",
      nodes: [
        { id: "n1", type: "trigger", label: "Processing Delay Detect", subtitle: "Claims intake lag > 4 business days", x: 40, y: 50 },
        { id: "n2", type: "context", label: "SLA Severity Evaluation", subtitle: "Pending claims > ₦5M AND tier is high", x: 280, y: 50 },
        { id: "n3", type: "ai_analyze", label: "AI Analyze Queue Block", subtitle: "Locate bottlenecks & friction nodes", x: 520, y: 50 },
        { id: "n4", type: "ai_recommend", label: "AI Recommend Bypass", subtitle: "Route via Secondary Vetting", x: 760, y: 50 },
        { id: "n5", type: "ai_decide_approval", label: "AI Decide Queue Bypass", subtitle: "Awaiting Ops Director signoff", x: 760, y: 180 },
        { id: "n6", type: "action", label: "Deploy Bypass Modules", subtitle: "Human override bypass trigger", x: 520, y: 180 },
        { id: "n7", type: "integration", label: "Sync Claims Dashboard", subtitle: "Write bypass flag to core database", x: 280, y: 180 }
      ],
      connections: [
        { id: "c1", from: "n1", to: "n2" },
        { id: "c2", from: "n2", to: "n3" },
        { id: "c3", from: "n3", to: "n4" },
        { id: "c4", from: "n4", to: "n5" },
        { id: "c5", from: "n5", to: "n6" },
        { id: "c6", from: "n6", to: "n7" }
      ],
      contextAwareDetails: {
        trigger: { label: "Trigger: SLA Threshold Met", details: "Claims intake lag registers standard delay of 4.2 business days.", active: false, done: false },
        context: { label: "Context: Client SLA liabilities", details: "Total claims pending exceeds ₦5.8M ARR equivalent AND 2 high-tier enterprise accounts are impacted.", active: false, done: false },
        aiReasoning: { label: "AI Cognitive Analysis", details: "Calculating queue speed multipliers...", active: false, done: false, content: "HIGH DELAY WARNING: SLA credit penalty exposure calculated at ₦3.8M. Bottleneck traced to manual claims intake verification locks." },
        decision: { label: "AI Routing Recommendation", details: "Drafting queue acceleration pathway...", active: false, done: false, content: "Propose direct queue bypass. Reroute incoming claims profiles via Automated Claims Vetting Phase 2 module." },
        action: { label: "Action: Senior Sign-Off", details: "Verifying bypass safety protocols...", active: false, done: false, content: "Deploy Auto-Vetting module immediately. Re-allocate ₦2.1M reserves to hedge transient processing error risks.", approvalRequired: true },
        outcome: { label: "Outcome: Core Database Synchronized", details: "Writing queue status logs...", active: false, done: false, content: "Bypass modules deployed successfully. Claims intake buffer reduced back to 1.8 hours. Core stats synced to dashboard." }
      },
      history: [
        { id: "run-702", status: "success", timestamp: "Aug 18, 2026, 02:30", duration: "1.9s", triggeredBy: "Scheduler", outcomeText: "Bypass deployed, processing speeds restored", logs: ["Trigger: Intake delay > 4d", "AI Recommended: Deploy bypass", "Human Action: Approved", "Outcome: Speed restored"] },
        { id: "run-701", status: "modified", timestamp: "Aug 14, 2026, 11:15", duration: "2.1s", triggeredBy: "Marcus Webb", outcomeText: "Bypass triggered manually by Marcus Webb ahead of schedule", logs: ["Trigger: Manual start", "AI: Proposed bypass delay check", "Human Action: Immediate override", "Outcome: Deployed bypass"] }
      ]
    },
    {
      id: "wf-4",
      name: "Enterprise Operations — Audit Exception Reconciliation",
      description: "Auto-flags nightly audit reconciliation mismatches and proposes corrections.",
      subsidiary: "Enterprise Operations",
      businessUnit: "Enterprise Operations",
      status: "draft",
      successRate: 78.4,
      runsPerWeek: 7,
      lastRun: "6 days ago",
      nodes: [
        { id: "n1", type: "trigger", label: "Nightly Reconciliation Run", subtitle: "00:00 UTC database batch job", x: 40, y: 50 },
        { id: "n2", type: "condition", label: "Mismatch Detected?", subtitle: "Core bank vs ledger statements", x: 280, y: 50 },
        { id: "n3", type: "ai_analyze", label: "AI Analyze Discrepancy", subtitle: "Cross-reference logs and exceptions", x: 520, y: 50 },
        { id: "n4", type: "ai_predict", label: "AI Predict Matching Source", subtitle: "Probability of standard ledger code", x: 760, y: 50 },
        { id: "n5", type: "ai_decide_approval", label: "AI Recommend Auto-Reconcile", subtitle: "Awaiting Finance Auditor verify", x: 760, y: 180 },
        { id: "n6", type: "action", label: "Apply Auto-Reconciliation", subtitle: "Write back corrections", x: 520, y: 180 }
      ],
      connections: [
        { id: "c1", from: "n1", to: "n2" },
        { id: "c2", from: "n2", to: "n3" },
        { id: "c3", from: "n3", to: "n4" },
        { id: "c4", from: "n4", to: "n5" },
        { id: "c5", from: "n5", to: "n6" }
      ],
      contextAwareDetails: {
        trigger: { label: "Trigger: Mismatch Detected", details: "Core accounting reconciliation run outputs 1 balance exception discrepancy.", active: false, done: false },
        context: { label: "Context: Nightly Audit Logs", details: "Discrepancy amount equals ₦1.12M. Transaction matches retail interest deposits pattern.", active: false, done: false },
        aiReasoning: { label: "AI Cognitive Analysis", details: "Comparing against historical exception patterns...", active: false, done: false, content: "LOW EXPOSURE WARNING: Pattern match indicates a standard timezone settlement delay. No regulatory reporting exposure." },
        decision: { label: "AI Auto-Reconcile Choice", details: "Recommending clearing adjustment...", active: false, done: false, content: "Generate settlement clearance journal entry. Propose auto-reconciliation parameters." },
        action: { label: "Action: Auditor Verification", details: "Awaiting ledger signoff...", active: false, done: false, content: "Finance Auditor manual reconciliation verification required to sync ledger parameters.", approvalRequired: true },
        outcome: { label: "Outcome: Ledger Synchronized", details: "Writing batch ledger data...", active: false, done: false, content: "Exception cleared. Core accounting systems updated cleanly, regulatory file updated." }
      },
      history: [
        { id: "run-602", status: "success", timestamp: "Aug 18, 2026, 00:05", duration: "1.5s", triggeredBy: "Scheduler", outcomeText: "Exception corrected, ledger adjusted", logs: ["Trigger: Nightly discrepancy", "AI Recommended: timezone settlement offset", "Human Action: Auditor approved", "Outcome: Sync completed"] },
        { id: "run-601", status: "failed", timestamp: "Aug 17, 2026, 00:05", duration: "3.5s", triggeredBy: "Scheduler", outcomeText: "Aborted: database lock wait threshold exceeded", logs: ["Trigger: Nightly discrepancy", "Status: Failed DB lock timeout"] }
      ]
    }
  ]);

  const [selectedId, setSelectedId] = useState<string>("wf-1");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Simulation execution state
  const [running, setRunning] = useState<boolean>(false);
  const [ranJustNow, setRanJustNow] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, WorkflowNodeStatus>>({});

  // Human approval interlock state
  const [awaitingApproval, setAwaitingApproval] = useState<boolean>(false);
  const [approvalDecision, setApprovalDecision] = useState<string | null>(null);

  // Keep track of dynamically updated simulation context aware logs
  const [currentLogs, setCurrentLogs] = useState<ContextAwareLog | null>(null);

  const selectedWorkflow = useMemo(() => {
    return workflowsState.find((w) => w.id === selectedId) || workflowsState[0];
  }, [workflowsState, selectedId]);

  // Sync current workflow's context logs on change
  useEffect(() => {
    setCurrentLogs(JSON.parse(JSON.stringify(selectedWorkflow.contextAwareDetails)));
    setNodeStatuses({});
    setSimulationStep(0);
    setRunning(false);
    setRanJustNow(false);
    setAwaitingApproval(false);
    setApprovalDecision(null);
    setSelectedNodeId(null);
  }, [selectedWorkflow]);

  const handleSelectWorkflow = (id: string) => {
    setSelectedId(id);
  };

  const updateWorkflow = (updated: CustomWorkflowDef) => {
    setWorkflowsState((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const handleNodesChange = (nodes: WorkflowNode[]) => {
    updateWorkflow({ ...selectedWorkflow, nodes });
  };

  const handleAddNode = (type: WorkflowNodeType) => {
    const id = nextNodeId();
    const count = selectedWorkflow.nodes.length;
    const newNode: WorkflowNode = {
      id,
      type,
      label: `New ${type.replace("_", " ")}`,
      subtitle: "Click to configure step",
      x: 100 + (count % 4) * 60,
      y: 120 + Math.floor(count / 4) * 90,
    };
    updateWorkflow({ ...selectedWorkflow, nodes: [...selectedWorkflow.nodes, newNode] });
    setSelectedNodeId(id);
  };

  const handleDeleteNode = (id: string) => {
    updateWorkflow({
      ...selectedWorkflow,
      nodes: selectedWorkflow.nodes.filter((n) => n.id !== id),
      connections: selectedWorkflow.connections.filter((c) => c.from !== id && c.to !== id),
    });
    setSelectedNodeId(null);
  };

  const handleUpdateNode = (id: string, updates: Partial<WorkflowNode>) => {
    updateWorkflow({
      ...selectedWorkflow,
      nodes: selectedWorkflow.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    });
  };

  // Run the sequential simulated workflow execution
  const handleRun = () => {
    if (running) return;
    setRunning(true);
    setRanJustNow(false);
    setAwaitingApproval(false);
    setApprovalDecision(null);
    setSimulationStep(1);

    // Initial state setup: reset nodes and context logs
    setNodeStatuses({});
    const freshLogs = JSON.parse(JSON.stringify(selectedWorkflow.contextAwareDetails));
    setCurrentLogs(freshLogs);

    // Step 1: Trigger Node Active
    const triggerNode = selectedWorkflow.nodes.find((n) => n.type === "trigger");
    if (triggerNode) {
      setNodeStatuses({ [triggerNode.id]: "running" });
      freshLogs.trigger.active = true;
      setCurrentLogs({ ...freshLogs });
    }

    // Launch simulated progression
    progressSimulation(1, triggerNode?.id || "", freshLogs);
  };

  // Advanced sequential progression mapping through nodes
  const progressSimulation = (step: number, prevNodeId: string, logsState: ContextAwareLog) => {
    const stepDuration = 800;

    setTimeout(() => {
      // Resolve previous node status to success
      if (prevNodeId) {
        setNodeStatuses((prev) => ({ ...prev, [prevNodeId]: "success" }));
      }

      // Progression Steps
      if (step === 1) {
        // Step 2: Context Node
        const contextNode = selectedWorkflow.nodes.find((n) => n.type === "context" || n.type === "condition");
        if (contextNode) {
          setNodeStatuses((prev) => ({ ...prev, [contextNode.id]: "running" }));
          logsState.trigger.done = true;
          logsState.trigger.active = false;
          logsState.context.active = true;
          setCurrentLogs({ ...logsState });
          setSimulationStep(2);
          progressSimulation(2, contextNode.id, logsState);
        } else {
          progressSimulation(2, "", logsState);
        }
      } else if (step === 2) {
        // Step 3: AI Cognitive Reasoning (Analyze / Classify)
        const aiNode = selectedWorkflow.nodes.find((n) => n.type === "ai_analyze" || n.type === "ai_classify" || n.type === "ai");
        if (aiNode) {
          setNodeStatuses((prev) => ({ ...prev, [aiNode.id]: "running" }));
          logsState.context.done = true;
          logsState.context.active = false;
          logsState.aiReasoning.active = true;
          setCurrentLogs({ ...logsState });
          setSimulationStep(3);
          progressSimulation(3, aiNode.id, logsState);
        } else {
          progressSimulation(3, "", logsState);
        }
      } else if (step === 3) {
        // Step 4: AI Decision (Recommend / Predict)
        const decisionNode = selectedWorkflow.nodes.find((n) => n.type === "ai_predict" || n.type === "ai_recommend");
        if (decisionNode) {
          setNodeStatuses((prev) => ({ ...prev, [decisionNode.id]: "running" }));
          logsState.aiReasoning.done = true;
          logsState.aiReasoning.active = false;
          logsState.decision.active = true;
          setCurrentLogs({ ...logsState });
          setSimulationStep(4);
          progressSimulation(4, decisionNode.id, logsState);
        } else {
          progressSimulation(4, "", logsState);
        }
      } else if (step === 4) {
        // Step 5: Human Approval check node (AI Decide with Approval)
        const approvalNode = selectedWorkflow.nodes.find((n) => n.type === "ai_decide_approval");
        if (approvalNode) {
          setNodeStatuses((prev) => ({ ...prev, [approvalNode.id]: "running" }));
          logsState.decision.done = true;
          logsState.decision.active = false;
          logsState.action.active = true;
          setCurrentLogs({ ...logsState });
          setSimulationStep(5);

          // PAUSE FOR HUMAN INTERLOCK AND PUSH STATE
          setAwaitingApproval(true);
        } else {
          progressSimulation(5, "", logsState);
        }
      }
    }, stepDuration);
  };

  // Human approval desk resolution trigger
  const resolveHumanApproval = (approved: boolean, customAdvisor?: string) => {
    setAwaitingApproval(false);
    const approvedName = customAdvisor || "Elena Cho";
    setApprovalDecision(approved ? `Approved: Routing to ${approvedName}` : `Modified & Scaled: Routed to Marcus Webb`);

    const updatedLogs = JSON.parse(JSON.stringify(currentLogs));
    if (updatedLogs) {
      updatedLogs.action.done = true;
      updatedLogs.action.active = false;
      if (!approved) {
        updatedLogs.action.content = `OVERRIDDEN BY DIRECTOR: Assignment parameters changed. Route mapped directly to Marcus Webb (Senior Risk Lead) manually.`;
      }
      updatedLogs.outcome.active = true;
      setCurrentLogs({ ...updatedLogs });
    }

    // Resolve Approval Node and progress to final Action, Generate & Integration nodes
    const approvalNode = selectedWorkflow.nodes.find((n) => n.type === "ai_decide_approval");
    if (approvalNode) {
      setNodeStatuses((prev) => ({ ...prev, [approvalNode.id]: "success" }));
    }

    // Finish simulation by lighting remaining outcome nodes sequential
    let delay = 600;
    const remainingTypes: WorkflowNodeType[] = ["action", "ai_generate", "integration"];

    remainingTypes.forEach((type, index) => {
      const node = selectedWorkflow.nodes.find((n) => n.type === type);
      if (node) {
        setTimeout(() => {
          setNodeStatuses((prev) => ({ ...prev, [node.id]: "running" }));
          setTimeout(() => {
            setNodeStatuses((prev) => ({ ...prev, [node.id]: "success" }));
          }, 350);
        }, delay);
        delay += 550;
      }
    });

    setTimeout(() => {
      if (updatedLogs) {
        updatedLogs.outcome.done = true;
        updatedLogs.outcome.active = false;
        setCurrentLogs({ ...updatedLogs });
      }

      setRunning(false);
      setRanJustNow(true);
      setSimulationStep(6);

      // Create a brand new execution history item in memory
      const timestampText = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });

      const newHistoryItem: HistoricalRun = {
        id: `run-${Date.now().toString().slice(-3)}`,
        status: approved ? "success" : "modified",
        timestamp: timestampText,
        duration: "2.1s",
        triggeredBy: "CEO Approval Desk",
        outcomeText: approved 
          ? `Executed: Assigned senior RM ${approvedName} and synchronized scheduled session.`
          : "Modified: Overrode automated assignment and routed parameters to Marcus Webb.",
        logs: [
          "Trigger: Churn prevention auto-start",
          "Context: Complex criteria successfully met",
          approved ? `Approved assignment: ${approvedName}` : "Director Manual Override: routed to Marcus Webb",
          "Outcome: Calendar synchronized"
        ]
      };

      updateWorkflow({
        ...selectedWorkflow,
        history: [newHistoryItem, ...selectedWorkflow.history]
      });

      setTimeout(() => setRanJustNow(false), 2500);
    }, delay + 200);
  };

  const selectedNode = selectedWorkflow.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="space-y-6" id="workflows-redesign-workspace">
      
      {/* 1. HEADER BAR */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
            APEX ONE
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
            Workflows Intelligence
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ivory/50">
            Design and audit multi-node context-aware automations combining live metrics, cognitive reasoning, and human-in-the-loop sign-off.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 text-[12.5px] font-mono text-gold/80">
          <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
          Autonomous Engine: <span className="font-bold text-ivory">Active & Synchronized</span>
        </div>
      </div>

      {!isDemoMode() ? (
        <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-12 text-center shadow-glass max-w-2xl mx-auto my-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/5 border border-gold/15 text-gold mb-5">
            <Zap size={24} className="animate-pulse" />
          </div>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-ivory uppercase">
            No Workflows Configured
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ivory/55">
            Create your first workflow to orchestrate multi-node autonomous operations, cognitive decisions, and API triggers across systems.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
              0 Active Pipelines
            </span>
            <span className="rounded-lg bg-white/[0.02] border border-white/[0.08] px-4 py-2 text-[11px] font-mono text-ivory/40 uppercase tracking-wider">
              Connect CRM Trigger
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* 2. GRID ARCHITECTURE: LEFT WORKFLOWS LIST, MIDDLE BUILDER CANVAS, RIGHT CONTEXT-AWARE INTELLIGENCE */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_360px]" id="builder-grid-system">
        
        {/* COLUMN A: WORKFLOW LIBRARY LIST */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 shadow-glass overflow-hidden">
            <div className="border-b border-white/[0.06] p-4 bg-white/[0.01]">
              <p className="font-display text-[13px] font-bold text-ivory uppercase tracking-wider">Workflow Library</p>
              <p className="mt-1 text-[11.5px] text-ivory/40">{workflowsState.length} Cognitive Nodes active</p>
            </div>

            <div className="p-2.5 space-y-2 max-h-[460px] overflow-y-auto scrollbar-none">
              {workflowsState.map((wf) => {
                const isActive = wf.id === selectedId;
                const isPaused = wf.status === "paused";
                const isDraft = wf.status === "draft";
                return (
                  <button
                    key={wf.id}
                    onClick={() => handleSelectWorkflow(wf.id)}
                    className={`w-full rounded-xl p-3 text-left transition-all border ${
                      isActive 
                        ? "bg-white/[0.05] border-gold/40 shadow-gold-glow-soft" 
                        : "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-[12.5px] font-bold leading-snug text-ivory">{wf.name}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.1 text-[9px] font-mono border uppercase ${
                        isPaused 
                          ? "text-ivory/40 border-white/10 bg-white/5" 
                          : isDraft 
                            ? "text-amber border-amber/20 bg-amber/5" 
                            : "text-emerald border-emerald/20 bg-emerald/5"
                      }`}>
                        {wf.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-gold font-mono font-medium tracking-wide uppercase">{wf.businessUnit}</p>
                    <p className="mt-1 text-[11px] text-ivory/40 truncate">{wf.description}</p>
                    
                    <div className="mt-3 flex items-center justify-between text-[10px] text-ivory/30 font-mono">
                      <span>{wf.successRate}% Success</span>
                      <span>{wf.runsPerWeek}/wk</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PALETTE */}
          <NodePalette onAddNode={handleAddNode} />
        </div>

        {/* COLUMN B: MAIN VISUAL CANVAS & TOOLBAR */}
        <div className="space-y-4">
          
          {/* TOOLBAR PANEL */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass lg:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/20 px-2 py-0.5 rounded uppercase">
                  {selectedWorkflow.businessUnit}
                </span>
                <h2 className="font-display text-[16px] font-bold text-ivory truncate">{selectedWorkflow.name}</h2>
              </div>
              <p className="mt-1 text-[11.5px] text-ivory/45 leading-relaxed">{selectedWorkflow.description}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRun}
                disabled={running}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-mono font-bold transition-all duration-200 cursor-pointer ${
                  running
                    ? "cursor-not-allowed bg-white/5 border border-white/10 text-ivory/30"
                    : ranJustNow
                      ? "bg-emerald/15 border border-emerald/30 text-emerald"
                      : "bg-gold text-matte hover:shadow-gold-glow border border-gold/40"
                }`}
              >
                {running ? (
                  <>
                    <RotateCcw size={13} className="animate-spin text-gold" />
                    Running Simulation…
                  </>
                ) : ranJustNow ? (
                  <>
                    <CheckCircle2 size={13} />
                    Sync Verified
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    Run Workflow
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DRAGGABLE VISUAL CANVAS */}
          <WorkflowCanvas
            nodes={selectedWorkflow.nodes}
            connections={selectedWorkflow.connections}
            nodeStatuses={nodeStatuses}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onNodesChange={handleNodesChange}
          />

          {/* NODE PROPERTIES INSPECTOR */}
          <NodeInspector
            node={selectedNode}
            status={selectedNodeId ? nodeStatuses[selectedNodeId] : undefined}
            onDelete={handleDeleteNode}
            onUpdateNode={handleUpdateNode}
          />

        </div>

        {/* COLUMN C: INTERACTIVE CONTEXT-AWARE INTELLIGENCE HUB */}
        <div className="space-y-4">
          
          {/* 1. CONTEXT-AWARE AUTOMATION PANEL */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-3">
              <Sparkles size={14} className="text-gold" />
              <p className="font-display text-[13px] font-bold text-ivory uppercase tracking-wider">Context-Aware Engine</p>
            </div>

            {/* Simulated Live Logging progressions */}
            <div className="space-y-3">
              
              {/* Trigger Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.trigger.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.trigger.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.trigger.label}</span>
                  {currentLogs?.trigger.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.trigger.done && <Check size={11} className="text-emerald" />}
                </div>
                <p className="text-[10px] font-mono mt-1 leading-normal text-ivory/45">{currentLogs?.trigger.details}</p>
              </div>

              {/* Context Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.context.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.context.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.context.label}</span>
                  {currentLogs?.context.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.context.done && <Check size={11} className="text-emerald" />}
                </div>
                <p className="text-[10px] font-mono mt-1 leading-normal text-ivory/45">{currentLogs?.context.details}</p>
              </div>

              {/* AI Reasoning Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.aiReasoning.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.aiReasoning.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.aiReasoning.label}</span>
                  {currentLogs?.aiReasoning.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.aiReasoning.done && <Check size={11} className="text-emerald" />}
                </div>
                {currentLogs?.aiReasoning.done || currentLogs?.aiReasoning.active ? (
                  <p className="text-[10px] font-mono mt-1.5 leading-relaxed text-gold/80 bg-gold/5 p-1.5 rounded border border-gold/10">
                    {currentLogs?.aiReasoning.content}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono mt-1 text-ivory/30">{currentLogs?.aiReasoning.details}</p>
                )}
              </div>

              {/* Decision Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.decision.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.decision.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.decision.label}</span>
                  {currentLogs?.decision.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.decision.done && <Check size={11} className="text-emerald" />}
                </div>
                {currentLogs?.decision.done || currentLogs?.decision.active ? (
                  <p className="text-[10.5px] font-mono mt-1.5 leading-relaxed text-ivory/80 bg-white/5 p-1.5 rounded border border-white/5">
                    {currentLogs?.decision.content}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono mt-1 text-ivory/30">{currentLogs?.decision.details}</p>
                )}
              </div>

              {/* Action Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.action.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.action.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.action.label}</span>
                  {currentLogs?.action.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.action.done && <Check size={11} className="text-emerald" />}
                </div>
                {currentLogs?.action.done || currentLogs?.action.active ? (
                  <p className="text-[10px] font-mono mt-1.5 leading-relaxed text-ivory/80 bg-white/5 p-1.5 rounded border border-white/5">
                    {currentLogs?.action.content}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono mt-1 text-ivory/30">{currentLogs?.action.details}</p>
                )}
              </div>

              {/* Outcome Block */}
              <div className={`p-3 rounded-lg border transition-all ${
                currentLogs?.outcome.active 
                  ? "bg-gold/10 border-gold/40 shadow-gold-glow-soft" 
                  : currentLogs?.outcome.done 
                    ? "bg-emerald/[0.02] border-emerald/20 text-ivory/60" 
                    : "bg-white/[0.01] border-white/[0.03] text-ivory/30"
              }`}>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>{currentLogs?.outcome.label}</span>
                  {currentLogs?.outcome.active && <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />}
                  {currentLogs?.outcome.done && <Check size={11} className="text-emerald" />}
                </div>
                {currentLogs?.outcome.done || currentLogs?.outcome.active ? (
                  <p className="text-[10px] font-mono mt-1.5 leading-relaxed text-emerald bg-emerald/5 p-1.5 rounded border border-emerald/10">
                    {currentLogs?.outcome.content}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono mt-1 text-ivory/30">{currentLogs?.outcome.details}</p>
                )}
              </div>

            </div>
          </div>

          {/* 2. HUMAN-IN-THE-LOOP APPROVAL DESK */}
          <AnimatePresence>
            {awaitingApproval && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-gold bg-charcoal p-4.5 shadow-gold-glow space-y-4"
                id="human-approval-desk"
              >
                <div className="flex items-center gap-2 text-gold">
                  <ShieldAlert size={16} className="animate-pulse" />
                  <p className="text-[12px] font-mono font-bold uppercase tracking-wider">Awaiting Human Approval</p>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg text-[11.5px] font-mono space-y-2 text-ivory/90 leading-relaxed">
                  <div className="flex justify-between items-center text-[10px] text-ivory/40">
                    <span>AI Recommendation Confidence</span>
                    <span className="text-emerald font-bold bg-emerald/10 px-1 py-0.1 rounded">94.8% Secure</span>
                  </div>
                  <p className="font-bold text-ivory">Assign Elena Cho (Senior Advisor) to initiate preventative retention briefing.</p>
                  <p className="text-[10px] text-ivory/50">Evaluating Meridian Logistics ₦1.84M exposure potential inside Strategic Accounts.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => resolveHumanApproval(true, "Elena Cho")}
                    className="rounded-lg bg-gold hover:bg-gold-gradient text-matte font-bold py-2 text-[11px] font-mono transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 size={11} />
                    Approve Assignment
                  </button>
                  <button
                    onClick={() => resolveHumanApproval(false)}
                    className="rounded-lg bg-white/5 hover:bg-white/10 text-ivory border border-white/10 py-2 text-[11px] font-mono transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sliders size={11} className="text-gold/80" />
                    Modify Routing
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. WORKFLOW MEMORY PANEL (HISTORICAL EXECUTION ARCHIVE) */}
          <div className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-4 shadow-glass space-y-3">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 text-ivory">
              <History size={13} className="text-gold" />
              <p className="font-display text-[13px] font-bold uppercase tracking-wider">Workflow Memory</p>
            </div>
            
            <p className="text-[11px] font-mono text-ivory/40">Historical executions logs & human-modified overrides.</p>

            <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
              {selectedWorkflow.history.map((run) => (
                <div key={run.id} className="bg-white/[0.01] border border-white/[0.03] rounded-lg p-2.5 font-mono text-[10.5px]">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-ivory/50">Run #{run.id}</span>
                    <span className={`px-1 rounded uppercase font-bold text-[9px] ${
                      run.status === "success" 
                        ? "text-emerald bg-emerald/5 border border-emerald/15" 
                        : run.status === "failed" 
                          ? "text-crimson bg-crimson/5 border border-crimson/15" 
                          : run.status === "escalated" 
                            ? "text-amber bg-amber/5 border border-amber/15" 
                            : "text-gold bg-gold/5 border border-gold/15"
                    }`}>
                      {run.status === "modified" ? "Modified by Human" : run.status}
                    </span>
                  </div>
                  
                  <p className="text-ivory/80 mt-1.5 font-bold leading-relaxed">{run.outcomeText}</p>
                  
                  <div className="mt-2 text-[9px] text-ivory/30 flex items-center justify-between">
                    <span>{run.timestamp}</span>
                    <span>Elapsed: {run.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
      </>
      )}

    </div>
  );
}
