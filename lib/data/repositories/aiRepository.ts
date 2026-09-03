import { SuggestedPrompt, QuickAction, ReportSection, Role } from "@/lib/types";
import { ApiClientContractError, apiClient } from "@/lib/apiClient";
import type { AiIntelligenceResponse } from "@/lib/backend/domains/ai/aiOrchestratorService";

export interface AIConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRepository {
  ask(prompt: string): Promise<string>;
  askTrusted(prompt: string, mode?: string, contextMemoryIds?: string[]): Promise<AiIntelligenceResponse>;
  getConversationHistory(conversationId: string): Promise<AIConversationMessage[]>;
  getSuggestedPrompts(role?: Role): Promise<SuggestedPrompt[]>;
  getQuickActions(role?: Role): Promise<QuickAction[]>;
  getReportSections(): Promise<ReportSection[]>;
  generateResponse(prompt: string, role: Role): Promise<{ content: string; richContent?: "performance-stats" | "executive-report" | "at-risk-customers" }>;
}

export class ApiAIRepository implements AIRepository {
  async askTrusted(prompt: string, mode = "Executive", contextMemoryIds?: string[]): Promise<AiIntelligenceResponse> {
    const result = await apiClient.postData<AiIntelligenceResponse>("/api/v1/ai/chat", {
      prompt,
      mode,
      ...(contextMemoryIds && contextMemoryIds.length > 0 ? { contextMemoryIds } : {}),
    });

    if (!result.modelProse || typeof result.modelProse.text !== "string") {
      throw new ApiClientContractError(
        "AI intelligence service did not return the Stage 8 modelProse contract",
        "/api/v1/ai/chat",
        "POST"
      );
    }
    if (!Array.isArray(result.facts) || !result.retrieval) {
      throw new ApiClientContractError(
        "AI intelligence service did not return Stage 8 facts/retrieval provenance",
        "/api/v1/ai/chat",
        "POST"
      );
    }

    return result;
  }

  async ask(prompt: string): Promise<string> {
    const result = await this.askTrusted(prompt);
    if (result.modelProse.text.trim().length === 0) {
      throw new ApiClientContractError(
        "AI intelligence service returned empty model prose",
        "/api/v1/ai/chat",
        "POST"
      );
    }
    return result.modelProse.text;
  }

  async getConversationHistory(_conversationId: string): Promise<AIConversationMessage[]> {
    return [];
  }

  async getSuggestedPrompts(role?: Role): Promise<SuggestedPrompt[]> {
    const defaultPrompts: SuggestedPrompt[] = [
      { id: "sp-1", label: "Executive ARR Briefing", prompt: "Provide a comprehensive breakdown of group ARR and renewal exposure.", roles: ["CEO", "Relationship Manager"] },
      { id: "sp-2", label: "Contract Leakage Audit", prompt: "Identify billing discrepancies and unindexed contracts across subsidiaries.", roles: ["CEO", "Compliance", "Operations"] },
      { id: "sp-3", label: "Operations SLA Benchmark", prompt: "Evaluate cross-subsidiary SLA adherence and incident queue latency.", roles: ["Operations", "Compliance"] },
      { id: "sp-4", label: "At-Risk Account Mitigation", prompt: "List enterprise accounts with health scores below 75 and formulate recovery plans.", roles: ["CEO", "Relationship Manager", "Customer Service"] },
    ];
    if (!role) return defaultPrompts;
    return defaultPrompts.filter((p) => p.roles.includes(role));
  }

  async getQuickActions(role?: Role): Promise<QuickAction[]> {
    const defaultActions: QuickAction[] = [
      { id: "qa-1", label: "Generate Board Briefing", description: "Compile executive governance summary", icon: "FileText", roles: ["CEO"] },
      { id: "qa-2", label: "Audit Float Sweep", description: "Review end-of-day treasury settlement evidence", icon: "Activity", roles: ["CEO", "Operations"] },
      { id: "qa-3", label: "Review Compliance Ledger", description: "Inspect multi-tenant isolation evidence", icon: "ShieldCheck", roles: ["Compliance", "Operations"] },
    ];
    if (!role) return defaultActions;
    return defaultActions.filter((q) => q.roles.includes(role));
  }

  async getReportSections(): Promise<ReportSection[]> {
    return [
      { id: "rep-1", title: "Executive Revenue Summary", summary: "Consolidated group revenue and margin performance" },
      { id: "rep-2", title: "Enterprise Account Health", summary: "Multi-factor churn risk and expansion indices" },
      { id: "rep-3", title: "Capacity & Operations Matrix", summary: "Departmental capacity utilization and workflow throughput" },
    ];
  }

  async generateResponse(
    prompt: string,
    _role: Role
  ): Promise<{ content: string; richContent?: "performance-stats" | "executive-report" | "at-risk-customers" }> {
    const result = await this.askTrusted(prompt);
    return { content: result.modelProse.text };
  }
}

export const aiRepository = new ApiAIRepository();
