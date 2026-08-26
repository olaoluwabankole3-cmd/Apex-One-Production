"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { valueRepository } from "@/lib/data/repositories";

export type PipelineStatus = "discovered" | "validated" | "in_execution" | "pending" | "captured";

export interface ValueOpportunity {
  id: string;
  title: string;
  category: string;
  description: string;
  sourceSystem: string;
  valueAmount: number;
  status: PipelineStatus;
  confidence: number;
  probability: number; // 0-100%
  businessReason: string;
  recommendedAction: string;
  responsibleDepartment: string;
  expectedCaptureDate: string;
  impactTier: "High" | "Medium" | "Low";
}

export interface LeakageEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  leakAmount: number;
  occurrence: string;
  riskScore: number;
  status: "unplugged" | "monitoring" | "plugged";
  systemAffected: string;
  recommendedAction: string;
}

export interface CustomerValueMetric {
  id: string;
  name: string;
  tier: string;
  contractValue: number;
  potentialValue: number;
  expansionOpportunity: number;
  confidence: number;
  recommended: string;
  churnRisk: "Low" | "Medium" | "High";
  lastAuditDate: string;
}

export interface CapacityMetric {
  name: string;
  allocated: number;
  utilized: number;
  wasteValue: number;
  department: string;
  unusedHours: number;
  potentialBillableHours: number;
}

export interface ExecutionPlay {
  id: string;
  title: string;
  description: string;
  targetId: string; // ID of opportunity or leakage
  type: "opportunity" | "leakage" | "capacity" | "customer";
  estimatedGain: number;
  status: "available" | "in_progress" | "completed";
  stepsCompleted: number;
  totalSteps: number;
  logs: string[];
}

export interface CapturedLedgerEntry {
  id: string;
  date: string;
  playTitle: string;
  category: string;
  amountCaptured: number;
  impactMetrics: string;
  verifiedBy: string;
}

interface ValueEngineContextValue {
  opportunities: ValueOpportunity[];
  leakageEvents: LeakageEvent[];
  customerValues: CustomerValueMetric[];
  capacityMetrics: CapacityMetric[];
  plays: ExecutionPlay[];
  capturedLedger: CapturedLedgerEntry[];
  totalIdentified: number;
  totalCaptured: number;
  captureRate: number;
  simulatorParams: {
    pricingSensitivity: number; // 0 to 100
    slaTargetRate: number; // 0 to 100
    capacityReclaimPercent: number; // 0 to 100
    leakagePlugRate: number; // 0 to 100
  };
  setSimulatorParams: React.Dispatch<React.SetStateAction<{
    pricingSensitivity: number;
    slaTargetRate: number;
    capacityReclaimPercent: number;
    leakagePlugRate: number;
  }>>;
  executePlayStep: (playId: string) => void;
  skipPlay: (playId: string) => void;
  runAiScan: () => Promise<void>;
  updateOpportunityStatus: (id: string, status: PipelineStatus) => void;
  dismissOpportunity: (id: string) => void;
  isScanning: boolean;
  scanProgress: number;
  loading: boolean;
}

const ValueEngineContext = createContext<ValueEngineContextValue | undefined>(undefined);

