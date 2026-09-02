/**
 * APEX ONE — Document Search Index Boundary
 *
 * The production adapter deliberately derives search state from the authoritative
 * PostgreSQL Document row instead of persisting a second mutable copy of search
 * text. A document becomes searchable only after its PostgreSQL status is
 * atomically updated to `indexed`; update/delete therefore cannot leave a stale
 * independent index entry behind.
 */

import { createHash } from "node:crypto";
import { PostgresConnectionManager } from "../../database/adapters/postgres/PostgresPersistence";
import { quotePostgresLiteral } from "../../database/adapters/postgres/PostgresWireClient";

export interface IDocumentSearchIndex {
  indexDocument(organizationId: string, documentId: string, textContent: string): Promise<string>;
  removeDocument(organizationId: string, documentId: string): Promise<boolean>;
  search(organizationId: string, query: string): Promise<string[]>;
}

export interface DocumentSearchEnvironment {
  APEX_SEARCH_INDEX_ADAPTER?: string;
  DATABASE_URL?: string;
}

export function tokenizeDocumentSearchText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2)
    )
  );
}

export class InMemoryDocumentIndexAdapter implements IDocumentSearchIndex {
  private readonly index = new Map<string, Set<string>>();

  public async indexDocument(
    organizationId: string,
    documentId: string,
    textContent: string
  ): Promise<string> {
    const key = `${organizationId}:${documentId}`;
    this.index.set(key, new Set(tokenizeDocumentSearchText(textContent)));
    return `idx-${key}`;
  }

  public async removeDocument(organizationId: string, documentId: string): Promise<boolean> {
    return this.index.delete(`${organizationId}:${documentId}`);
  }

  public async search(organizationId: string, query: string): Promise<string[]> {
    const required = tokenizeDocumentSearchText(query);
    if (required.length === 0) return [];

    const matches: string[] = [];
    for (const [key, tokens] of this.index.entries()) {
      if (!key.startsWith(`${organizationId}:`)) continue;
      if (required.some((term) => tokens.has(term))) {
        matches.push(key.slice(organizationId.length + 1));
      }
    }
    return matches;
  }
}

const POSTGRES_DOCUMENT_SEARCH_TEXT_SQL = `
  COALESCE(record->>'name', '') || ' ' ||
  COALESCE(record->>'category', '') || ' ' ||
  COALESCE(record->>'tags', '') || ' ' ||
  COALESCE(record->>'aiSummary', '') || ' ' ||
  COALESCE(record->>'extractedFields', '')
`;

const POSTGRES_DOCUMENT_SEARCH_VECTOR_SQL = `to_tsvector('simple'::regconfig, ${POSTGRES_DOCUMENT_SEARCH_TEXT_SQL})`;

export const STAGE4_POSTGRES_SEARCH_MIGRATION_002 = `
CREATE INDEX IF NOT EXISTS apex_domain_records_document_search_gin_idx
  ON apex_domain_records USING GIN (${POSTGRES_DOCUMENT_SEARCH_VECTOR_SQL})
  WHERE entity_type = 'Document' AND record->>'status' = 'indexed';
`;

export class PostgresDocumentSearchIndex implements IDocumentSearchIndex {
  private readonly manager: PostgresConnectionManager;
  private bootstrapPromise?: Promise<void>;

  constructor(public readonly connectionString: string) {
    if (!connectionString?.trim()) {
      throw new Error("DATABASE_URL is required for PostgreSQL document search");
    }
    this.manager = new PostgresConnectionManager(connectionString);
  }

  public async bootstrap(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapInternal().catch((error) => {
        this.bootstrapPromise = undefined;
        throw error;
      });
    }
    return this.bootstrapPromise;
  }

  private async bootstrapInternal(): Promise<void> {
    await this.manager.bootstrap();
    await this.manager.withConnection(async (connection) => {
      await connection.query("BEGIN");
      try {
        await connection.query(STAGE4_POSTGRES_SEARCH_MIGRATION_002);
        await connection.query(
          `INSERT INTO apex_schema_migrations(version) VALUES ('002_stage4_document_search') ON CONFLICT (version) DO NOTHING`
        );
        await connection.query("COMMIT");
      } catch (error) {
        try { await connection.query("ROLLBACK"); } catch { /* preserve original migration error */ }
        throw error;
      }
    });
  }

  private indexReference(organizationId: string, documentId: string): string {
    const digest = createHash("sha256")
      .update(`${organizationId}:${documentId}`)
      .digest("hex")
      .slice(0, 32);
    return `pgfts-${digest}`;
  }

  public async indexDocument(
    organizationId: string,
    documentId: string,
    _textContent: string
  ): Promise<string> {
    await this.bootstrap();
    const exists = await this.manager.withConnection((connection) =>
      connection.query(`
        SELECT id
        FROM apex_domain_records
        WHERE entity_type = 'Document'
          AND organization_id = ${quotePostgresLiteral(organizationId)}
          AND id = ${quotePostgresLiteral(documentId)}
        LIMIT 1
      `)
    );

    if (exists.rows.length === 0) {
      throw new Error("Document is not present in the authenticated tenant search authority");
    }

    return this.indexReference(organizationId, documentId);
  }

  public async removeDocument(organizationId: string, documentId: string): Promise<boolean> {
    await this.bootstrap();
    const exists = await this.manager.withConnection((connection) =>
      connection.query(`
        SELECT id
        FROM apex_domain_records
        WHERE entity_type = 'Document'
          AND organization_id = ${quotePostgresLiteral(organizationId)}
          AND id = ${quotePostgresLiteral(documentId)}
        LIMIT 1
      `)
    );

    // Search state is derived from the authoritative row. Once PostgreSQL has
    // committed the document deletion, there is no independent entry to remove.
    return exists.rows.length === 0;
  }

  public async search(organizationId: string, query: string): Promise<string[]> {
    const terms = tokenizeDocumentSearchText(query);
    if (terms.length === 0) return [];

    await this.bootstrap();
    const tsQuery = terms.join(" | ");
    const result = await this.manager.withConnection((connection) =>
      connection.query(`
        SELECT id
        FROM apex_domain_records
        WHERE entity_type = 'Document'
          AND organization_id = ${quotePostgresLiteral(organizationId)}
          AND record->>'status' = 'indexed'
          AND ${POSTGRES_DOCUMENT_SEARCH_VECTOR_SQL} @@ to_tsquery('simple'::regconfig, ${quotePostgresLiteral(tsQuery)})
        ORDER BY id ASC
      `)
    );

    return result.rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string");
  }
}

export function createDocumentSearchIndexFromEnvironment(
  env: DocumentSearchEnvironment = {
    APEX_SEARCH_INDEX_ADAPTER: process.env.APEX_SEARCH_INDEX_ADAPTER,
    DATABASE_URL: process.env.DATABASE_URL,
  }
): IDocumentSearchIndex {
  const adapter = (env.APEX_SEARCH_INDEX_ADAPTER || "memory").trim().toLowerCase();

  if (adapter === "postgres") {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when APEX_SEARCH_INDEX_ADAPTER=postgres");
    }
    return new PostgresDocumentSearchIndex(databaseUrl);
  }

  if (adapter === "memory") {
    return new InMemoryDocumentIndexAdapter();
  }

  throw new Error(`Unsupported APEX_SEARCH_INDEX_ADAPTER: ${adapter}`);
}

export const documentSearchIndex: IDocumentSearchIndex = createDocumentSearchIndexFromEnvironment();
