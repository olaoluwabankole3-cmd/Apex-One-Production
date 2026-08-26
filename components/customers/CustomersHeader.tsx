"use client";

import { motion } from "framer-motion";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


const subtitleByRole: Record<string, string> = {
  CEO: "The full relationship picture across every account in the portfolio.",
  Operations: "Account health and service delivery status, in one view.",
  "Relationship Manager": "Your book of business — timelines, notes, tasks, and meetings.",
  Compliance: "Account activity and documentation across the client base.",
  "Customer Service": "Support history and open items across every account.",
};

export default function CustomersHeader() {
  const { role } = useRole();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
    >
      <div>
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
          APEX ONE
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
          Customer Intelligence
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/50">
          Synthesizing customer portfolios, historical relationship timelines, and AI-driven expansion and risk vectors.
        </p>
      </div>
    </motion.div>
  );
}
