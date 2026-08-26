"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, HelpCircle, FileText, CheckCircle, ArrowRight, Zap, RefreshCw, BarChart2 } from "lucide-react";

interface ValueDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  value: string;
  confidence: string | number;
  businessArea?: string;
  whyIdentified: string;
  evidence: string;
  recommendedAction: string;
  expectedOutcome: string;
  executionStatus: string;
  financialImpact: string;
  auditTrail: string[];
}

export default function ValueDetailDrawer({
  isOpen,
  onClose,
  title,
  value,
  confidence,
  businessArea,
  whyIdentified,
  evidence,
  recommendedAction,
  expectedOutcome,
  executionStatus,
  financialImpact,
  auditTrail,
}: ValueDetailDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50"
            id="detail-drawer-backdrop"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[580px] bg-[#0e0e11] border-l border-white/[0.08] shadow-2xl z-50 overflow-y-auto flex flex-col justify-between select-none"
            id="detail-drawer-panel"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#121216]">
              <div>
                {businessArea && (
                  <span className="text-[10px] font-mono text-[#c9a961] uppercase tracking-[0.15em] block mb-1">
                    {businessArea}
                  </span>
                )}
                <h3 className="font-display text-[18px] font-bold text-[#f7f5f0] tracking-tight pr-4">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-ivory/50 hover:text-ivory rounded-lg p-2 hover:bg-white/[0.04] transition-colors shrink-0"
                id="close-drawer-button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Financial Highlight */}
              <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider">Potential Value</span>
                  <span className="text-[24px] font-mono font-bold text-[#c9a961] block mt-1">
                    {value}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider">Confidence Level</span>
                  <span className="text-[24px] font-mono font-bold text-white block mt-1">
                    {confidence}%
                  </span>
                </div>
              </div>

              {/* WHY THIS WAS IDENTIFIED */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#c9a961] uppercase tracking-wider">
                  <HelpCircle size={13} />
                  Why This Was Identified
                </div>
                <p className="text-[14px] text-white/70 leading-relaxed font-serif italic">
                  &ldquo;{whyIdentified}&rdquo;
                </p>
              </div>

              {/* TECHNICAL EVIDENCE */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#c9a961] uppercase tracking-wider">
                  <FileText size={13} />
                  Technical Evidence
                </div>
                <div className="bg-[#121216] border border-white/[0.04] rounded-xl p-3.5">
                  <p className="text-[12.5px] text-white/60 font-mono leading-relaxed break-all">
                    {evidence}
                  </p>
                </div>
              </div>

              {/* RECOMMENDED ACTION */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#c9a961] uppercase tracking-wider">
                  <Zap size={13} />
                  Recommended Action
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed">
                  {recommendedAction}
                </p>
              </div>

              {/* EXPECTED OUTCOME */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#c9a961] uppercase tracking-wider">
                  <CheckCircle size={13} />
                  Expected Outcome
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed">
                  {expectedOutcome}
                </p>
              </div>

              {/* EXECUTION & FINANCIAL IMPACT */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider">Execution Status</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-mono font-bold uppercase text-white/80 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c9a961] animate-pulse" />
                    {executionStatus}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-white/40 block uppercase tracking-wider">Financial Impact</span>
                  <span className="text-[13px] font-mono font-bold text-white mt-1 block">
                    {financialImpact}
                  </span>
                </div>
              </div>

              {/* AUDIT TRAIL */}
              <div className="space-y-2.5 pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/40 uppercase tracking-wider">
                  <RefreshCw size={12} />
                  System Audit Trail
                </div>
                <div className="space-y-2">
                  {auditTrail.map((log, i) => (
                    <div key={i} className="flex gap-2 text-[11px] font-mono text-white/40">
                      <span className="text-[#c9a961]/60">•</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/[0.08] bg-[#121216] flex items-center justify-end">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-white/80 px-4 py-2 text-[13px] font-mono font-bold transition-all"
                id="close-drawer-bottom-button"
              >
                Close Profile
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
