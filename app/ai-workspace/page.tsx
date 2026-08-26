"use client";

import AiWorkspace from "@/components/ai-workspace/AiWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function AIWorkspacePage() {
  return (
    <InternalOnlyShield>
      <AiWorkspace />
    </InternalOnlyShield>
  );
}
