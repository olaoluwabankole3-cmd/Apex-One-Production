import { CalendarEvent } from "@/lib/types";
import { demoCalendarEvents, DecisionIntellEvent } from "@/lib/data/demo";

export interface CalendarRepository {
  getCalendarEvents(organizationId?: string): Promise<CalendarEvent[]>;
  getDecisionEvents(organizationId?: string): Promise<DecisionIntellEvent[]>;
  getDecisionEvent(id: string): Promise<DecisionIntellEvent | undefined>;
}

export class MockCalendarRepository implements CalendarRepository {
  async getCalendarEvents(_organizationId?: string): Promise<CalendarEvent[]> {
    return demoCalendarEvents.map(e => ({
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
    return demoCalendarEvents;
  }

  async getDecisionEvent(id: string): Promise<DecisionIntellEvent | undefined> {
    return demoCalendarEvents.find(e => e.id === id);
  }
}

export const calendarRepository = new MockCalendarRepository();
