/**
 * True PostgreSQL financial-source policy integration. Synthetic identities.
 * The critical invariant is exactly one winning checker in a concurrent
 * UPDATE ... WHERE status=pending AND revision=expected transition.
 */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import { FinancialSourceIntakeService } from "../lib/backend/domains/reconciliation/financialSourceIntakeService";
import { InMemoryObjectStorageAdapter } from "../lib/backend/domains/documents/documentStorage";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Disposable DATABASE_URL required");
const suffix = randomUUID().slice(0, 12);
const org = "source-pg-" + suffix;
const userIds = ["proposer-" + suffix, "checker-a-" + suffix, "checker-b-" + suffix];
const now = new Date().toISOString();
const ctx = (id: string): TenantContext => ({
  organizationId: org, userId: id, userEmail: id + "@example.invalid",
  userRole: "Administrator",
  permissions: [...getPermissionsForRole("Administrator")],
  requestId: "source-pg-test-" + suffix, timestamp: now,
});

let checkpoint = "initialization";
const hardStop = setTimeout(() => {
  console.error("FAIL: source policy PostgreSQL test deadline at stage:", checkpoint);
  process.exit(1);
}, 65000);

async function main() {
  checkpoint = "database bootstrap";
  const db = DatabaseStore.createPostgresStore(databaseUrl!);
  await db.bootstrapPersistence();
  checkpoint = "organization creation";
  await db.createOrganizationRecord({
    id: org, name: "Synthetic source custody institution",
    displayName: "Synthetic source custody institution",
    slug: org, industry: "financial services",
    plan: "enterprise", currency: "NGN", currencySymbol: "₦",
    timezone: "Africa/Lagos", createdAt: now, updatedAt: now,
  });
  checkpoint = "test identity creation";
  for (const id of userIds) {
    await db.createUserRecord({
      id, email: id + "@example.invalid", name: id, title: "Institution administrator",
      status: "active", createdAt: now,
    });
    await db.createMembershipRecord({
      id: "m-" + id, userId: id, organizationId: org,
      role: "Administrator", joinedAt: now,
    });
  }
  checkpoint = "create approval service";
  // Test-only instrumentation to identify any PostgreSQL transaction stall.
  const originalTransaction = db.runInTransaction.bind(db);
  (db as any).runInTransaction = async (context: TenantContext, work: (uow: any) => Promise<any>) => {
    checkpoint = "opening financial source transaction";
    return originalTransaction(context, async (uow) => {
      checkpoint = "transaction entered";
      return work(uow);
    });
  };
  const originalCreate = db.financialSourceRegistryRepo.create.bind(db.financialSourceRegistryRepo);
  (db.financialSourceRegistryRepo as any).create = async (...args: Parameters<typeof originalCreate>) => {
    checkpoint = "inserting policy record";
    const result = await originalCreate(...args);
    checkpoint = "policy record inserted";
    return result;
  };
  const auditInsert = db.recordAuditLog.bind(db);
  db.recordAuditLog = async (record) => {
    checkpoint = "inserting audit receipt";
    const result = await auditInsert(record);
    checkpoint = "audit receipt inserted";
    return result;
  };
  const service = new FinancialSourceIntakeService(db, new InMemoryObjectStorageAdapter());
  const policy = await service.proposeSource(ctx(userIds[0]), {
    sourceLabel: "synthetic-core-settlement-source",
    kind: "settlement", role: "expected",
  });
  assert.equal(policy.status, "pending");
  checkpoint = "self approval denial";
  await assert.rejects(() => service.decideSource(ctx(userIds[0]), {
    registryId: policy.id, expectedRevision: 1,
    verdict: "approved", reason: "Self authorization must never be possible",
  }), /may not approve/i);

  checkpoint = "competing source reviewers";
  const [a, b] = await Promise.allSettled([
    service.decideSource(ctx(userIds[1]), {
      registryId: policy.id, expectedRevision: 1,
      verdict: "approved", reason: "First reviewer independently authorizes synthetic intake",
    }),
    service.decideSource(ctx(userIds[2]), {
      registryId: policy.id, expectedRevision: 1,
      verdict: "rejected", reason: "Concurrent reviewer attempts rejection of source policy",
    }),
  ]);
  checkpoint = "concurrent review results";
  assert.equal([a, b].filter(x => x.status === "fulfilled").length, 1);
  assert.equal([a, b].filter(x => x.status === "rejected").length, 1);
  const after = await db.financialSourceRegistryRepo.findById(policy.id, ctx(userIds[0]));
  assert.equal(after.revision, 2);
  assert(["approved", "rejected"].includes(after.status));
  assert.notEqual(after.reviewedByUserId, userIds[0]);
  const audit = await db.auditLogsRepo.findMany(ctx(userIds[0]), { limit: 100 });
  assert.equal(audit.items.filter(x => x.resourceId === policy.id && x.action === "financial_source:reviewed").length, 1);

  checkpoint = "restart persistence";
  const restarted = DatabaseStore.createPostgresStore(databaseUrl!);
  await restarted.bootstrapPersistence();
  const persisted = await restarted.financialSourceRegistryRepo.findById(policy.id, ctx(userIds[1]));
  assert.equal(persisted.status, after.status);
  assert.equal(persisted.revision, 2);
  assert.equal(persisted.externalSourceAuthorityVerified, false);

  // Failure in the audit insert must rollback the conditional source approval.
  checkpoint = "audit failure rollback";
  const second = await service.proposeSource(ctx(userIds[0]), {
    sourceLabel: "synthetic-rollback-source", kind: "fee", role: "observed",
  });
  const originalAudit = db.recordAuditLog.bind(db);
  db.recordAuditLog = async () => { throw new Error("synthetic audit outage"); };
  try {
    await assert.rejects(() => service.decideSource(ctx(userIds[1]), {
      registryId: second.id, expectedRevision: 1, verdict: "approved",
      reason: "This approval must rollback without durable audit",
    }), /synthetic audit outage/i);
  } finally {
    db.recordAuditLog = originalAudit;
  }
  const reverted = await restarted.financialSourceRegistryRepo.findById(second.id, ctx(userIds[1]));
  assert.equal(reverted.status, "pending");
  assert.equal(reverted.revision, 1);
  clearTimeout(hardStop);
  console.log("PASS: PostgreSQL atomic independent source checker, serialized races, restart durability and audit rollback");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
