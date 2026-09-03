"use client";

import TrustedAiWorkspace from "@/components/ai-workspace/TrustedAiWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function AIWorkspacePage() {
  return (
    <InternalOnlyShield>
      <TrustedAiWorkspace />
    </InternalOnlyShield>
  );
}
