"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRole } from "./RoleContext";
import { ALL_ROLES } from "@/lib/types";
import clsx from "clsx";


export default function RoleSwitcher() {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] font-medium text-ivory/80 transition-colors duration-200 hover:border-gold/30 hover:text-ivory"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="hidden sm:inline text-ivory/35">Viewing as</span>
        <span className="text-ivory">{role}</span>
        <ChevronDown
          size={14}
          className={clsx("text-ivory/40 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-charcoal-light/95 p-1.5 shadow-glass backdrop-blur-xl"
            role="listbox"
          >
            {ALL_ROLES.map((r) => (
              <li key={r}>

                <button
                  onClick={() => {
                    setRole(r);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150",
                    r === role ? "bg-gold/10 text-gold" : "text-ivory/70 hover:bg-white/[0.05] hover:text-ivory"
                  )}
                  role="option"
                  aria-selected={r === role}
                >
                  {r}
                  {r === role && <Check size={14} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
