import { CalendarEvent } from "@/lib/types";
import { DecisionIntellEvent } from "@/lib/data/demo";

export interface CalendarRepository {
  getCalendarEvents(organizationId?: string): Promise<CalendarEvent[]>;
  getDecisionEvents(organizationId?: string): Promise<DecisionIntellEvent[]>;
  getDecisionEvent(id: string): Promise<DecisionIntellEvent | undefined>;
}

// BACKEND CAPABILITY REQUIRED: Calendar and decision intelligence event data service.
// Currently no calendar endpoint is available in the backend architecture.
export class ApiCalendarRepository implements CalendarRepository {
  async getCalendarEvents(_organizationId?: string): Promise<CalendarEvent[]> {
    return [];
  }

  async getDecisionEvents(_organizationId?: string): Promise<DecisionIntellEvent[]> {
    return [];
  }

  async getDecisionEvent(_id: string): Promise<DecisionIntellEvent | undefined> {
    return undefined;
  }
}

export const calendarRepository = new ApiCalendarRepository();

