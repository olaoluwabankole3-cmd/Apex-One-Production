"use client";

import { motion } from "framer-motion";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


const subtitleByRole: Record<string, string> = {
  CEO: "Your conversational Chief of Staff across every business unit.",
  Operations: "Ask about workflows, SLAs, and reconciliation health.",
  "Relationship Manager": "Ask about accounts, renewals, and portfolio value.",
  Compliance: "Ask about flagged transactions and regulatory posture.",
  "Customer Service": "Ask about queues, resolution time, and escalations.",
};

export default function WorkspaceHeader() {
  const { role } = useRole();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
    >
      <div>
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70">
          APEX ONE
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px]">
          AI Workspace
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/45">{subtitleByRole[role]}</p>
      </div>
    </motion.div>
  );
}
