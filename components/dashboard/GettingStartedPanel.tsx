"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenText, FileStack, ShieldCheck, Workflow, BrainCircuit } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "@/components/layout/OrganizationContext";

const destinations = [
  {
    href: "/documents",
    title: "Review your evidence",
    description: "Browse authorized documents. Extracted information is not automatically verified.",
    permission: "document:read",
    icon: FileStack,
  },
  {
    href: "/knowledge-hub",
    title: "Explore institutional knowledge",
    description: "Find approved knowledge records and their available source context.",
    permission: "knowledge:read",
    icon: BookOpenText,
  },
  {
    href: "/ai-workspace",
    title: "Ask CORTEX",
    description: "Ask a bounded question about accessible records; unavailable sources stay unavailable.",
    permission: "ai:execute",
    feature: "aiWorkspace" as const,
    icon: BrainCircuit,
  },
  {
    href: "/workflows",
    title: "Track an authorized action",
    description: "Review existing workflows and next steps without assuming an action was completed.",
    permission: "workflow:read",
    feature: "workflowIntelligence" as const,
    icon: Workflow,
  },
];

export default function GettingStartedPanel() {
  const { hasPermission } = useAuth();
  const { isFeatureEnabled } = useOrganization();
  const links = destinations.filter((entry) =>
    hasPermission(entry.permission) && (!entry.feature || isFeatureEnabled(entry.feature))
  );

  return (
    <section
      aria-labelledby="cortex-start-title"
      className="relative overflow-hidden rounded-2xl border border-[#B9A996]/50 bg-[#F5F1E8] p-6 text-[#24231F] shadow-[0_16px_48px_rgba(0,0,0,.12)] sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "linear-gradient(to right, #A65A2E1A 1px, transparent 1px), linear-gradient(to bottom, #A65A2E1A 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-[#A65A2E]">
            Start here / CORTEX workspace
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9B9A5] bg-white/65 px-3 py-1 text-[10px] font-semibold text-[#645346]">
            <ShieldCheck size={13} aria-hidden="true" /> Staging preview
          </span>
        </div>
        <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-10">
          <div>
            <h2 id="cortex-start-title" className="max-w-xl font-display text-3xl font-bold leading-[1.14] tracking-[-.045em] sm:text-4xl">
              From scattered information to accountable decisions.
            </h2>
            <p className="mt-4 max-w-lg text-[14px] leading-7 text-[#5D554E]">
              CORTEX helps an authorized team inspect source records, ask questions within its data access, and follow up through documented workflows. Start with an area below to see what your organization has connected.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-md border border-[#C6B9A9] bg-white/65 px-3 py-1.5 text-xs text-[#51483F]">01 / Review evidence</span>
              <span className="rounded-md border border-[#C6B9A9] bg-white/65 px-3 py-1.5 text-xs text-[#51483F]">02 / Understand findings</span>
              <span className="rounded-md border border-[#C6B9A9] bg-white/65 px-3 py-1.5 text-xs text-[#51483F]">03 / Track next actions</span>
            </div>
          </div>
          <div className="grid content-start gap-2 sm:grid-cols-2">
            {links.length ? links.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border border-[#C8BDB0] bg-white/80 p-4 transition-colors hover:border-[#A65A2E] hover:bg-white focus-visible:outline-[#A65A2E]"
              >
                <div className="flex items-center justify-between">
                  <Icon size={18} className="text-[#A65A2E]" aria-hidden="true" />
                  <ArrowUpRight size={16} className="text-[#806953] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-[13px] font-bold">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-[#665E55]">{description}</p>
              </Link>
            )) : <p className="col-span-2 rounded-xl border border-[#C8BDB0] bg-white/80 p-5 text-sm text-[#665E55]">
              Your permissions do not currently include these starting workspaces. Contact your organization administrator.
            </p>}
          </div>
        </div>
        <div className="mt-6 border-t border-[#C9B9A5] pt-4 text-[11px] leading-5 text-[#695B4E]">
          <strong>What is not live yet:</strong> bank-authorized data feeds, independently certified reconciliation outcomes, and verified recovered funds. Experimental reconciliation remains gated and uses synthetic data; do not upload real bank records.
        </div>
      </div>
    </section>
  );
}
