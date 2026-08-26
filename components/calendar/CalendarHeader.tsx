"use client";

import { motion } from "framer-motion";

export default function CalendarHeader() {

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6"
    >
      <p className="text-[12px] font-mono font-medium uppercase tracking-[0.15em] text-gold/70">
        APEX ONE — APEX SYNC
      </p>
      <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[34px] uppercase">
        DECISION & COORDINATION INTELLIGENCE
      </h1>
      <p className="mt-1.5 text-[13.5px] text-ivory/50">
        {"Understand the decisions, dependencies and business consequences behind your organization's schedule."}
      </p>
    </motion.div>
  );
}
