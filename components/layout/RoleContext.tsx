"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Role, ActivityItem, NotificationItem } from "@/lib/types";
import { notificationRepository } from "@/lib/data/repositories";
import { isDemoMode } from "@/lib/demo";


interface EcosystemContextValue {
  role: Role;
  setRole: (role: Role) => void;
  activities: ActivityItem[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  addActivity: (act: { actor: string; action: string; target: string; type: ActivityItem["type"] }) => void;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  addNotification: (notif: { title: string; description: string; type: NotificationItem["type"]; severity: NotificationItem["severity"]; source: string }) => void;
  submittedDocuments: any[];
  addDocument: (doc: any) => void;
  bookedMeetings: any[];
  addMeeting: (meeting: any) => void;
  appliedProducts: string[];
  applyProduct: (productId: string) => void;
  portfolioValue: number;
  addPortfolioValue: (val: number) => void;
}

const RoleContext = createContext<EcosystemContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("CEO");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [submittedDocuments, setSubmittedDocuments] = useState<any[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<any[]>([]);
  const [appliedProducts, setAppliedProducts] = useState<string[]>([]);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const handleSync = async () => {
      if (isDemoMode()) {
        const [acts, notifs] = await Promise.all([
          notificationRepository.getActivities(),
          notificationRepository.getNotifications(),
        ]);
        if (!isMounted) return;
        setActivities(acts);
        setNotifications(notifs);
        setSubmittedDocuments([

          {
            id: "doc-init-1",
            name: "Government_Issued_ID.pdf",
            category: "Compliance KYC",
            status: "Verified",
            size: "2.4 MB",
            date: "Jul 18, 2026",
          },
          {
            id: "doc-init-2",
            name: "Tax_Statement_2025.pdf",
            category: "Financial Statement",
            status: "Verified",
            size: "1.8 MB",
            date: "Jul 20, 2026",
          }
        ]);
        setBookedMeetings([
          {
            id: "meet-init-1",
            title: "Strategic Asset Allocation Review",
            date: "Jul 23, 2026",
            time: "10:30 AM",
            rmName: "Elena Cho",
            status: "Confirmed",
            type: "Video",
          }
        ]);
        setPortfolioValue(10482930);
      } else {
        setActivities([]);
        setNotifications([]);
        setSubmittedDocuments([]);
        setBookedMeetings([]);
        setPortfolioValue(0);
      }
    };

    handleSync();
    window.addEventListener("storage", handleSync);
    return () => window.removeEventListener("storage", handleSync);
  }, []);

  const addActivity = (act: { actor: string; action: string; target: string; type: ActivityItem["type"] }) => {
    const newItem: ActivityItem = {
      id: `act-${Date.now()}`,
      actor: act.actor,
      action: act.action,
      target: act.target,
      time: "Just now",
      type: act.type,
    };
    setActivities((prev) => [newItem, ...prev]);
  };

  const addNotification = (notif: {
    title: string;
    description: string;
    type: NotificationItem["type"];
    severity: NotificationItem["severity"];
    source: string;
  }) => {
    const newItem: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: notif.title,
      description: notif.description,
      type: notif.type,
      severity: notif.severity,
      time: "Just now",
      read: false,
      source: notif.source,
    };
    setNotifications((prev) => [newItem, ...prev]);
  };

  const addDocument = (doc: any) => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      ...doc,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setSubmittedDocuments((prev) => [newDoc, ...prev]);
    
    // Auto-trigger activity inside the ecosystem
    addActivity({
      actor: "Customer Portal",
      action: "submitted a new document",
      target: doc.name,
      type: "compliance",
    });

    addNotification({
      title: `KYC Document Uploaded: ${doc.name}`,
      description: `Customer uploaded a document of category ${doc.category} for review.`,
      type: "system",
      severity: "info",
      source: "APEX CONNECT",
    });
  };

  const addMeeting = (meeting: any) => {
    const newMeet = {
      id: `meet-${Date.now()}`,
      ...meeting,
      status: "Confirmed",
    };
    setBookedMeetings((prev) => [newMeet, ...prev]);

    // Auto-trigger activity inside the ecosystem
    addActivity({
      actor: "Customer Portal",
      action: "booked a RM consultation on",
      target: `${meeting.date} at ${meeting.time}`,
      type: "deal",
    });

    addNotification({
      title: `Meeting Booked: ${meeting.title}`,
      description: `Customer scheduled an advisor consultation with ${meeting.rmName} on ${meeting.date} at ${meeting.time}.`,
      type: "mention",
      severity: "success",
      source: "APEX CONNECT",
    });
  };

  const applyProduct = (productId: string) => {
    if (appliedProducts.includes(productId)) return;
    setAppliedProducts((prev) => [...prev, productId]);

    const productName = productId === "yield" ? "High-Yield Custody Note" 
      : productId === "realestate" ? "Prime Real Estate Bond" 
      : "Private Wealth Managed Fund";

    // Auto-trigger activity inside the ecosystem
    addActivity({
      actor: "Customer Portal",
      action: "applied for financial product",
      target: productName,
      type: "deal",
    });

    addNotification({
      title: `Product Application Received`,
      description: `High-value application for ${productName} submitted by customer.`,
      type: "alert",
      severity: "critical",
      source: "APEX CONNECT",
    });
  };

  const addPortfolioValue = (val: number) => {
    setPortfolioValue((prev) => prev + val);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        activities,
        setActivities,
        addActivity,
        notifications,
        setNotifications,
        addNotification,
        submittedDocuments,
        addDocument,
        bookedMeetings,
        addMeeting,
        appliedProducts,
        applyProduct,
        portfolioValue,
        addPortfolioValue,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
