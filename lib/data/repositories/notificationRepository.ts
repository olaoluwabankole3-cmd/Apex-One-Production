import { NotificationItem, ActivityItem } from "@/lib/types";
import { demoSignals, IntelligenceSignal, demoActivity, demoNotifications } from "@/lib/data/demo";

export interface NotificationRepository {
  getNotifications(organizationId?: string): Promise<NotificationItem[]>;
  getActivities(organizationId?: string): Promise<ActivityItem[]>;
  getIntelligenceSignals(organizationId?: string): Promise<IntelligenceSignal[]>;
  getSignal(id: string): Promise<IntelligenceSignal | undefined>;
}

export class MockNotificationRepository implements NotificationRepository {
  async getNotifications(_organizationId?: string): Promise<NotificationItem[]> {
    return demoNotifications;
  }

  async getActivities(_organizationId?: string): Promise<ActivityItem[]> {
    return demoActivity;
  }

  async getIntelligenceSignals(_organizationId?: string): Promise<IntelligenceSignal[]> {
    return demoSignals;
  }

  async getSignal(id: string): Promise<IntelligenceSignal | undefined> {
    return demoSignals.find(s => s.id === id);
  }
}

export const notificationRepository = new MockNotificationRepository();
