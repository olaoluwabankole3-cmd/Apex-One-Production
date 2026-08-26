"use client";

import { Sparkles } from "lucide-react";
import clsx from "clsx";

interface AiOrbProps {
  size?: "sm" | "md" | "lg";
  pulsing?: boolean;
}

const sizeMap = {
  sm: { wrapper: "h-8 w-8", icon: 14 },
  md: { wrapper: "h-11 w-11", icon: 18 },
  lg: { wrapper: "h-16 w-16", icon: 26 },
};

export default function AiOrb({ size = "sm", pulsing = false }: AiOrbProps) {
  const { wrapper, icon } = sizeMap[size];
  return (
    <div className={clsx("relative flex shrink-0 items-center justify-center", wrapper)}>
      <span
        className={clsx(
          "absolute inset-0 rounded-full bg-gold/20",
          pulsing && "animate-pulse-slow"
        )}
      />
      <span className="absolute inset-[3px] rounded-full border border-gold/40" />
      <Sparkles size={icon} className="relative z-10 text-gold" strokeWidth={1.75} />
    </div>
  );
}
