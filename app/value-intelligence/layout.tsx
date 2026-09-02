import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function ValueIntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InternalOnlyShield requiredPermission="value:read">
      {children}
    </InternalOnlyShield>
  );
}
