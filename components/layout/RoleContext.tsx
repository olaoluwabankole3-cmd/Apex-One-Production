"use client";

/**
 * APEX ONE — Presentation Context
 *
 * SECURITY BOUNDARY:
 * - This context is not an authentication or authorization authority.
 * - Role authority comes only from the authenticated backend session.
 * - Permission UX hints belong to AuthContext.hasPermission.
 * - Backend authorization remains authoritative for every protected operation.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ALL_ROLES, type Role, type ActivityItem, type NotificationItem } from "@/lib/types";
import { notificationRepository } from "@/lib/data/repositories";
import { isDemoMode } from "@/lib/demo";
import { useAuth } from "@/components/auth/AuthContext";

interface PresentationContextValue {
  readonly role: Role;
  activities: ActivityItem[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  addActivity: (act: { actor: string; action: string; target: string; type: ActivityItem["type"] }) => void;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  addNotification: (notif: {
    title: string;
    description: string;
    type: NotificationItem["type"];
    severity: NotificationItem["severity"];
    source: string;
  }) => void;
}

const RoleContext = createContext<PresentationContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // AppShell prevents unauthenticated or non-internal sessions from rendering
  // the enterprise workspace. This sentinel exists only for legacy presentation
  // consumers while the session is unresolved and never grants access.
  const role: Role = user && ALL_ROLES.includes(user.role as Role)
    ? (user.role as Role)
    : "Customer / Investor";

  useEffect(() => {
    let mounted = true;

    async function syncDevelopmentFixtures() {
      if (!isDemoMode()) {
        if (mounted) {
          setActivities([]);
          setNotifications([]);
        }
        return;
      }

      const [activityRecords, notificationRecords] = await Promise.all([
        notificationRepository.getActivities(),
        notificationRepository.getNotifications(),
      ]);

      if (!mounted) return;
      setActivities(activityRecords);
      setNotifications(notificationRecords);
    }

    syncDevelopmentFixtures();
    window.addEventListener("storage", syncDevelopmentFixtures);
    return () => {
      mounted = false;
      window.removeEventListener("storage", syncDevelopmentFixtures);
    };
  }, []);

  const addActivity = (act: {
    actor: string;
    action: string;
    target: string;
    type: ActivityItem["type"];
  }) => {
    setActivities((previous) => [
      {
        id: `act-${Date.now()}`,
        actor: act.actor,
        action: act.action,
        target: act.target,
        time: "Just now",
        type: act.type,
      },
      ...previous,
    ]);
  };

  const addNotification = (notif: {
    title: string;
    description: string;
    type: NotificationItem["type"];
    severity: NotificationItem["severity"];
    source: string;
  }) => {
    setNotifications((previous) => [
      {
        id: `notif-${Date.now()}`,
        title: notif.title,
        description: notif.description,
        type: notif.type,
        severity: notif.severity,
        time: "Just now",
        read: false,
        source: notif.source,
      },
      ...previous,
    ]);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        activities,
        setActivities,
        addActivity,
        notifications,
        setNotifications,
        addNotification,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
