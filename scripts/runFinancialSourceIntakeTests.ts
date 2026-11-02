/**
 * CORTEX trusted-source foundation — synthetic only.
 * Executes with deterministic in-memory state plus real encrypted LocalStack S3.
 * Zero live bank credentials and no upload/ingestion HTTP route.
 */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import type { OrganizationMembershipRecord, UserRecord } from "../lib/backend/database/schema";
import {
  InMemoryObjectStorageAdapter, S3CompatibleObjectStorageService,
  type IObjectStorageService,
} from "../lib/backend/domains/documents/documentStorage";
import { FinancialSourceIntakeService } from "../lib/backend/domains/reconciliation/financialSourceIntakeService";
import { financialSourceSnapshotKey } from "../lib/backend/domains/reconciliation/financialSourceIntegrityGate";

const unique = randomUUID().slice(0, 12);
const org = "fin-source-test-" + unique;
const otherOrg = "fin-source-foreign-" + unique;
const H = "reference,currency,amount_minor,record_id,recorded_at\n";
const E = Buffer.from(H + "SETTLEMENT-001,NGN,10000,bank-src-1,2026-11-01T09:00:00Z\n", "utf8");
const O = Buffer.from(H + "SETTLEMENT-001,NGN,9900,provider-src-1,2026-11-01T09:00:01Z\n", "utf8");
const db = DatabaseStore.createFreshStore();
db.clearAll();
const now = new Date().toISOString();
const principals: Array<[string, string, string, "active" | "disabled"]> = [
  ["registrar", org, "Administrator", "active"],
  ["checker", org, "Administrator", "active"],
  ["custodian", org, "Administrator", "active"],
  ["disabled", org, "Administrator", "disabled"],
  ["outsider", otherOrg, "Administrator", "active"],
  ["readonly", org, "Finance", "active"],
];
for (const [id, tenant, role, status] of principals) {
  const u: UserRecord = { id, email: id + "@example.invalid", name: id, title: role,
    status, createdAt: now };
  const m: OrganizationMembershipRecord = {
    id: "membership-" + id, organizationId: tenant, userId: id, role, joinedAt: now,
  };
  db.users.set(id, u);
  db.memberships.set(m.id, m);
}
function ctx(id: string, tenant = org, role?: string): TenantContext {
  const user = principals.find(x => x[0] === id);
  const selected = role ?? user?.[2] ?? "Administrator";
  return {
    organizationId: tenant, userId: id, userEmail: id + "@example.invalid",
    userRole: selected, permissions: [...getPermissionsForRole(selected)],
    requestId: "source-custody-" + unique, timestamp: now,
  };
}
const rejects = async (task: () => Promise<unknown>, pattern: RegExp) =>
  assert.rejects(task, pattern);

