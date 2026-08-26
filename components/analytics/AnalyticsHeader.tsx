"use client";

import { motion } from "framer-motion";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


const subtitleByRole: Record<string, string> = {
  CEO: "Business intelligence across every business unit and segment.",
  Operations: "Performance trends behind the operational numbers.",
  "Relationship Manager": "Growth and segment trends across the portfolio.",
  Compliance: "Trend context behind the risk and compliance picture.",
  "Customer Service": "Growth trends behind the accounts you support.",
};

export default function AnalyticsHeader() {
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
          Enterprise Analytics
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/45">{subtitleByRole[role]}</p>
      </div>
    </motion.div>
  );
}
