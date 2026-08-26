"use client";

import CustomersWorkspace from "@/components/customers/CustomersWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function CustomersPage() {
  return (
    <InternalOnlyShield>
      <CustomersWorkspace />
    </InternalOnlyShield>
  );
}
