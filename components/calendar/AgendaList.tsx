"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, Users } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { calendarRepository } from "@/lib/data/repositories";
import type { CalendarEvent } from "@/lib/types";

export default function AgendaList() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    calendarRepository
      .getCalendarEvents()
      .then((records) => {
        if (mounted) setEvents(records);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <GlassCard className="p-8 text-center text-sm text-ivory/45">
        Loading authorized calendar records…
      </GlassCard>
    );
  }

  if (events.length === 0) {
    return (
      <GlassCard className="border-dashed p-8 text-center">
        <CalendarDays size={24} className="mx-auto text-gold/70" />
        <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold/70">
          Calendar integration not connected
        </p>
        <h2 className="mt-2 font-display text-xl font-bold text-ivory">
          No authoritative calendar events are available
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ivory/45">
          Meetings, decision events, attendees, conflicts and follow-up tasks will appear
          after a calendar or scheduling authority is connected. APEX ONE does not populate
          this screen with fictional meetings.
        </p>
        {failed && (
          <p className="mt-4 text-sm text-crimson/80">
            The calendar data request could not be completed.
          </p>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <GlassCard key={event.id} className="p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="font-display text-base font-bold text-ivory">{event.title}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-ivory/45">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} /> {event.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} /> {event.time}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={13} /> {event.attendees.length} attendee(s)
                </span>
              </div>
            </div>
            <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory/45">
              {event.type}
            </span>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
