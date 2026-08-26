/**
 * APEX ONE — Document Search Index Abstraction
 * 
 * ARCHITECTURAL NOTICE:
 * In Phase 2, this is an in-memory inverted text index.
 * In Phase 3, this will connect to Vector Database (e.g. pgvector, Vertex AI Vector Search).
 */

export interface IDocumentSearchIndex {
  indexDocument(organizationId: string, docId: string, textContent: string): Promise<string>;
  search(organizationId: string, query: string): Promise<string[]>;
  removeDocument(organizationId: string, docId: string): Promise<boolean>;
}

export class InMemoryDocumentIndexAdapter implements IDocumentSearchIndex {
  private readonly index = new Map<string, { orgId: string; docId: string; tokens: Set<string> }>();

  public async indexDocument(organizationId: string, docId: string, textContent: string): Promise<string> {
    const tokens = new Set(
      textContent
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );
    const indexKey = `${organizationId}:${docId}`;
    this.index.set(indexKey, { orgId: organizationId, docId, tokens });
    return `idx-${indexKey}`;
  }

  public async search(organizationId: string, query: string): Promise<string[]> {
    const queryTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const matches: string[] = [];
    for (const entry of this.index.values()) {
      if (entry.orgId !== organizationId) continue;
      const matched = queryTokens.some((q) => entry.tokens.has(q));
      if (matched) {
        matches.push(entry.docId);
      }
    }
    return matches;
  }

  public async removeDocument(organizationId: string, docId: string): Promise<boolean> {
    return this.index.delete(`${organizationId}:${docId}`);
  }
}

export const documentSearchIndex: IDocumentSearchIndex = new InMemoryDocumentIndexAdapter();