export function ValueEngineProvider({ children }: { children: ReactNode }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const [opportunities, setOpportunities] = useState<ValueOpportunity[]>([]);
  const [leakageEvents, setLeakageEvents] = useState<LeakageEvent[]>([]);
  const [customerValues, setCustomerValues] = useState<CustomerValueMetric[]>([]);
  const [capacityMetrics, setCapacityMetrics] = useState<CapacityMetric[]>([]);
  const [plays, setPlays] = useState<ExecutionPlay[]>([]);
  const [capturedLedger, setCapturedLedger] = useState<CapturedLedgerEntry[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [opps, leaks, custs, caps, pls, led] = await Promise.all([
          valueRepository.getOpportunities(),
          valueRepository.getLeakageEvents(),
          valueRepository.getCustomerValues(),
          valueRepository.getCapacityMetrics(),
          valueRepository.getPlays(),
          valueRepository.getCapturedLedger()
        ]);
        setOpportunities(opps);
        setLeakageEvents(leaks);
        setCustomerValues(custs);
        setCapacityMetrics(caps);
        setPlays(pls);
        setCapturedLedger(led);
      } catch (err) {
        console.error("Failed to load value engine data from repository:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const [simulatorParams, setSimulatorParams] = useState({
    pricingSensitivity: 35,
    slaTargetRate: 98,
    capacityReclaimPercent: 45,
    leakagePlugRate: 75,
  });

  const updateOpportunityStatus = (id: string, status: PipelineStatus) => {
    setOpportunities((prevOpps) => {
      const updated = prevOpps.map((opp) => (opp.id === id ? { ...opp, status } : opp));
      
      if (status === "captured") {
        const opp = prevOpps.find((o) => o.id === id);
        if (opp) {
          setCapturedLedger((prevLedger) => {
            if (prevLedger.some((l) => l.playTitle.includes(opp.title))) return prevLedger;
            const today = new Date().toISOString().split("T")[0];
            return [
              {
                id: `cap-${Date.now()}`,
                date: today,
                playTitle: `Direct Value Recapture: ${opp.title}`,
                category: opp.category === "Revenue Leakage" || opp.category === "Leakage" ? "Revenue Recovered" : "Cost Avoided",
                amountCaptured: opp.valueAmount,
                impactMetrics: `Manually executed board action to recapture ${opp.title} value.`,
                verifiedBy: "Yusuf Alao (CFO Office)",
              },
              ...prevLedger,
            ];
          });
        }
      }
      return updated;
    });
  };

  const dismissOpportunity = (id: string) => {
    setOpportunities((prevOpps) => prevOpps.filter((opp) => opp.id !== id));
  };

  const executePlayStep = (playId: string) => {
    setPlays((prevPlays) =>
      prevPlays.map((play) => {
        if (play.id !== playId) return play;

        const nextStep = play.stepsCompleted + 1;
        const isCompleted = nextStep >= play.totalSteps;
        const newLogs = [...play.logs];

        if (nextStep === 1) {
          newLogs.push("Establishing secure API tunnel...");
        } else if (nextStep === 2) {
          newLogs.push("Auditing environment matching variables...");
        } else if (nextStep === 3 && !isCompleted) {
          newLogs.push("Enforcing guardrails and executing trigger...");
        }

        if (isCompleted) {
          newLogs.push("Value Capture Play EXECUTED successfully.");
          newLogs.push("Verifying value retention in live telemetry...");
          newLogs.push("Value captured and routed to Finance Ledger.");

          // If completed, update related opportunity status
          if (play.type === "opportunity" || play.type === "capacity") {
            setOpportunities((prevOpps) =>
              prevOpps.map((o) => (o.id === play.targetId ? { ...o, status: "captured" } : o))
            );
          } else if (play.type === "leakage") {
            setLeakageEvents((prevLeaks) =>
              prevLeaks.map((l) => (l.id === play.targetId ? { ...l, status: "plugged" } : l))
            );
          }

          // Add to captured ledger
          const today = new Date().toISOString().split("T")[0];
          setCapturedLedger((prevLedger) => [
            {
              id: `cap-${Date.now()}`,
              date: today,
              playTitle: play.title,
              category: play.type === "leakage" ? "Revenue Recovered" : "Cost Avoided",
              amountCaptured: play.estimatedGain,
              impactMetrics: `Automated playbook executed to fully resolve targeted waste and leakage.`,
              verifiedBy: "APEX AI Smart Validator",
            },
            ...prevLedger,
          ]);
        }

        return {
          ...play,
          status: isCompleted ? "completed" : "in_progress",
          stepsCompleted: nextStep,
          logs: newLogs,
        };
      })
    );
  };

  const skipPlay = (playId: string) => {
    setPlays((prevPlays) => prevPlays.filter((p) => p.id !== playId));
  };

  const runAiScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Wait until progress hits 100
    await new Promise((resolve) => setTimeout(resolve, 2200));
    setIsScanning(false);

    // Add a newly discovered opportunity!
    const newId = `opp-gen-${Date.now()}`;
    const newOpportunity: ValueOpportunity = {
      id: newId,
      title: "REDUNDANT WEST AFRICA EDGE SERVERS",
      category: "Software Optimization",
      description: "Scanning of development environment identified 4 redundant West Africa edge servers routing stale traffic.",
      sourceSystem: "Operations (API Gateway Logs)",
      valueAmount: 8900000, // ₦8.9M
      status: "discovered",
      confidence: 94,
      probability: 80,
      businessReason: "Inactive networking nodes and stale edge server clusters racking up redundant host fees.",
      recommendedAction: "Consolidate edge pathways and trigger safe server block teardown.",
      responsibleDepartment: "Infrastructure Team",
      expectedCaptureDate: "2026-10-01",
      impactTier: "Low",
    };

    setOpportunities((prev) => {
      if (prev.some((o) => o.title === newOpportunity.title)) return prev;
      return [newOpportunity, ...prev];
    });

    // Add a corresponding play
    setPlays((prev) => [
      {
        id: `play-gen-${Date.now()}`,
        title: "Teardown Stale Edge Servers",
        description: "Migrate historical paths to the unified microservices cluster and execute safe teardown of stale nodes.",
        targetId: newId,
        type: "opportunity",
        estimatedGain: 8900000,
        status: "available",
        stepsCompleted: 0,
        totalSteps: 3,
        logs: [
          "Play initialized.",
          "Stale networks traced.",
          "Teardown scripts prepared."
        ],
      },
      ...prev,
    ]);
  };

  const totalIdentified = opportunities
    .filter((o) => o.status !== "captured")
    .reduce((acc, o) => acc + o.valueAmount, 0);

  const totalCaptured = capturedLedger.reduce((acc, c) => acc + c.amountCaptured, 0);

  const captureRate = totalCaptured + totalIdentified > 0
    ? (totalCaptured / (totalCaptured + totalIdentified)) * 100
    : 0;

  return (
    <ValueEngineContext.Provider
      value={{
        opportunities,
        leakageEvents,
        customerValues,
        capacityMetrics,
        plays,
        capturedLedger,
        totalIdentified,
        totalCaptured,
        captureRate,
        simulatorParams,
        setSimulatorParams,
        executePlayStep,
        skipPlay,
        runAiScan,
        updateOpportunityStatus,
        dismissOpportunity,
        isScanning,
        scanProgress,
        loading,
      }}
    >
      {children}
    </ValueEngineContext.Provider>
  );
}

export function useValueEngine() {
  const ctx = useContext(ValueEngineContext);
  if (!ctx) throw new Error("useValueEngine must be used within ValueEngineProvider");
  return ctx;
}
