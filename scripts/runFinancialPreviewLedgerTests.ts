/**
 * CORTEX financial preview metadata ledger — REAL PostgreSQL integration.
 * Synthetic data only. No AWS account, bank feed, live money or external action.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import type { TenantContext } from "../lib/backend/core/errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/backend/core/errors";
import { PostgresConnectionManager } from "../lib/backend/database/adapters/postgres/PostgresPersistence";
import { quotePostgresLiteral } from "../lib/backend/database/adapters/postgres/PostgresWireClient";
import { FinancialPreviewCaseLedger } from "../lib/backend/domains/reconciliation/financialPreviewCaseLedger";
import type { CsvPreviewRequest } from "../lib/backend/domains/reconciliation/csvPreviewService";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required for metadata ledger PostgreSQL tests");
const salt = randomUUID().slice(0, 12);
const org = "synthetic-finance-" + salt;
const other = "unrelated-finance-" + salt;
const manager = new PostgresConnectionManager(url);
const ledger = new FinancialPreviewCaseLedger(url);
const ctx = (organizationId = org,
  permissions = ["financial:read", "financial:write"]): TenantContext => ({
    organizationId,
    userId: "synthetic-reviewer",
    userEmail: "reviewer@example.invalid",
    userRole: "Compliance",
    permissions,
    requestId: "ledger-test-" + salt,
    timestamp: "2026-10-31T09:00:00.000Z",
  });

function request(ref = "REFERENCE-ALPHA", expectedAmount = "10000", observedAmount = "9800"): CsvPreviewRequest {
  return {
    kind: "settlement",
    expected: {
      feedId: "expected-" + ref,
      csv: "reference,currency,amount_minor,record_id,recorded_at\n" +
        ref + ",NGN," + expectedAmount + ",row-ledger,2026-10-31T09:00:00Z\n",
    },
    observed: {
      feedId: "observed-" + ref,
      csv: "reference,currency,amount_minor,record_id,recorded_at\n" +
        ref + ",NGN," + observedAmount + ",row-provider,2026-10-31T09:00:01Z\n",
    },
  };
}

async function rawCount(table: "apex_financial_preview_batches" | "apex_financial_preview_cases"): Promise<number> {
  const r = await manager.withConnection((connection) => connection.query(
    `SELECT count(*)::text AS count FROM ${table} WHERE organization_id = ${quotePostgresLiteral(org)}`
  ));
  return Number(r.rows[0].count);
}

async function auditLogs() {
  const store = DatabaseStore.createPostgresStore(url!);
  const result = await store.auditLogsRepo.findMany(ctx(), { limit: 100 });
  return result.items.filter((item) =>
    item.resource === "FinancialPreviewCaseLedger" && item.resourceId.startsWith("fpbatch-")
  );
}

async function check(name: string, test: () => Promise<void>): Promise<void> {
  await test();
  console.log("PASS: " + name);
}

async function main(): Promise<void> {
  const store = DatabaseStore.createPostgresStore(url!);
  await store.bootstrapPersistence();
  await store.createOrganizationRecord({
    id: org,
    name: "Synthetic Financial Institution",
    displayName: "Synthetic Financial Institution",
    slug: org,
    industry: "financial services",
    plan: "enterprise",
    currency: "NGN",
    currencySymbol: "₦",
    timezone: "Africa/Lagos",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await check("migration is present and bootstraps idempotently", async () => {
    const restart = new PostgresConnectionManager(url!);
    await restart.bootstrap();
    const r = await restart.withConnection((connection) =>
      connection.query("SELECT version FROM apex_schema_migrations WHERE version = '005_financial_preview_ledger'"));
    assert.equal(r.rows.length, 1);
  });

  let batchId = "";
  let caseId = "";
  await check("first intake durably registers candidate metadata and one audit event", async () => {
    const a = await ledger.register(ctx(), request());
    batchId = a.batchId;
    assert.equal(a.replayed, false);
    assert.equal(a.caseCount, 1);
    assert.equal(a.financialLossAssessed, false);
    assert.equal(a.coverageVerified, false);
    assert.equal(a.sourceStored, false);
    assert.match(batchId, /^fpbatch-[a-f0-9]{40}$/);
    const view = await ledger.getBatch(ctx(), batchId);
    assert.equal(view.cases.length, 1);
    caseId = view.cases[0].caseId;
    assert.equal(view.cases[0].triageStatus, "unreviewed");
    assert.equal(view.cases[0].comparisonStatus, "amount_discrepancy");
    assert.equal(view.cases[0].version, 1);
    assert.equal(await rawCount("apex_financial_preview_batches"), 1);
    assert.equal(await rawCount("apex_financial_preview_cases"), 1);
    const audits = await auditLogs();
    assert.equal(audits.filter((a) => a.action === "financial_preview_batch_registered").length, 1);
    assert(!JSON.stringify(audits).includes("REFERENCE-ALPHA"));
    assert(!JSON.stringify(audits).includes("9800"));
  });

  await check("exact same source and policy are idempotent across process instances", async () => {
    const restarted = new FinancialPreviewCaseLedger(url!);
    const second = await restarted.register(ctx(), request());
    assert.equal(second.batchId, batchId);
    assert.equal(second.replayed, true);
    assert.equal(await rawCount("apex_financial_preview_cases"), 1);
    assert.equal((await auditLogs()).filter((x) => x.action === "financial_preview_batch_registered").length, 1);
  });

  await check("different compare policy creates a distinct batch and audit record", async () => {
    const a = await ledger.register(ctx(), { ...request(), toleranceMinorByCurrency: { NGN: "200" } });
    assert.notEqual(a.batchId, batchId);
    assert.equal(a.caseCount, 0);
    assert.equal(await rawCount("apex_financial_preview_batches"), 2);
    assert.equal(await rawCount("apex_financial_preview_cases"), 1);
  });

  await check("tenant isolation hides both batch and candidate without existence disclosures", async () => {
    await assert.rejects(() => ledger.getBatch(ctx(other), batchId), NotFoundError);
    await assert.rejects(() => ledger.review(ctx(other), {
      batchId, caseId, expectedVersion: 1, to: "in_review",
      reasonCode: "potential_discrepancy",
    }), NotFoundError);
  });

  await check("financial:read alone cannot mutate candidate review", async () => {
    await assert.rejects(() => ledger.review(ctx(org, ["financial:read"]), {
      batchId, caseId, expectedVersion: 1, to: "in_review",
      reasonCode: "potential_discrepancy",
    }), ForbiddenError);
    await assert.rejects(() => ledger.register(ctx(org, ["financial:read"]), request("DIFFERENT")), ForbiddenError);
  });

  await check("financial:write alone cannot see financial cases", async () => {
    await assert.rejects(() => ledger.getBatch(ctx(org, ["financial:write"]), batchId), ForbiddenError);
  });

  await check("cannot impersonate another tenant with a forged case identifier", async () => {
    const fakeId = "recon-" + "a".repeat(32);
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId: fakeId, expectedVersion: 1, to: "in_review",
      reasonCode: "potential_discrepancy",
    }), NotFoundError);
  });

  await check("status and optimistic version checks fail closed", async () => {
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 0, to: "in_review",
      reasonCode: "potential_discrepancy",
    }), ValidationError);
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 1, to: "escalated",
      reasonCode: "potential_discrepancy",
    }), ConflictError);
    assert.equal((await ledger.getBatch(ctx(), batchId)).cases[0].version, 1);
  });

  await check("review changes are committed atomically with audit", async () => {
    const a = await ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 1, to: "in_review",
      reasonCode: "potential_discrepancy",
    });
    assert.equal(a.triageStatus, "in_review");
    assert.equal(a.version, 2);
    assert.equal(a.reviewerId, "synthetic-reviewer");
    const found = (await auditLogs()).filter((x) => x.action === "financial_preview_case_triaged");
    assert.equal(found.length, 1);
    assert.equal(found[0].metadata?.nextStatus, "in_review");
    assert.equal((await new FinancialPreviewCaseLedger(url!).getBatch(ctx(), batchId)).cases[0].version, 2);
  });

  await check("stale review cannot overwrite or duplicate its audit event", async () => {
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 1, to: "dismissed", reasonCode: "duplicate",
    }), ConflictError);
    assert.equal((await auditLogs()).filter((x) => x.action === "financial_preview_case_triaged").length, 1);
  });

  await check("in_review may be escalated but never marked verified or resolved", async () => {
    const result = await ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 2, to: "escalated",
      reasonCode: "source_gap",
    });
    assert.equal(result.triageStatus, "escalated");
    assert.equal(result.version, 3);
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 3, to: "dismissed", reasonCode: "other",
    }), ConflictError);
    await assert.rejects(() => ledger.review(ctx(), {
      batchId, caseId, expectedVersion: 3, to: "verified" as any, reasonCode: "other",
    }), ValidationError);
  });

  await check("failed audit insertion rolls back both registration and cases", async () => {
    const sabotaged = new FinancialPreviewCaseLedger(url!);
    (sabotaged as any).audits.record = async () => { throw new Error("Synthetic audit authority failure"); };
    await assert.rejects(() => sabotaged.register(ctx(), request("ROLLBACK-TEST")), /Synthetic audit/);
    assert.equal(await rawCount("apex_financial_preview_batches"), 2);
    assert.equal(await rawCount("apex_financial_preview_cases"), 1);
    const successful = await ledger.register(ctx(), request("ROLLBACK-TEST"));
    assert.equal(successful.replayed, false);
    assert.equal(successful.caseCount, 1);
  });

  await check("failed audit insertion also rolls back review status and version", async () => {
    const newBatch = await ledger.register(ctx(), request("AUDIT-ROLLBACK", "10000", "9998"));
    const view = await ledger.getBatch(ctx(), newBatch.batchId);
    const id = view.cases[0].caseId;
    const sabotaged = new FinancialPreviewCaseLedger(url!);
    (sabotaged as any).audits.record = async () => { throw new Error("Synthetic review audit rejection"); };
    await assert.rejects(() => sabotaged.review(ctx(), {
      batchId: newBatch.batchId, caseId: id, expectedVersion: 1,
      to: "in_review", reasonCode: "potential_discrepancy",
    }), /Synthetic review/);
    const after = (await ledger.getBatch(ctx(), newBatch.batchId)).cases[0];
    assert.equal(after.triageStatus, "unreviewed");
    assert.equal(after.version, 1);
  });

  await check("candidate storage never contains source CSV references or monetary values", async () => {
    const output = await manager.withConnection(async (connection) =>
      connection.query(`SELECT * FROM apex_financial_preview_cases WHERE organization_id = ${quotePostgresLiteral(org)}`)
    );
    const encoded = JSON.stringify(output.rows);
    assert(!encoded.includes("REFERENCE-ALPHA"));
    assert(!encoded.includes("row-provider"));
    assert(!encoded.includes("9800"));
    assert(!encoded.includes("10000"));
  });

  console.log("CORTEX FINANCIAL PREVIEW LEDGER: 15/15 PostgreSQL integration checks passed");
}

main().catch(error => {
  console.error("CORTEX FINANCIAL PREVIEW LEDGER FAILED:", error);
  process.exitCode = 1;
});
