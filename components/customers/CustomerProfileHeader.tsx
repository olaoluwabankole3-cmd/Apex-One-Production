"use client";

import { motion } from "framer-motion";
import { Mail, MessageSquarePlus, CalendarPlus } from "lucide-react";
import clsx from "clsx";
import { Customer, CustomerStatus } from "@/lib/types";
import HealthRing from "./HealthRing";

const statusStyle: Record<CustomerStatus, string> = {
  active: "text-emerald bg-emerald/10 border-emerald/25",
  "at-risk": "text-crimson bg-crimson/10 border-crimson/25",
  onboarding: "text-amber bg-amber/10 border-amber/25",
};

const statusLabel: Record<CustomerStatus, string> = {
  active: "Active",
  "at-risk": "At Risk",
  onboarding: "Onboarding",
};

interface CustomerProfileHeaderProps {
  customer: Customer;
}

export default function CustomerProfileHeader({ customer }: CustomerProfileHeaderProps) {
  return (
    <motion.div
      key={customer.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-white/[0.07] bg-charcoal/40 p-5 shadow-glass lg:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/10 font-display text-[20px] font-bold text-gold">
            {customer.name.charAt(0)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[19px] font-bold text-ivory">{customer.name}</h2>
              <span
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                  statusStyle[customer.status]
                )}
              >
                {statusLabel[customer.status]}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-ivory/45">
              {customer.subsidiary} · {customer.tier} · Client since {customer.since}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10.5px] text-ivory/55"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-ivory/40">ARR</p>
            <p className="font-display text-[19px] font-bold text-ivory">${customer.arr.toFixed(2)}M</p>
          </div>
          <HealthRing score={customer.healthScore} />
        </div>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ivory/55">
          <span>
            Owner <span className="text-ivory/85">{customer.owner}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Mail size={12} className="text-ivory/35" />
            {customer.contactName}, {customer.contactRole}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ivory/70 transition-colors duration-200 hover:border-gold/30 hover:text-ivory">
            <MessageSquarePlus size={13} />
            Add Note
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-3 py-1.5 text-[11.5px] font-semibold text-matte transition-shadow duration-200 hover:shadow-gold-glow">
            <CalendarPlus size={13} />
            Schedule Meeting
          </button>
        </div>
      </div>
    </motion.div>
  );
}
