import { SuggestedPrompt, QuickAction, ReportSection, Role } from "@/lib/types";
import { demoSuggestedPrompts, demoQuickActions, demoReportSections } from "@/lib/data/demo";

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

export class MockAIRepository implements AIRepository {
  async ask(prompt: string): Promise<string> {
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.text || "No response received.";
    } catch (e: any) {
      console.error("AI Repository Error:", e);
      return `Telemetry and executive intelligence assessment completed for "${prompt}".`;
    }
  }

  async getConversationHistory(_conversationId: string): Promise<AIConversationMessage[]> {
    return [];
  }

  async getSuggestedPrompts(role?: Role): Promise<SuggestedPrompt[]> {
    if (!role) return demoSuggestedPrompts;
    return demoSuggestedPrompts.filter(p => p.roles.includes(role));
  }

  async getQuickActions(role?: Role): Promise<QuickAction[]> {
    if (!role) return demoQuickActions;
    return demoQuickActions.filter(q => q.roles.includes(role));
  }

  async getReportSections(): Promise<ReportSection[]> {
    return demoReportSections;
  }

  async generateResponse(
    prompt: string,
    _role: Role
  ): Promise<{ content: string; richContent?: "performance-stats" | "executive-report" | "at-risk-customers" }> {
    const text = await this.ask(prompt);
    return { content: text };
  }
}

export const aiRepository = new MockAIRepository();
