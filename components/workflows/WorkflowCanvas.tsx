"use client";

import { useRef, useState } from "react";
import { WorkflowConnection, WorkflowNode, WorkflowNodeStatus } from "@/lib/types";
import WorkflowNodeCard, { NODE_HEIGHT, NODE_WIDTH } from "./WorkflowNodeCard";

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  nodeStatuses: Record<string, WorkflowNodeStatus>;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onNodesChange: (nodes: WorkflowNode[]) => void;
}

export default function WorkflowCanvas({
  nodes,
  connections,
  nodeStatuses,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
}: WorkflowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [, forceRender] = useState(0);

  const canvasWidth = Math.max(...nodes.map((n) => n.x), 0) + NODE_WIDTH + 60;
  const canvasHeight = Math.max(...nodes.map((n) => n.y), 0) + NODE_HEIGHT + 60;

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    const node = nodes.find((n) => n.id === id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    dragState.current = {
      id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    };
    onSelectNode(id);

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const newX = Math.max(0, moveEvent.clientX - r.left - dragState.current.offsetX);
      const newY = Math.max(0, moveEvent.clientY - r.top - dragState.current.offsetY);
      const idx = nodes.findIndex((n) => n.id === dragState.current!.id);
      if (idx !== -1) {
        nodes[idx] = { ...nodes[idx], x: newX, y: newY };
        forceRender((v) => v + 1);
      }
    };

    const handleUp = () => {
      dragState.current = null;
      onNodesChange([...nodes]);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const nodeById = (id: string) => nodes.find((n) => n.id === id);

  const nodeStyleOverrides: Record<string, React.CSSProperties> = {
    n1: { marginTop: "0px", marginBottom: "0px", paddingTop: "4px" },
    n2: { paddingTop: "5px" },
    n3: { paddingTop: "5px" },
    n4: { paddingTop: "4px" },
    n5: { paddingTop: "4px" },
    n6: { paddingTop: "5px" },
    n7: { paddingTop: "4px" },
    n8: { paddingTop: "4px" },
    n9: { paddingTop: "4px" },
  };

  return (
    <div className="overflow-auto rounded-2xl border border-white/[0.07] bg-charcoal/60 p-2">
      <div
        ref={containerRef}
        className="relative"
        style={{ width: canvasWidth, height: canvasHeight, minWidth: "100%", marginTop: "0px" }}
      >
        <svg
          width={canvasWidth}
          height={canvasHeight}
          className="pointer-events-none absolute inset-0"
        >
          {connections.map((conn) => {
            const from = nodeById(conn.from);
            const to = nodeById(conn.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_WIDTH;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_HEIGHT / 2;
            const midX = (x1 + x2) / 2;
            const fromStatus = nodeStatuses[conn.from];
            const active = fromStatus === "success" || fromStatus === "running";

            return (
              <g key={conn.id}>
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={active ? "#C9A961" : "rgba(255,255,255,0.15)"}
                  strokeWidth={active ? 2 : 1.5}
                  className="transition-all duration-500"
                />
                {conn.branchLabel && (
                  <text
                    x={midX}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fill="rgba(247,245,240,0.35)"
                    fontSize={10}
                    fontFamily="var(--font-jetbrains-mono)"
                  >
                    {conn.branchLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <WorkflowNodeCard
            key={node.id}
            node={node}
            status={nodeStatuses[node.id] ?? "idle"}
            selected={selectedNodeId === node.id}
            onPointerDownNode={handlePointerDown}
            onSelect={onSelectNode}
            styleOverride={nodeStyleOverrides[node.id]}
          />
        ))}
      </div>
    </div>
  );
}
