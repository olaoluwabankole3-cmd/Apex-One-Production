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

      return [];
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

      return [];
    } catch (err) {
      console.error("Failed to load activities from API:", err);
      return [];
    }
  }

  async getIntelligenceSignals(_organizationId?: string): Promise<IntelligenceSignal[]> {
    // BACKEND CAPABILITY REQUIRED: Real-time intelligence signals event stream
    return [];
  }

  async getSignal(_id: string): Promise<IntelligenceSignal | undefined> {
    return undefined;
  }
}

export const notificationRepository = new ApiNotificationRepository();

