"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRole } from "@/components/layout/RoleContext";
import { company } from "@/lib/organizationConfig";


const subtitleByRole: Record<string, string> = {
  CEO: "Here's how Apex Sync is performing across every business unit.",
  Operations: "Here's the operational health of every business unit, in one view.",
  "Relationship Manager": "Here's where your customers and portfolios stand today.",
  Compliance: "Here's your risk and regulatory posture across the enterprise.",
  "Customer Service": "Here's how service quality is trending across the enterprise.",
};

export default function DashboardHeader() {
  const { role } = useRole();
  const [today, setToday] = useState<string>("");

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
      className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end mt-[-11px] pt-[-9px]"
    >
      <div>
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70">
          APEX ONE · {today || "Executive Dashboard"}
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px]">
          Executive Dashboard
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ivory/45">{subtitleByRole[role]}</p>
      </div>
    </motion.div>
  );
}
