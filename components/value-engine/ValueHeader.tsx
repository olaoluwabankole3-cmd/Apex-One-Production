"use client";

import { useEffect, useState } from "react";
import { useValueEngine } from "./ValueEngineContext";
import { Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ValueHeaderProps {
  title: string;
  subtitle: string;
  category?: string;
}

const scanLogs = [
  "Initializing deep ledger scan across all Group subsidiaries...",
  "Querying CRM Sales pipelines and outstanding contract lists...",
  "Analyzing operational capacity and active JIRA timesheets...",
  "Analyzing SaaS subscription licensing and active compute telemetry...",
  "Identifying passive churn and credit card dunning failures...",
  "Quantifying potential revenue leakage margins...",
  "Applying ML models to evaluate customer contract adjustments...",
  "Generating active Value Capture Playbooks...",
  "Consolidating value pipeline reports..."
];

export default function ValueHeader({ title, subtitle, category = "VALUE INTELLIGENCE" }: ValueHeaderProps) {
  const { runAiScan, isScanning, scanProgress } = useValueEngine();
  const [today, setToday] = useState("");
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setLogIndex((prev) => (prev + 1) % scanLogs.length);
      }, 400);
      return () => clearInterval(interval);
    } else {
      setLogIndex(0);
    }
  }, [isScanning]);

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
            {category} · {today || "APEX ONE"}
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px]">
            {title}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ivory/45">{subtitle}</p>
        </div>

        <div>
          <button
            onClick={() => runAiScan()}
            disabled={isScanning}
            className="flex items-center gap-2 rounded-lg bg-gold-gradient hover:bg-opacity-90 active:scale-[0.98] transition-all duration-200 px-4 py-2.5 text-[13px] font-bold text-matte"
          >
            {isScanning ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Scanning OS...
              </>
            ) : (
              <>
                <Sparkles size={15} className="animate-pulse" />
                Run AI Value Scan
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-matte/90 backdrop-blur-md px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="max-w-md w-full border border-gold/20 bg-charcoal p-6 rounded-2xl shadow-gold-glow flex flex-col items-center"
            >
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 border border-gold/30 mb-5">
                <Sparkles size={28} className="text-gold animate-pulse" />
                <motion.div
                  className="absolute inset-0 rounded-full border border-gold"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
              </div>

              <h3 className="font-display text-lg font-bold text-ivory tracking-tight">
                AI Value Engine Scanning...
              </h3>
              <p className="mt-1 text-[12px] text-gold font-mono font-semibold uppercase tracking-wider">
                System Intelligence Probe Active
              </p>

              {/* Progress bar */}
              <div className="mt-6 w-full bg-white/[0.04] h-2 rounded-full overflow-hidden border border-white/[0.05]">
                <motion.div
                  className="bg-gold-gradient h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${scanProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="mt-2 flex justify-between w-full text-[11px] font-mono text-ivory/40">
                <span>Dataset scan active</span>
                <span className="text-gold">{scanProgress}%</span>
              </div>

              {/* Rotating logs */}
              <div className="mt-6 p-3 bg-matte-950 w-full rounded-lg border border-white/[0.05] h-14 flex items-center justify-center text-center">
                <motion.p
                  key={logIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-[11.5px] font-mono text-ivory/60"
                >
                  {scanLogs[logIndex]}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
