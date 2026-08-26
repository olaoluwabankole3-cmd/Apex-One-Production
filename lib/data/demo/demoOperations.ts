export interface Bottleneck {
  id: string;
  process: string;
  department: string;
  delayDays: number;
  cases: number;
  costImpactNaira: number; // in Millions/month
  recommendedAction: string;
  status: "stuck" | "optimizing" | "resolved";
}

export interface CapacityMetric {
  id: string;
  category: "People" | "Technology" | "Facilities" | "Operations";
  available: number; // percentage
  used: number; // percentage
  unused: number; // percentage
  overloaded: number; // percentage
}

export interface IncidentDetail {
  id: string;
  title: string;
  subsidiary: string;
  severity: "critical" | "high" | "medium";
  whatHappened: string;
  whyItHappened: string;
  systemsInvolved: string[];
  whoIsAffected: string;
  financialImpactNaira: number; // in Millions
  recommendedAction: string;
  status: "open" | "investigating" | "resolved";
}

export const demoBottlenecks: Bottleneck[] = [];
export const demoCapacityMetrics: CapacityMetric[] = [];
export const demoIncidents: IncidentDetail[] = [];
