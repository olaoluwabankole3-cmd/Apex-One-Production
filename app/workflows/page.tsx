"use client";

import WorkflowsWorkspace from "@/components/workflows/WorkflowsWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function WorkflowsPage() {
  return (
    <InternalOnlyShield>
      <WorkflowsWorkspace />
    </InternalOnlyShield>
  );
}
