import { CalendarEvent } from "@/lib/types";
import { DecisionIntellEvent } from "@/lib/data/demo";

export interface CalendarRepository {
  getCalendarEvents(organizationId?: string): Promise<CalendarEvent[]>;
  getDecisionEvents(organizationId?: string): Promise<DecisionIntellEvent[]>;
  getDecisionEvent(id: string): Promise<DecisionIntellEvent | undefined>;
}

export class ApiCalendarRepository implements CalendarRepository {
  async getCalendarEvents(_organizationId?: string): Promise<CalendarEvent[]> {
    const decisionEvents = await this.getDecisionEvents();
    return decisionEvents.map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      type: e.category.toLowerCase().includes("decision") ? "board" : e.category.toLowerCase().includes("renewal") ? "client" : "operational",
      subsidiary: e.relatedDepartment,
      attendees: e.participants,
      participants: e.participants,
      aiSummary: e.decisionRequired
    }));
  }

  async getDecisionEvents(_organizationId?: string): Promise<DecisionIntellEvent[]> {
    return [
      {
        id: "evt-cal-1",
        title: "Board Risk & Audit Committee Review",
        date: "Aug 25, 2026",
        dayNumber: 25,
        time: "10:00 AM",
        category: "Executive Decision",
        status: "upcoming",
        participants: ["Audit Committee Lead", "COO", "Chief Risk Officer"],
        relatedCustomer: "Enterprise Portfolio",
        relatedDepartment: "Enterprise Operations",
        relatedWorkflow: "Audit Verification",
        relatedContract: "Multi-Tenant Assurance Agreement",
        previousMeetings: ["Q1 Review"],
        relevantDocuments: ["Compliance Filing 2026"],
        decisionRequired: "Approve updated multi-tenant governance compliance reporting protocols.",
        businessImpact: "₦45,000,000",
        dependencies: ["Cryptographic tenant audit"],
        executiveBrief: {
          currentContractValue: "₦45,000,000",
          revenueHistory: "Steady",
          lastInteraction: "Yesterday",
          openSupportIssues: 0,
          renewalProbability: "98%",
          outstandingRisks: "None",
          expansionOpportunity: "High",
          recommendedDiscussionPoints: ["Approve tenant isolation SLA matrix"]
        }
      },
      {
        id: "evt-cal-2",
        title: "Meridian Logistics Contract Renewal Strategy Sync",
        date: "Aug 28, 2026",
        dayNumber: 28,
        time: "02:30 PM",
        category: "Renewal",
        status: "upcoming",
        participants: ["Elena Cho", "Account Director", "VP of Commercial Ops"],
        relatedCustomer: "Meridian Logistics",
        relatedDepartment: "Strategic Accounts",
        relatedWorkflow: "Renewal Safeguard",
        relatedContract: "Enterprise Logistics Master Agreement",
        previousMeetings: ["Quarterly Business Review"],
        relevantDocuments: ["Master Logistics Contract 2025"],
        decisionRequired: "Finalize renewal term sheet with 3% tariff margin optimization.",
        businessImpact: "₦68,000,000",
        dependencies: ["Executive Sign-off Gate"],
        executiveBrief: {
          currentContractValue: "₦68,000,000",
          revenueHistory: "+18% YoY",
          lastInteraction: "3 days ago",
          openSupportIssues: 1,
          renewalProbability: "92%",
          outstandingRisks: "Competitor bid",
          expansionOpportunity: "₦14M annual expansion",
          recommendedDiscussionPoints: ["Tiered SLA protection buffer", "Margin indexation guarantee"]
        }
      }
    ];
  }

  async getDecisionEvent(id: string): Promise<DecisionIntellEvent | undefined> {
    const list = await this.getDecisionEvents();
    return list.find(e => e.id === id);
  }
}

export const calendarRepository = new ApiCalendarRepository();

