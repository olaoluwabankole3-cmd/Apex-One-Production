"use client";

import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import clsx from "clsx";
import { CustomerMeeting } from "@/lib/types";

interface MeetingsTabProps {
  meetings: CustomerMeeting[];
}

export default function MeetingsTab({ meetings }: MeetingsTabProps) {
  if (meetings.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No meetings scheduled.</p>;
  }

  const sorted = [...meetings].sort((a, b) => Number(a.status !== "upcoming") - Number(b.status !== "upcoming"));

  return (
    <div className="space-y-2.5 py-1">
      {sorted.map((meeting, i) => (
        <motion.div
          key={meeting.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.04 }}
          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ivory/90">{meeting.title}</p>
            <span
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                meeting.status === "upcoming"
                  ? "border-gold/25 bg-gold/10 text-gold"
                  : "border-white/[0.1] bg-white/[0.05] text-ivory/45"
              )}
            >
              {meeting.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ivory/45">
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {meeting.date} · {meeting.time}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={12} />
              {meeting.attendees.join(", ")}
            </span>
          </div>
          {meeting.notes && (
            <p className="mt-2 rounded-lg bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-ivory/55">
              {meeting.notes}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
