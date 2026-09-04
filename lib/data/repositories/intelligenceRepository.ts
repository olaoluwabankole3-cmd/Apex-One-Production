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

    const atRiskCount = customers.filter(
      (customer) => customer.status === "at-risk" || customer.healthScore < 70
    ).length;
    const hasCapturedValue = Number(valueSummary.totalCapturedValue || 0) > 0;

    if (role === "CEO") {
      return `Authorized enterprise records currently include ${customers.length} customer accounts; ${atRiskCount} are flagged for review. ${
        hasCapturedValue
          ? "Captured-value records are present in the authoritative value lifecycle."
          : "No captured value is currently recorded."
      }`;
    }

    if (role === "Relationship Manager") {
      return `Your authorized relationship scope currently includes ${customers.length} customer accounts; ${atRiskCount} are flagged for review.`;
    }

    if (role === "Customer Service") {
      return `${customers.length} authorized customer accounts are available to this workspace; ${atRiskCount} currently require attention based on account status or health score.`;
    }

    if (role === "Operations") {
      return "No authoritative operations briefing is connected to this summary yet. Operational facts will appear here only when the corresponding source records are available.";
    }

    if (role === "Compliance") {
      return "No authoritative compliance briefing is connected to this summary yet. Compliance conclusions will not be inferred from infrastructure status alone.";
    }

    return "This internal executive briefing is not available for the current session role.";
  }

  async getSuggestedPrompts(role: Role, _organizationId?: string): Promise<string[]> {
    const promptMap: Record<Role, string[]> = {
      CEO: [
        "Summarize authorized customer risk and value records",
        "What verified value opportunities are currently available?",
        "Which decisions require executive attention?",
      ],
      Operations: [
        "Summarize currently available workflow and action records",
        "Which operational records need follow-up?",
        "Show unresolved execution items with supporting evidence",
      ],
      "Relationship Manager": [
        "Show authorized at-risk customer accounts",
        "Summarize customer records that need follow-up",
        "Review available relationship evidence for my accounts",
      ],
      Compliance: [
        "Show available audit evidence for my authorized scope",
        "Summarize compliance-relevant records without inferring missing facts",
        "List evidence requiring human validation",
      ],
      "Customer Service": [
        "Show customer records currently flagged for review",
        "Summarize available service-related customer evidence",
      ],
      "Customer / Investor": [],
    };
    return promptMap[role] || [];
  }
}

export const intelligenceRepository = new ApiIntelligenceRepository();