async function exercise(storage: IObjectStorageService, label: string) {
  const service = new FinancialSourceIntakeService(db, storage);
  const ePolicy = await service.proposeSource(ctx("registrar"), {
    sourceLabel: label + "-settlement-expected", kind: "settlement", role: "expected",
  });
  assert.equal(ePolicy.status, "pending");
  assert.equal(ePolicy.externalSourceAuthorityVerified, false);
  await rejects(() => service.decideSource(ctx("registrar"), {
    registryId: ePolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Self approval must not bypass independent review",
  }), /may not approve/i);
  await rejects(() => service.decideSource(ctx("outsider", otherOrg), {
    registryId: ePolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Another tenant must not approve this source",
  }), /not found/i);
  await rejects(() => service.decideSource(ctx("disabled"), {
    registryId: ePolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Disabled user cannot review source policy",
  }), /membership/i);
  await rejects(() => service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: ePolicy.id, csvBytes: E,
  }), /no independent approval/i);
  const approvedExpected = await service.decideSource(ctx("checker"), {
    registryId: ePolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Allow synthetic expected-source intake under test controls",
  });
  assert.equal(approvedExpected.reviewedByUserId, "checker");
  await rejects(() => service.decideSource(ctx("checker"), {
    registryId: ePolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Duplicate decision must fail on old revision",
  }), /already reviewed/i);

  const oPolicy = await service.proposeSource(ctx("checker"), {
    sourceLabel: label + "-settlement-observed", kind: "settlement", role: "observed",
  });
  await service.decideSource(ctx("registrar"), {
    registryId: oPolicy.id, expectedRevision: 1, verdict: "approved",
    reason: "Independently allow synthetic observed-source intake",
  });
  // Competing approvals must have exactly one winner. PostgreSQL uses an
  // atomic status/revision CAS; memory uses its serialized transaction lock.
  const race = await service.proposeSource(ctx("registrar"), {
    sourceLabel: label + "-competing-checkers", kind: "fee", role: "observed",
  });
  const concurrent = await Promise.allSettled([
    service.decideSource(ctx("checker"), {
      registryId: race.id, expectedRevision: 1, verdict: "approved",
      reason: "First reviewer attempts policy authorization",
    }),
    service.decideSource(ctx("custodian"), {
      registryId: race.id, expectedRevision: 1, verdict: "rejected",
      reason: "Second reviewer attempts competing rejection",
    }),
  ]);
  assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter(x => x.status === "rejected").length, 1);
  assert.equal((await db.financialSourceRegistryRepo.findById(race.id, ctx("checker"))).revision, 2);

  const rejected = await service.proposeSource(ctx("registrar"), {
    sourceLabel: label + "-not-authorized", kind: "fee", role: "expected",
  });
  await service.decideSource(ctx("checker"), {
    registryId: rejected.id, expectedRevision: 1, verdict: "rejected",
    reason: "Synthetic test policy explicitly rejected",
  });
  await rejects(() => service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: rejected.id, csvBytes: E,
  }), /no independent approval/i);

  const source = await service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: ePolicy.id, csvBytes: E,
  });
  const paired = await service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: oPolicy.id, csvBytes: O,
  });
  assert.equal(source.organizationId, org);
  assert.equal(source.expectedBytes, E.length);
  assert.equal(source.rowCount, 1);
  assert.equal(source.byteIntegrityCheckedAtIntake, true);
  assert.equal(source.storageImmutabilityVerified, false);
  assert.equal(source.sourceAuthenticityVerified, false);
  assert.equal(source.coverageVerified, false);
  assert.equal(source.financialLossAssessed, false);
  if (storage instanceof S3CompatibleObjectStorageService) {
    assert.equal(source.encryption, "AES-256-GCM");
    assert.equal(paired.encryption, "AES-256-GCM");
  }
  await rejects(() => service.ingestInternalSnapshot(ctx("outsider", otherOrg), {
    registryId: ePolicy.id, csvBytes: E,
  }), /not found/i);
  await rejects(() => service.ingestInternalSnapshot(ctx("readonly"), {
    registryId: ePolicy.id, csvBytes: E,
  }), /financial:write|permission/i);
  await rejects(() => service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: ePolicy.id, csvBytes: Buffer.from("this is not a financial CSV", "utf8"),
  }), /five-column|header|CSV/i);
  await rejects(() => service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: ePolicy.id, csvBytes: Buffer.from([0xff, 0xfe, 0xff]),
  }), /UTF-8/i);
  await rejects(() => service.ingestInternalSnapshot(ctx("custodian"), {
    registryId: ePolicy.id, csvBytes: Buffer.alloc(128 * 1024 + 1),
  }), /131072 bytes/i);
  await rejects(() => service.previewPair(ctx("custodian"), {
    expectedSnapshotId: paired.id, observedSnapshotId: source.id,
  }), /incompatible/i);
  await rejects(() => service.previewPair(ctx("outsider", otherOrg), {
    expectedSnapshotId: source.id, observedSnapshotId: paired.id,
  }), /not found/i);
  const result = await service.previewPair(ctx("custodian"), {
    expectedSnapshotId: source.id, observedSnapshotId: paired.id,
  });
  assert.equal(result.contentIntegrityChecked, true);
  assert.equal(result.sourceAuthenticityVerified, false);
  assert.equal(result.storageImmutabilityVerified, false);
  assert.equal(result.coverageVerified, false);
  assert.equal(result.financialLossAssessed, false);
  assert.equal(result.preview.reconciliation.cases[0].differenceMinor, "-100");
  assert.equal(result.preview.reconciliation.cases[0].verificationState, "unverified");

  const key = financialSourceSnapshotKey(org, {
    sourceId: source.sourceId, expectedBytes: source.expectedBytes,
    expectedSha256: source.expectedSha256,
  });
  await storage.putObject(key, E.toString("utf8").replace("10000", "11000"), "text/csv");
  await rejects(() => service.previewPair(ctx("custodian"), {
    expectedSnapshotId: source.id, observedSnapshotId: paired.id,
  }), /SHA-256|digest/i);
  // This proves the key is not immutable (and the read gate fails closed).
  const audits = await db.auditLogsRepo.findMany(ctx("checker"), { limit: 100 });
  assert(audits.items.some(x => x.action === "financial_source:proposed"));
  assert(audits.items.some(x => x.action === "financial_source:reviewed"));
  assert(audits.items.some(x => x.action === "financial_source:snapshot_ingested"));
  assert(audits.items.some(x => x.action === "financial_source:pair_previewed"));
  const logText = JSON.stringify(audits.items);
  assert(!logText.includes("SETTLEMENT-001"));
  assert(!logText.includes("bank-src-1"));
  assert(!logText.includes("9900"));
  console.log("PASS: " + label + " independent policy, tenant isolation, source custody, tamper fail-closed and no financial certification");
}

async function main() {
  const originalEnv = process.env.APEX_DEPLOYMENT_ENVIRONMENT;
  process.env.APEX_DEPLOYMENT_ENVIRONMENT = "production";
  try {
    const gated = new FinancialSourceIntakeService(db, new InMemoryObjectStorageAdapter());
    await rejects(() => gated.proposeSource(ctx("registrar"), {
      sourceLabel: "should-not-work", kind: "settlement", role: "expected",
    }), /not found/i);
  } finally {
    if (originalEnv === undefined) delete process.env.APEX_DEPLOYMENT_ENVIRONMENT;
    else process.env.APEX_DEPLOYMENT_ENVIRONMENT = originalEnv;
  }
  await exercise(new InMemoryObjectStorageAdapter(), "memory");
  const env = process.env;
  for (const key of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "DOCUMENT_STORAGE_ENCRYPTION_KEY", "S3_ENDPOINT"]) {
    if (!env[key]) throw new Error("LocalStack S3 integration test configuration absent: " + key);
  }
  const s3 = new S3CompatibleObjectStorageService({
    bucket: env.S3_BUCKET!, region: env.S3_REGION!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    encryptionKey: env.DOCUMENT_STORAGE_ENCRYPTION_KEY!,
    endpoint: env.S3_ENDPOINT!,
  });
  await exercise(s3, "encrypted-s3");
  console.log("PASS: financial-source registry and encrypted synthetic intake integration");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
