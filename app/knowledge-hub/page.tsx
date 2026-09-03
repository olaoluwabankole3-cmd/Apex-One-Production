import KnowledgeHubWorkspace from "@/components/knowledge-hub/KnowledgeHubWorkspace";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";

export default function KnowledgeHubPage() {
  return (
    <InternalOnlyShield requiredPermission="knowledge:read">
      <KnowledgeHubWorkspace />
    </InternalOnlyShield>
  );
}
