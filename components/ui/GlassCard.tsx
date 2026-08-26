"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassCard({ children, className, delay = 0, hover = true, onClick }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        "glass-panel rounded-2xl shadow-glass",
        hover && "glass-panel-hover",
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
