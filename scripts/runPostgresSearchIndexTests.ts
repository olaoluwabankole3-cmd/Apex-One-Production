/**
 * APEX ONE — Stage 4E durable PostgreSQL document-search verification.
 */

import { hashPassword } from "../lib/backend/core/crypto";
import type { TenantContext } from "../lib/backend/core/errors";
import { DatabaseStore } from "../lib/backend/database/store";
import type {
  DocumentRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import { PostgresWireConnection } from "../lib/backend/database/adapters/postgres/PostgresWireClient";
import { DocumentService } from "../lib/backend/domains/documents/documentService";
import {
  createDocumentSearchIndexFromEnvironment,
  InMemoryDocumentIndexAdapter,
  PostgresDocumentSearchIndex,
} from "../lib/backend/domains/documents/documentSearchIndex";

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || error?.message || String(error) });
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 4E search integration tests`);
  return value;
}

const databaseUrl = required("DATABASE_URL");

function now(): string {
  return new Date().toISOString();
}

function organization(id: string): OrganizationRecord {
  return {
    id,
    name: `${id} Holdings`,
    displayName: id,
    slug: id,
    industry: "technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now(),
    updatedAt: now(),
  };
}

function user(id: string, email: string): UserRecord {
  const credentials = hashPassword("ApexSearch2026!");
  return {
    id,
    email,
    name: id,
    title: "Search Test Operator",
    status: "active",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    createdAt: now(),
  };
}

function membership(id: string, organizationId: string, userId: string): OrganizationMembershipRecord {
  return {
    id,
    organizationId,
    userId,
    role: "CEO",
    department: "Executive",
    joinedAt: now(),
  };
}

function context(organizationId: string, userId: string, email: string): TenantContext {
  return {
    organizationId,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: [
      "document:read",
      "document:write",
      "document:delete",
      "audit:read",
      "org:read",
      "org:admin",
      "knowledge:read",
      "knowledge:write",
    ],
    isSuperAdmin: false,
    requestId: `req-${organizationId}-${Date.now()}`,
    timestamp: now(),
  } as TenantContext;
}

async function seedIdentity(
  store: DatabaseStore,
  organizationId: string,
  userId: string,
  email: string
): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(organizationId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`mem-${organizationId}-${userId}`, organizationId, userId));
  return context(organizationId, userId, email);
}

function document(
  id: string,
  ctx: TenantContext,
  options: {
    name?: string;
    status?: DocumentRecord["status"];
    summary?: string;
    tags?: string[];
    extractedValue?: string;
  } = {}
): DocumentRecord {
  const createdAt = now();
  return {
    id,
    organizationId: ctx.organizationId,
    name: options.name || `${id}.pdf`,
    fileType: "pdf",
    category: "Other",
    size: "1 KB",
    uploadedBy: ctx.userEmail,
    storageKey: `search-tests/${ctx.organizationId}/${id}.pdf`,
    status: options.status || "indexed",
    metadata: {
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      storageUri: `s3://search-tests/${ctx.organizationId}/${id}.pdf`,
    },
    aiSummary: options.summary,
    extractedFields: options.extractedValue
      ? [{ label: "Search Marker", value: options.extractedValue, confidence: 99 }]
      : [],
    tags: options.tags || ["stage4e"],
    createdAt,
    updatedAt: createdAt,
  };
}

async function inspect(sql: string) {
  const connection = await PostgresWireConnection.connect(databaseUrl);
  try {
    return await connection.query(sql);
  } finally {
    await connection.close();
  }
}

