import { SuggestedPrompt, QuickAction, ReportSection, Role } from "@/lib/types";
import { apiClient } from "@/lib/apiClient";

export interface AIConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRepository {
  ask(prompt: string): Promise<string>;
  getConversationHistory(conversationId: string): Promise<AIConversationMessage[]>;
  getSuggestedPrompts(role?: Role): Promise<SuggestedPrompt[]>;
  getQuickActions(role?: Role): Promise<QuickAction[]>;
  getReportSections(): Promise<ReportSection[]>;
  generateResponse(prompt: string, role: Role): Promise<{ content: string; richContent?: "performance-stats" | "executive-report" | "at-risk-customers" }>;
}

export class ApiAIRepository implements AIRepository {
  async ask(prompt: string): Promise<string> {
    try {
      const res = await apiClient.post<{ success: boolean; data?: { text?: string; response?: string }; text?: string }>("/api/v1/ai/chat", {
        message: prompt,
      });
      const responseText = res?.data?.text || res?.data?.response || res?.text;
      if (responseText) return responseText;
    } catch (e: any) {
      try {
        const fallback = await apiClient.post<{ text: string }>("/api/gemini", { prompt });
        if (fallback?.text) return fallback.text;
      } catch (err) {
        console.error("AI service failure:", err);
        throw new Error("AI intelligence service is currently unavailable.");
      }
    }
    throw new Error("AI intelligence service returned an empty response.");
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
    return defaultPrompts.filter(p => p.roles.includes(role));
  }

  async getQuickActions(role?: Role): Promise<QuickAction[]> {
    const defaultActions: QuickAction[] = [
      { id: "qa-1", label: "Generate Board Briefing", description: "Compile executive governance summary", icon: "FileText", roles: ["CEO"] },
      { id: "qa-2", label: "Audit Float Sweep", description: "Verify end-of-day treasury settlement", icon: "Activity", roles: ["CEO", "Operations"] },
      { id: "qa-3", label: "Verify Compliance Ledger", description: "Validate multi-tenant isolation proofs", icon: "ShieldCheck", roles: ["Compliance", "Operations"] },
    ];
    if (!role) return defaultActions;
    return defaultActions.filter(q => q.roles.includes(role));
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
    const text = await this.ask(prompt);
    return { content: text };
  }
}

export const aiRepository = new ApiAIRepository();

