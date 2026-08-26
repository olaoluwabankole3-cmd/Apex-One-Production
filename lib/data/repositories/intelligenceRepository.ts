import { Role } from "@/lib/types";
import { demoSuggestedPrompts } from "@/lib/data/demo";

export interface IntelligenceRepository {
  getExecutiveSummary(role: Role, organizationId?: string): Promise<string>;
  getSuggestedPrompts(role: Role, organizationId?: string): Promise<string[]>;
}

export class MockIntelligenceRepository implements IntelligenceRepository {
  async getExecutiveSummary(_role: Role, _organizationId?: string): Promise<string> {
    return "Organizational memory in standby. Connect enterprise data sources or import records to enable live executive briefings.";
  }

  async getSuggestedPrompts(role: Role, _organizationId?: string): Promise<string[]> {
    return demoSuggestedPrompts
      .filter(p => p.roles.includes(role))
      .map(p => p.label);
  }
}

export const intelligenceRepository = new MockIntelligenceRepository();
