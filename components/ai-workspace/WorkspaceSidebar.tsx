"use client";

import { Database, Radio } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import SuggestedPrompts from "./SuggestedPrompts";
import { company } from "@/lib/organizationConfig";


interface WorkspaceSidebarProps {
  onSelect: (prompt: string) => void;
}

export default function WorkspaceSidebar({ onSelect }: WorkspaceSidebarProps) {
  return (
    <div className="flex flex-col gap-5">
      <GlassCard delay={0.05} className="p-5">
        <p className="font-display text-[14px] font-bold text-ivory">Try asking</p>
        <p className="mt-0.5 text-[11.5px] text-ivory/40">Tailored to your role</p>
        <div className="mt-3.5">
          <SuggestedPrompts onSelect={onSelect} variant="list" />
        </div>
      </GlassCard>

      <GlassCard delay={0.1} className="p-5">
        <p className="font-display text-[14px] font-bold text-ivory">Connected sources</p>
        <div className="mt-3.5 space-y-2.5">
          {company.subsidiaries.map((sub) => (
            <div key={sub} className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2 text-ivory/65">
                <Database size={13} className="text-gold/60" />
                {sub}
              </span>
              <span className="flex items-center gap-1 text-emerald/80">
                <Radio size={10} className="animate-pulse" />
                Live
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
