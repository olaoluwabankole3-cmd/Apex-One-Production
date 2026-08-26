"use client";

import DocumentsWorkspace from "@/components/documents/DocumentsWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function DocumentsPage() {
  return (
    <InternalOnlyShield>
      <DocumentsWorkspace />
    </InternalOnlyShield>
  );
}
