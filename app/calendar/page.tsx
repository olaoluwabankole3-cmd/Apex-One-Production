"use client";

import CalendarHeader from "@/components/calendar/CalendarHeader";
import AgendaList from "@/components/calendar/AgendaList";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function CalendarPage() {
  return (
    <InternalOnlyShield>
      <div className="mx-auto w-full max-w-7xl px-1">
        <CalendarHeader />
        <AgendaList />
      </div>
    </InternalOnlyShield>
  );
}
