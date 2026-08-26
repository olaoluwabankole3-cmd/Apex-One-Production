"use client";

import clsx from "clsx";

interface HealthRingProps {
  score: number;
  size?: number;
}

function colorFor(score: number) {
  if (score >= 75) return "#3FBF8F";
  if (score >= 50) return "#E0A845";
  return "#D8455F";
}

export default function HealthRing({ score, size = 52 }: HealthRingProps) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = colorFor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <span
        className={clsx("absolute font-mono font-semibold")}
        style={{ fontSize: size * 0.28, color }}
      >
        {score}
      </span>
    </div>
  );
}
