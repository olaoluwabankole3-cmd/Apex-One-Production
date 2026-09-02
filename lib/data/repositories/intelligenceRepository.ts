import { Role } from "@/lib/types";
import { apiClient } from "@/lib/apiClient";
import { CustomerRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData } from "./httpCollection";

interface ValueSummaryResponse {
  totalCapturedValue: number;
}

export interface IntelligenceRepository {
  getExecutiveSummary(role: Role, organizationId?: string): Promise<string>;
  getSuggestedPrompts(role: Role, organizationId?: string): Promise<string[]>;
}

export class ApiIntelligenceRepository implements IntelligenceRepository {
  async getExecutiveSummary(role: Role, _organizationId?: string): Promise<string> {
    const [customers, valueSummary] = await Promise.all([
      collectAllCollectionData<CustomerRecord>("/api/v1/customers"),
      apiClient.getData<ValueSummaryResponse>("/api/v1/value/summary"),
    ]);

    const totalArrUSD = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const totalArrM = (totalArrUSD / 1000000).toFixed(1);
    const atRiskCount = customers.filter((c) => c.status === "at-risk" || c.healthScore < 70).length;
    const totalCaptured = valueSummary.totalCapturedValue
      ? (valueSummary.totalCapturedValue / 1000000).toFixed(1)
      : "0.0";

    if (role === "CEO") {
      return `Enterprise portfolio ARR stands at $${totalArrM}M across ${customers.length} accounts. ₦${totalCaptured}M in verified captured value recorded.`;
    }
    if (role === "Operations") {
      return "Workflow pipelines and system telemetry active across organizational infrastructure.";
    }
    if (role === "Compliance") {
      return "Multi-tenant security boundaries and immutable audit logs active.";
    }
    return `Relationship portfolio monitoring ${customers.length} active enterprise accounts with ${atRiskCount} accounts flagged for review.`;
  }

  async getSuggestedPrompts(role: Role, _organizationId?: string): Promise<string[]> {
    const promptMap: Record<Role, string[]> = {
      CEO: [
        "Summarize enterprise ARR and top revenue risks",
        "What are the biggest value recovery opportunities this quarter?",
        "Review subsidiary performance against annual targets",
      ],
      Operations: [
        "Analyze workflow capacity bottlenecks across subsidiaries",
        "Review SLA compliance reports and incident logs",
        "Check automated task execution error rates",
      ],
      "Relationship Manager": [
        "Show all at-risk enterprise accounts with renewal in 90 days",
        "Generate retention strategy briefing for top accounts",
        "Review expansion pipelines across commercial operations",
      ],
      Compliance: [
        "Audit uncollected receivables and float leakage",
        "Review cryptographic tenant isolation proofs",
        "Generate audit compliance report for regulatory inspection",
      ],
      "Customer Service": [
        "Review urgent customer support escalation queue",
        "Check account health trend for newly onboarded clients",
      ],
      "Customer / Investor": [
        "View portfolio performance and ESG compliance metrics",
        "Review institutional governance disclosures",
      ],
    };
    return promptMap[role] || promptMap.CEO;
  }
}

export const intelligenceRepository = new ApiIntelligenceRepository();
