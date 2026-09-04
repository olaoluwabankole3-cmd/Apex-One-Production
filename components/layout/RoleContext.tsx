"use client";

/**
 * APEX ONE — Presentation Context
 *
 * This context is not an authentication or authorization authority.
 * Role and tenant authority come only from the authenticated backend session.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ALL_ROLES, type Role, type ActivityItem, type NotificationItem } from "@/lib/types";
import { notificationRepository } from "@/lib/data/repositories";
import { useAuth } from "@/components/auth/AuthContext";

interface PresentationContextValue {
  readonly role: Role;
  activities: ActivityItem[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  addActivity: (act: {
    actor: string;
    action: string;
    target: string;
    type: ActivityItem["type"];
  }) => void;
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
  const { user, organization, isLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Administrator is an authoritative backend role. Until all legacy display maps
  // include it, use the executive presentation profile only; the actual role and
  // permissions remain authoritative in AuthContext.
  const role: Role =
    user?.role === "Administrator"
      ? "CEO"
      : user && ALL_ROLES.includes(user.role as Role)
        ? (user.role as Role)
        : "Customer / Investor";

  useEffect(() => {
    let mounted = true;

    if (isLoading) return;

    if (!user || !organization) {
      setActivities([]);
      setNotifications([]);
      return;
    }

    Promise.all([
      notificationRepository.getActivities(organization.id),
      notificationRepository.getNotifications(organization.id),
    ])
      .then(([activityRecords, notificationRecords]) => {
        if (!mounted) return;
        setActivities(activityRecords);
        setNotifications(notificationRecords);
      })
      .catch(() => {
        if (!mounted) return;
        setActivities([]);
        setNotifications([]);
      });

    return () => {
      mounted = false;
    };
  }, [user, organization, isLoading]);

  // Compatibility callbacks deliberately do not create local business events.
  // Durable activity and notification creation requires a backend operation.
  const addActivity = (_act: {
    actor: string;
    action: string;
    target: string;
    type: ActivityItem["type"];
  }) => {
    console.warn("Local activity creation is disabled; use an authoritative backend operation.");
  };

  const addNotification = (_notif: {
    title: string;
    description: string;
    type: NotificationItem["type"];
    severity: NotificationItem["severity"];
    source: string;
  }) => {
    console.warn("Local notification creation is disabled; use an authoritative backend operation.");
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
