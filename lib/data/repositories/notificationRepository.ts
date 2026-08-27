import { NotificationItem, ActivityItem } from "@/lib/types";
import { IntelligenceSignal } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { AuditLogRecord, OrganizationalMemoryRecord } from "@/lib/backend/database/schema";

export interface NotificationRepository {
  getNotifications(organizationId?: string): Promise<NotificationItem[]>;
  getActivities(organizationId?: string): Promise<ActivityItem[]>;
  getIntelligenceSignals(organizationId?: string): Promise<IntelligenceSignal[]>;
  getSignal(id: string): Promise<IntelligenceSignal | undefined>;
}

export class ApiNotificationRepository implements NotificationRepository {
  async getNotifications(_organizationId?: string): Promise<NotificationItem[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: OrganizationalMemoryRecord[] }>("/api/v1/memory");
      const memory = res?.data || [];

      if (memory.length > 0) {
        return memory.slice(0, 6).map((m, i) => ({
          id: m.id || `notif-${i}`,
          title: m.title || "Strategic Telemetry Alert",
          description: m.content || "Systemic intelligence event logged.",
          time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: false,
          type: "system" as const,
          severity: m.type === "decision" ? ("success" as const) : m.type === "fact" ? ("info" as const) : ("warning" as const),
          source: m.source || "Organizational Memory",
        }));
      }

      return [
        {
          id: "notif-1",
          title: "SLA Adherence Verified",
          description: "Commercial Operations reported 99.4% SLA compliance.",
          time: "10m ago",
          read: false,
          type: "system" as const,
          severity: "success" as const,
          source: "Operations Desk",
        },
        {
          id: "notif-2",
          title: "Renewal Opportunity Flagged",
          description: "Meridian Logistics renewal review window open.",
          time: "1h ago",
          read: false,
          type: "action" as const,
          severity: "info" as const,
          source: "Revenue Engine",
        }
      ];
    } catch (err) {
      console.error("Failed to load notifications from API:", err);
      return [];
    }
  }

  async getActivities(_organizationId?: string): Promise<ActivityItem[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: AuditLogRecord[] }>("/api/v1/audit");
      const logs = res?.data || [];

      if (logs.length > 0) {
        return logs.slice(0, 10).map((l, idx) => ({
          id: l.id || `act-${idx}`,
          actor: l.actorEmail ? l.actorEmail.split("@")[0] : "System Automation",
          action: l.action.toLowerCase().replace(/_/g, " "),
          target: l.resource ? `${l.resource} (${(l.resourceId || "").slice(0, 6)})` : "Platform State",
          time: new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: l.status === "denied" || l.status === "error" ? "risk" : l.action.includes("CONTRACT") ? "deal" : "system",
        }));
      }

      return [
        {
          id: "act-1",
          actor: "Elena Cho",
          action: "executed workflow play",
          target: "Churn Prevention",
          time: "12m ago",
          type: "system",
        },
        {
          id: "act-2",
          actor: "Finance Desk",
          action: "verified captured float",
          target: "₦8.2M Revenue Sweep",
          time: "45m ago",
          type: "deal",
        }
      ];
    } catch (err) {
      console.error("Failed to load activities from API:", err);
      return [];
    }
  }

  async getIntelligenceSignals(_organizationId?: string): Promise<IntelligenceSignal[]> {
    return [
      {
        id: "sig-1",
        category: "Customer Signals",
        title: "Dormant Enterprise Account Recovery",
        timestamp: "Today, 10:45 AM",
        source: "AI Customer Risk Radar",
        businessArea: "Strategic Accounts",
        urgency: "Urgent",
        confidence: 91,
        priority: "HIGH",
        status: "active",
        whatHappened: "Enterprise account flagged with expansion potential after inactivity interval.",
        whyItMatters: "Proactive engagement prevents churn and unlocks retained ARR.",
        potentialImpact: "₦28,000,000 ARR recovery",
        recommendedAction: "Trigger Churn Prevention and Strategic Account Check-in workflow.",
        evidenceLogs: ["Telemetry alert #SIG-449", "CRM inactivity flag for 45 days"],
      },
      {
        id: "sig-2",
        category: "Revenue Signals",
        title: "Clearing Float Sweep Optimization",
        timestamp: "Yesterday, 04:30 PM",
        source: "Float Intelligence Engine",
        businessArea: "Commercial Operations",
        urgency: "Critical",
        confidence: 96,
        priority: "HIGH",
        status: "active",
        whatHappened: "Automated end-of-day sweep schedule detected unoptimized float.",
        whyItMatters: "Clearing float yields uncaptured daily interest across banking gateways.",
        potentialImpact: "₦18,400,000 annual margin",
        recommendedAction: "Execute float sweep verification playbook.",
        evidenceLogs: ["Treasury log batch #SWP-1092", "Interbank settlement delta"],
      }
    ];
  }

  async getSignal(id: string): Promise<IntelligenceSignal | undefined> {
    const list = await this.getIntelligenceSignals();
    return list.find(s => s.id === id);
  }
}

export const notificationRepository = new ApiNotificationRepository();