async function main(): Promise<void> {
  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await store.clearPersistentStateForTesting();

  const ctxA = await seedIdentity(store, "org-search-a", "usr-search-a", "search-a@example.test");
  const ctxB = await seedIdentity(store, "org-search-b", "usr-search-b", "search-b@example.test");

  await check("1. Search provider factory selects PostgreSQL explicitly and fails closed on invalid durable configuration", async () => {
    const configured = createDocumentSearchIndexFromEnvironment({
      APEX_SEARCH_INDEX_ADAPTER: "postgres",
      DATABASE_URL: databaseUrl,
    });
    if (!(configured instanceof PostgresDocumentSearchIndex)) {
      throw new Error("PostgreSQL search configuration did not select PostgresDocumentSearchIndex");
    }

    let missingUrlRejected = false;
    try {
      createDocumentSearchIndexFromEnvironment({ APEX_SEARCH_INDEX_ADAPTER: "postgres" });
    } catch {
      missingUrlRejected = true;
    }
    if (!missingUrlRejected) throw new Error("PostgreSQL search configuration accepted a missing DATABASE_URL");

    let unknownRejected = false;
    try {
      createDocumentSearchIndexFromEnvironment({ APEX_SEARCH_INDEX_ADAPTER: "unknown", DATABASE_URL: databaseUrl });
    } catch {
      unknownRejected = true;
    }
    if (!unknownRejected) throw new Error("Unknown search adapter silently fell back to memory");
  });

  await check("2. Search migration bootstrapping is idempotent and durably versioned", async () => {
    await new PostgresDocumentSearchIndex(databaseUrl).bootstrap();
    await new PostgresDocumentSearchIndex(databaseUrl).bootstrap();

    const migration = await inspect(`
      SELECT COUNT(*) AS count
      FROM apex_schema_migrations
      WHERE version = '002_stage4_document_search'
    `);
    if (migration.rows[0]?.count !== "1") {
      throw new Error(`Expected one durable search migration row, received ${migration.rows[0]?.count}`);
    }
  });

  await check("3. PostgreSQL owns a partial GIN full-text index for authoritative indexed Document rows", async () => {
    const indexes = await inspect(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'apex_domain_records_document_search_gin_idx'
    `);
    const definition = indexes.rows[0]?.indexdef || "";
    if (indexes.rows.length !== 1) throw new Error("Durable document-search GIN index is missing");
    if (!/USING gin/i.test(definition) || !/to_tsvector/i.test(definition)) {
      throw new Error("Document-search index is not a PostgreSQL full-text GIN index");
    }
    if (!/entity_type/i.test(definition) || !/status/i.test(definition) || !/indexed/i.test(definition)) {
      throw new Error("Document-search index is not restricted to authoritative indexed Document rows");
    }
  });

  await check("4. Processing documents become searchable only after the authoritative PostgreSQL indexed-status commit", async () => {
    const id = "doc-search-process";
    await store.documentsRepo.create(
      document(id, ctxA, { name: "quasarprocess.pdf", status: "processing", tags: ["quasarprocess"] }),
      ctxA
    );

    const index = new PostgresDocumentSearchIndex(databaseUrl);
    if ((await index.search(ctxA.organizationId, "quasarprocess")).includes(id)) {
      throw new Error("Processing document was visible before authoritative indexed-status commit");
    }

    const service = new DocumentService(store, undefined, index);
    const processed = await service.processDocument(id, ctxA, "content does not create a second search authority");
    if (processed.status !== "indexed") throw new Error("Document processing did not commit indexed status");
    if (!(await index.search(ctxA.organizationId, "quasarprocess")).includes(id)) {
      throw new Error("Indexed document did not become visible through PostgreSQL search");
    }
  });

  await check("5. A fresh application/index instance sees durable search state after restart", async () => {
    const restartIndex = new PostgresDocumentSearchIndex(databaseUrl);
    const ids = await restartIndex.search(ctxA.organizationId, "quasarprocess");
    if (!ids.includes("doc-search-process")) {
      throw new Error("Fresh search adapter instance did not see durable PostgreSQL search state");
    }
  });

  await check("6. Multiple application instances share the same search authority", async () => {
    const id = "doc-search-cross-instance";
    await store.documentsRepo.create(
      document(id, ctxA, { summary: "heliotrope distributed authority marker" }),
      ctxA
    );

    const writer = new PostgresDocumentSearchIndex(databaseUrl);
    const reader = new PostgresDocumentSearchIndex(databaseUrl);
    const ref = await writer.indexDocument(ctxA.organizationId, id, "ignored compatibility text");
    if (!ref.startsWith("pgfts-") || ref.includes(ctxA.organizationId) || ref.includes(id)) {
      throw new Error("PostgreSQL search reference is not opaque");
    }
    if (!(await reader.search(ctxA.organizationId, "heliotrope")).includes(id)) {
      throw new Error("Independent search adapter did not observe shared PostgreSQL search state");
    }
  });

  await check("7. Tenant isolation is enforced inside the PostgreSQL search query boundary", async () => {
    const idA = "doc-search-tenant-a";
    const idB = "doc-search-tenant-b";
    await store.documentsRepo.create(document(idA, ctxA, { summary: "tenantboundary sharedmarker" }), ctxA);
    await store.documentsRepo.create(document(idB, ctxB, { summary: "tenantboundary sharedmarker" }), ctxB);

    const index = new PostgresDocumentSearchIndex(databaseUrl);
    const a = await index.search(ctxA.organizationId, "tenantboundary");
    const b = await index.search(ctxB.organizationId, "tenantboundary");
    if (!a.includes(idA) || a.includes(idB)) throw new Error("Tenant A search crossed the PostgreSQL organization boundary");
    if (!b.includes(idB) || b.includes(idA)) throw new Error("Tenant B search crossed the PostgreSQL organization boundary");
  });

  await check("8. Durable search preserves normalized token and OR-query semantics", async () => {
    const alpha = "doc-search-alpha";
    const zebra = "doc-search-zebra";
    await store.documentsRepo.create(document(alpha, ctxA, { summary: "alphaquarterly planning" }), ctxA);
    await store.documentsRepo.create(document(zebra, ctxA, { extractedValue: "zebrarecovery" }), ctxA);

    const ids = await new PostgresDocumentSearchIndex(databaseUrl).search(
      ctxA.organizationId,
      "ALPHAQUARTERLY!!! zz zebrarecovery"
    );
    if (!ids.includes(alpha) || !ids.includes(zebra)) {
      throw new Error("PostgreSQL search did not preserve case/punctuation normalization and OR semantics");
    }

    const ignoredShortTerms = await new PostgresDocumentSearchIndex(databaseUrl).search(ctxA.organizationId, "a zz");
    if (ignoredShortTerms.length !== 0) throw new Error("Two-character compatibility terms were not ignored");
  });

  await check("9. Authoritative PostgreSQL metadata changes update search without stale independent index state", async () => {
    const id = "doc-search-authoritative-update";
    await store.documentsRepo.create(document(id, ctxA, { summary: "legacysearchterm" }), ctxA);
    const index = new PostgresDocumentSearchIndex(databaseUrl);
    if (!(await index.search(ctxA.organizationId, "legacysearchterm")).includes(id)) {
      throw new Error("Initial authoritative search term was not visible");
    }

    await store.documentsRepo.update(
      id,
      { aiSummary: "replacementsearchterm", extractedFields: [], tags: ["stage4e"] },
      ctxA,
      "Document"
    );

    if ((await index.search(ctxA.organizationId, "legacysearchterm")).includes(id)) {
      throw new Error("Stale search term survived authoritative PostgreSQL update");
    }
    if (!(await index.search(ctxA.organizationId, "replacementsearchterm")).includes(id)) {
      throw new Error("Updated authoritative search term was not visible");
    }
  });

  await check("10. Authoritative PostgreSQL deletion removes search visibility automatically and cleanup is idempotent", async () => {
    const id = "doc-search-delete";
    await store.documentsRepo.create(document(id, ctxA, { summary: "deletionsearchmarker" }), ctxA);
    const index = new PostgresDocumentSearchIndex(databaseUrl);
    if (!(await index.search(ctxA.organizationId, "deletionsearchmarker")).includes(id)) {
      throw new Error("Deletion test document was not searchable before deletion");
    }

    await store.documentsRepo.delete(id, ctxA, "Document");
    if ((await index.search(ctxA.organizationId, "deletionsearchmarker")).includes(id)) {
      throw new Error("Deleted PostgreSQL document remained visible in search");
    }
    if (!(await index.removeDocument(ctxA.organizationId, id))) {
      throw new Error("Derived-index cleanup did not report idempotent completion after authoritative deletion");
    }
  });

  await check("11. Process-local compatibility Map state is never authoritative for PostgreSQL search", async () => {
    const memory = new InMemoryDocumentIndexAdapter();
    await memory.indexDocument(ctxA.organizationId, "phantom-search-only", "memoryphantomtoken");
    if (!(await memory.search(ctxA.organizationId, "memoryphantomtoken")).includes("phantom-search-only")) {
      throw new Error("Compatibility in-memory adapter setup failed");
    }

    const durable = await new PostgresDocumentSearchIndex(databaseUrl).search(ctxA.organizationId, "memoryphantomtoken");
    if (durable.includes("phantom-search-only")) {
      throw new Error("PostgreSQL search observed process-local compatibility Map state");
    }
  });

  await check("12. DocumentService query filtering resolves through the durable PostgreSQL search adapter", async () => {
    const durableId = "doc-search-service-query";
    await store.documentsRepo.create(document(durableId, ctxA, { summary: "servicesearchneedle" }), ctxA);
    await store.documentsRepo.create(document("doc-search-service-decoy", ctxA, { summary: "unrelatedterm" }), ctxA);

    const service = new DocumentService(
      DatabaseStore.createPostgresStore(databaseUrl),
      undefined,
      new PostgresDocumentSearchIndex(databaseUrl)
    );
    const page = await service.getDocuments(ctxA, { query: "servicesearchneedle", limit: 50 });
    const ids = page.items.map((item) => item.id);
    if (!ids.includes(durableId) || ids.includes("doc-search-service-decoy")) {
      throw new Error("DocumentService did not use the durable search authority to constrain PostgreSQL documents");
    }
  });

  await check("13. Cross-tenant index/remove attempts cannot reveal or mutate another tenant's search visibility", async () => {
    const id = "doc-search-cross-tenant-operation";
    await store.documentsRepo.create(document(id, ctxA, { summary: "crossoperationmarker" }), ctxA);
    const index = new PostgresDocumentSearchIndex(databaseUrl);

    let crossTenantIndexRejected = false;
    try {
      await index.indexDocument(ctxB.organizationId, id, "crossoperationmarker");
    } catch {
      crossTenantIndexRejected = true;
    }
    if (!crossTenantIndexRejected) throw new Error("Tenant B indexed Tenant A document identifier");

    if (!(await index.removeDocument(ctxB.organizationId, id))) {
      throw new Error("Tenant B cleanup should see no tenant-owned derived entry");
    }
    if (!(await index.search(ctxA.organizationId, "crossoperationmarker")).includes(id)) {
      throw new Error("Cross-tenant cleanup affected Tenant A search visibility");
    }
    if ((await index.search(ctxB.organizationId, "crossoperationmarker")).includes(id)) {
      throw new Error("Tenant B search revealed Tenant A document");
    }
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 4E POSTGRESQL DOCUMENT SEARCH INTEGRATION");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  console.log("================================================================================");

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Stage 4E PostgreSQL search integration failed:", error);
  process.exit(1);
});
