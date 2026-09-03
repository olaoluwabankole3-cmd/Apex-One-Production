"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { valueRepository } from "@/lib/data/repositories";
import { useAuth } from "@/components/auth/AuthContext";

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
  recordedBy?: string;
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
  executePlayStep: (playId: string) => Promise<void>;
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
  const { user, organization, isLoading: authLoading } = useAuth();
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
    if (authLoading || !user) {
      if (!authLoading && !user) {
        setLoading(false);
      }
      return;
    }

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
  }, [user, organization?.id, authLoading]);

  const [simulatorParams, setSimulatorParams] = useState({
    pricingSensitivity: 35,
    slaTargetRate: 98,
    capacityReclaimPercent: 45,
    leakagePlugRate: 75,
  });

  const updateOpportunityStatus = (_id: string, _status: PipelineStatus) => {
    console.warn("Opportunity status changes are not connected to an authoritative mutation endpoint yet.");
  };

  const dismissOpportunity = (_id: string) => {
    console.warn("Opportunity dismissal is not connected to an authoritative mutation endpoint yet.");
  };

  const executePlayStep = async (playId: string): Promise<void> => {
    try {
      await valueRepository.advanceAction(playId);
      const [opps, pls, ledger] = await Promise.all([
        valueRepository.getOpportunities(),
        valueRepository.getPlays(),
        valueRepository.getCapturedLedger(),
      ]);
      setOpportunities(opps);
      setPlays(pls);
      setCapturedLedger(ledger);
    } catch (error) {
      console.error("Authoritative action advancement failed:", error);
    }
  };

  const skipPlay = (_playId: string) => {
    console.warn("Skipping an execution play is not connected to an authoritative mutation endpoint yet.");
  };

  const runAiScan = async (): Promise<void> => {
    setIsScanning(false);
    setScanProgress(0);
    console.warn("AI opportunity discovery is not connected to an authoritative backend operation yet.");
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
