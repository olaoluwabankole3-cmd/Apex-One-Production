import { NotificationItem, ActivityItem } from "@/lib/types";
import { IntelligenceSignal } from "@/lib/data/demo";
import { AuditLogRecord, OrganizationalMemoryRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData } from "./httpCollection";

export interface NotificationRepository {
  getNotifications(organizationId?: string): Promise<NotificationItem[]>;
  getActivities(organizationId?: string): Promise<ActivityItem[]>;
  getIntelligenceSignals(organizationId?: string): Promise<IntelligenceSignal[]>;
  getSignal(id: string): Promise<IntelligenceSignal | undefined>;
}

export class ApiNotificationRepository implements NotificationRepository {
  async getNotifications(_organizationId?: string): Promise<NotificationItem[]> {
    const memory = await collectAllCollectionData<OrganizationalMemoryRecord>("/api/v1/memory");
    return memory.slice(0, 6).map((m, index) => ({
      id: m.id || `notif-${index}`,
      title: m.title || "Strategic Telemetry Alert",
      description: m.content || "Systemic intelligence event logged.",
      time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
      type: "system" as const,
      severity: m.type === "decision" ? ("success" as const) : m.type === "fact" ? ("info" as const) : ("warning" as const),
      source: m.source || "Organizational Memory",
    }));
  }

  async getActivities(_organizationId?: string): Promise<ActivityItem[]> {
    const logs = await collectAllCollectionData<AuditLogRecord>("/api/v1/audit");
    return logs.slice(0, 10).map((log, index) => ({
      id: log.id || `act-${index}`,
      actor: log.actorEmail ? log.actorEmail.split("@")[0] : "System Automation",
      action: log.action.toLowerCase().replace(/_/g, " "),
      target: log.resource ? `${log.resource} (${(log.resourceId || "").slice(0, 6)})` : "Platform State",
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: log.status === "denied" || log.status === "error" ? "risk" : log.action.includes("CONTRACT") ? "deal" : "system",
    }));
  }

  async getIntelligenceSignals(_organizationId?: string): Promise<IntelligenceSignal[]> {
    // BACKEND CAPABILITY REQUIRED: Real-time intelligence signals event stream.
    return [];
  }

  async getSignal(_id: string): Promise<IntelligenceSignal | undefined> {
    return undefined;
  }
}

export const notificationRepository = new ApiNotificationRepository();
