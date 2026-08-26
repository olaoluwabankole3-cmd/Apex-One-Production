import { KnowledgeSynapse, GraphNode, HistoricalEvent, demoSynapses, demoGraphNodes, demoHistoricalEvents } from "@/lib/data/demo";

export interface KnowledgeRepository {
  getSynapses(organizationId?: string): Promise<KnowledgeSynapse[]>;
  getGraphNodes(organizationId?: string): Promise<GraphNode[]>;
  getHistoricalEvents(organizationId?: string): Promise<HistoricalEvent[]>;
}

export class MockKnowledgeRepository implements KnowledgeRepository {
  async getSynapses(_organizationId?: string): Promise<KnowledgeSynapse[]> {
    return demoSynapses;
  }

  async getGraphNodes(_organizationId?: string): Promise<GraphNode[]> {
    return demoGraphNodes;
  }

  async getHistoricalEvents(_organizationId?: string): Promise<HistoricalEvent[]> {
    return demoHistoricalEvents;
  }
}

export const knowledgeRepository = new MockKnowledgeRepository();
