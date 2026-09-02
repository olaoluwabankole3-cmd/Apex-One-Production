import SettingsWorkspace from "@/components/settings/SettingsWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function SettingsPage() {
  return (
    <InternalOnlyShield requiredPermission="org:admin">
      <SettingsWorkspace />
    </InternalOnlyShield>
  );
}
