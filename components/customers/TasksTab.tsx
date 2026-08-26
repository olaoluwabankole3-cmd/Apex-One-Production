"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import clsx from "clsx";
import { CustomerTask } from "@/lib/types";

const priorityStyle: Record<CustomerTask["priority"], string> = {
  high: "text-crimson bg-crimson/10 border-crimson/25",
  medium: "text-amber bg-amber/10 border-amber/25",
  low: "text-ivory/50 bg-white/[0.05] border-white/[0.1]",
};

interface TasksTabProps {
  tasks: CustomerTask[];
}

export default function TasksTab({ tasks }: TasksTabProps) {
  const [localTasks, setLocalTasks] = useState(tasks);

  if (tasks.length === 0) {
    return <p className="px-1 py-8 text-center text-[12.5px] text-ivory/35">No open tasks.</p>;
  }

  const toggle = (id: string) => {
    setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div className="space-y-2 py-1">
      {localTasks.map((task, i) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.04 }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
        >
          <button
            onClick={() => toggle(task.id)}
            aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
            className={clsx(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
              task.done ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20 text-transparent hover:border-gold/40"
            )}
          >
            <Check size={12} strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">
            <p className={clsx("text-[13px] font-medium", task.done ? "text-ivory/35 line-through" : "text-ivory/90")}>
              {task.title}
            </p>
            <p className="mt-0.5 text-[11px] text-ivory/40">
              Due {task.dueDate} · {task.assignee}
            </p>
          </div>
          <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", priorityStyle[task.priority])}>
            {task.priority}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
