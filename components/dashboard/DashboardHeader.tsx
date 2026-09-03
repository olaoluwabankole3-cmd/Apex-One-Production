"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRole } from "@/components/layout/RoleContext";

const subtitleByRole: Record<string, string> = {
  CEO: "Enterprise signals, decisions, execution, and measurable value in one operating view.",
  Operations: "Operational health, workflows, actions, and exceptions across your authorized scope.",
  "Relationship Manager": "Authorized customer relationships, risks, evidence, and next actions.",
  Compliance: "Authorized risk, audit, evidence, and governance signals.",
  "Customer Service": "Authorized customer health and service signals requiring attention.",
};

export default function DashboardHeader() {
  const { role } = useRole();
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 mt-[-11px] flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
    >
      <div>
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70">
          APEX ONE · {today || "Executive Command Center"}
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px]">
          Executive Command Center
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/45">
          {subtitleByRole[role] || "Authorized enterprise intelligence and execution context."}
        </p>
      </div>
    </motion.div>
  );
}
