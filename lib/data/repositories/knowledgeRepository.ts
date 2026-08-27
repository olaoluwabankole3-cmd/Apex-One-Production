import { KnowledgeSynapse, GraphNode, HistoricalEvent } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { KnowledgeItemRecord } from "@/lib/backend/database/schema";

export interface KnowledgeRepository {
  getSynapses(organizationId?: string): Promise<KnowledgeSynapse[]>;
  getGraphNodes(organizationId?: string): Promise<GraphNode[]>;
  getHistoricalEvents(organizationId?: string): Promise<HistoricalEvent[]>;
  createKnowledgeItem(data: Partial<KnowledgeItemRecord>): Promise<KnowledgeSynapse>;
}

function mapRecordToSynapse(k: KnowledgeItemRecord): KnowledgeSynapse {
  const categoryMap: Record<string, any> = {
    Playbook: "Playbooks",
    Policy: "Policies",
    Onboarding: "Customer Knowledge",
    Strategy: "Strategy",
    Compliance: "Compliance",
    Incident: "Historical Intelligence",
    Other: "Policies"
  };

  const paragraphs = Array.isArray((k as any).sections)
    ? (k as any).sections.map((s: any) => `${s.heading}: ${s.content}`)
    : typeof k.content === "string"
    ? k.content.split("\n\n")
    : [k.summary || "Institutional knowledge record."];

  return {
    id: k.id,
    title: k.title,
    category: categoryMap[k.category] || "Policies",
    excerpt: k.summary || k.title || "Institutional knowledge record.",
    content: paragraphs,
    author: k.author,
    date: new Date(k.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    readTime: Math.max(2, Math.ceil(paragraphs.join(" ").length / 500)),
    pinned: (k as any).pinned || false,
  };
}

export class ApiKnowledgeRepository implements KnowledgeRepository {
  async getSynapses(_organizationId?: string): Promise<KnowledgeSynapse[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: KnowledgeItemRecord[] }>("/api/v1/knowledge");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToSynapse);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch knowledge items from API:", err);
      return [];
    }
  }

  async getGraphNodes(_organizationId?: string): Promise<GraphNode[]> {
    const synapses = await this.getSynapses();
    return synapses.map((s, index) => ({
      id: s.id,
      label: s.title,
      type: "Policy" as const,
      details: s.excerpt || s.title,
      connections: synapses.filter((_, i) => i !== index && i < 3).map(c => c.id),
    }));
  }

  async getHistoricalEvents(_organizationId?: string): Promise<HistoricalEvent[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>("/api/v1/memory");
      if (res && Array.isArray(res.data)) {
        return res.data.map(m => ({
          year: new Date(m.createdAt || Date.now()).getFullYear().toString(),
          title: m.title || "Organizational Memory Record",
          category: (m.type === "decision" ? "Compliance" : "Strategy") as any,
          description: m.content || "",
          evidence: `Source: ${m.source || "System Telemetry"}`,
          impactValue: "Verified",
        }));
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch historical events from API:", err);
      return [];
    }
  }

  async createKnowledgeItem(data: Partial<KnowledgeItemRecord>): Promise<KnowledgeSynapse> {
    const res = await apiClient.post<{ success: boolean; data: KnowledgeItemRecord }>("/api/v1/knowledge", data);
    return mapRecordToSynapse(res.data);
  }
}

export const knowledgeRepository = new ApiKnowledgeRepository();

