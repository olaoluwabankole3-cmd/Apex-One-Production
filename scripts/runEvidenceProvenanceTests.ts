import { DatabaseStore } from "../lib/backend/database/store";
import type { IDataProvider } from "../lib/backend/database/demoDataProvider";
import type {
  CustomerRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import { EvidenceService } from "../lib/backend/domains/evidence/evidenceService";
import {
  ConflictError,
  CrossTenantViolationError,
  NotFoundError,
  TenantContext,
  ValidationError,
} from "../lib/backend/core/errors";

interface CheckResult { name: string; passed: boolean; error?: string }
const results: CheckResult[] = [];

const EMPTY_PROVIDER: IDataProvider = {
  isDemoProvider: () => false,
  seedInitialTenants: () => undefined,
};

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required for Stage 6 evidence/provenance tests");
  return value;
}

function now(): string { return new Date().toISOString(); }

function ctx(org: string, userId: string, email: string): TenantContext {
  return {
    organizationId: org,
    userId,
    userEmail: email,
    userRole: "CEO",
    permissions: ["org:read", "org:write", "org:admin", "customer:read", "customer:write", "audit:read"],
    requestId: `req-${org}-${Math.random().toString(36).slice(2)}`,
    timestamp: now(),
  };
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
  return { id, email, name: id, title: "Evidence Tester", status: "active", createdAt: now() };
}

function membership(id: string, organizationId: string, userId: string): OrganizationMembershipRecord {
  return { id, organizationId, userId, role: "CEO", department: "Compliance", joinedAt: now() };
}

function customer(id: string): Omit<CustomerRecord, "organizationId"> {
  const timestamp = now();
  return {
    id,
    name: id,
    tier: "Enterprise",
    status: "active",
    healthScore: 90,
    arr: 100_000,
    owner: "Evidence Owner",
    contactName: "Evidence Contact",
    contactRole: "Director",
    contactEmail: `${id}@example.test`,
    tags: ["stage6"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function seedIdentity(store: DatabaseStore, organizationId: string, userId: string, email: string): Promise<TenantContext> {
  await store.createOrganizationRecord(organization(organizationId));
  await store.createUserRecord(user(userId, email));
  await store.createMembershipRecord(membership(`membership-${organizationId}-${userId}`, organizationId, userId));
  return ctx(organizationId, userId, email);
}

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
  } catch (error: any) {
    results.push({ name, passed: false, error: error?.stack || String(error) });
  }
}

async function expectRejects(fn: () => Promise<unknown>, ctor: new (...args: any[]) => Error): Promise<void> {
  let caught: unknown;
  try { await fn(); } catch (error) { caught = error; }
  if (!(caught instanceof ctor)) {
    throw new Error(`Expected ${ctor.name}, received ${caught instanceof Error ? caught.constructor.name : String(caught)}`);
  }
}

async function recordCustomerProvenance(service: EvidenceService, customerId: string, context: TenantContext) {
  return service.recordProvenance({
    subjectType: "Customer",
    subjectId: customerId,
    relation: "supports",
    sources: [{ kind: "document", sourceType: "Document", sourceReference: `crm-export:${customerId}` }],
    producerType: "human",
    producerId: "forged-client-id",
    producerLabel: "forged-client-label",
    method: "manual_source_review",
    confidence: 98,
  }, context);
}

async function verifyCustomer(service: EvidenceService, customerId: string, provenanceId: string, context: TenantContext) {
  return service.recordVerification({
    subjectType: "Customer",
    subjectId: customerId,
    state: "verified",
    provenanceIds: [provenanceId],
    criteria: ["source authenticity", "record consistency"],
  }, context);
}

async function certifyCustomer(service: EvidenceService, customerId: string, verificationRecordId: string, context: TenantContext, validUntil?: string) {
  return service.recordCertification({
    subjectType: "Customer",
    subjectId: customerId,
    state: "certified",
    verificationRecordId,
    authority: "Stage 6 Executive Certification",
    validUntil,
  }, context);
}

async function main() {
  console.log("=".repeat(80));
  console.log("APEX ONE — STAGE 6 EVIDENCE / PROVENANCE INTEGRATION");
  console.log("=".repeat(80));

  const memory = DatabaseStore.createFreshStore(EMPTY_PROVIDER);
  const memoryCtx = await seedIdentity(memory, "org-evidence-memory", "user-evidence-memory", "memory@example.test");
  await memory.customersRepo.create(customer("cust-memory-a"), memoryCtx);
  await memory.customersRepo.create(customer("cust-memory-b"), memoryCtx);
  const memoryService = new EvidenceService(memory);

  await check("1. Evidence subjects start unverified and uncertified", async () => {
    const status = await memoryService.getStatus("Customer", "cust-memory-a", memoryCtx);
    if (status.verificationState !== "unverified" || status.certificationState !== "uncertified") {
      throw new Error(`Unexpected initial state ${status.verificationState}/${status.certificationState}`);
    }
  });

  let memoryProvenanceId = "";
  await check("2. Human provenance uses trusted tenant actor identity and append-only storage", async () => {
    const record = await recordCustomerProvenance(memoryService, "cust-memory-a", memoryCtx);
    memoryProvenanceId = record.id;
    if (record.producerId !== memoryCtx.userId || record.producerLabel !== memoryCtx.userEmail) {
      throw new Error("Human provenance accepted forged producer identity");
    }
    await expectRejects(() => (memory.provenanceRepo as any).update(record.id, { notes: "rewrite" }, memoryCtx), ValidationError);
    await expectRejects(() => (memory.provenanceRepo as any).delete(record.id, memoryCtx), ValidationError);
  });

  await check("3. Evidence histories remain tenant isolated", async () => {
    const foreignCtx = ctx("org-foreign", "foreign-user", "foreign@example.test");
    await expectRejects(() => memory.provenanceRepo.findById(memoryProvenanceId, foreignCtx, "Provenance"), CrossTenantViolationError);
  });

  await check("4. Verification rejects provenance attached to a different subject", async () => {
    const other = await recordCustomerProvenance(memoryService, "cust-memory-b", memoryCtx);
    await expectRejects(() => memoryService.recordVerification({
      subjectType: "Customer",
      subjectId: "cust-memory-a",
      state: "verified",
      provenanceIds: [other.id],
      criteria: ["same subject evidence"],
    }, memoryCtx), ValidationError);
  });

  await check("5. Certification fails closed before verification exists", async () => {
    await expectRejects(() => memoryService.recordCertification({
      subjectType: "Customer",
      subjectId: "cust-memory-b",
      state: "certified",
      verificationRecordId: "verify-missing",
      authority: "Executive Certification",
    }, memoryCtx), NotFoundError);
  });

  let memoryVerificationId = "";
  let memoryCertificationId = "";
  await check("6. Verified then certified history resolves to independent canonical states", async () => {
    const verification = await verifyCustomer(memoryService, "cust-memory-a", memoryProvenanceId, memoryCtx);
    memoryVerificationId = verification.id;
    const certification = await certifyCustomer(memoryService, "cust-memory-a", verification.id, memoryCtx);
    memoryCertificationId = certification.id;
    const status = await memoryService.getStatus("Customer", "cust-memory-a", memoryCtx);
    if (status.verificationState !== "verified" || status.certificationState !== "certified") {
      throw new Error(`Unexpected canonical state ${status.verificationState}/${status.certificationState}`);
    }
    if (status.latestVerification?.id !== memoryVerificationId || status.latestCertification?.id !== memoryCertificationId) {
      throw new Error("Current state does not resolve to latest immutable history records");
    }
  });

  await check("7. Active certification blocks verification invalidation until certification is revoked", async () => {
    await expectRejects(() => memoryService.recordVerification({
      subjectType: "Customer",
      subjectId: "cust-memory-a",
      state: "invalidated",
      provenanceIds: [],
      criteria: ["source withdrawal"],
      reason: "Primary source withdrawn",
    }, memoryCtx), ConflictError);

    await memoryService.recordCertification({
      subjectType: "Customer",
      subjectId: "cust-memory-a",
      state: "revoked",
      authority: "Stage 6 Executive Certification",
      reason: "Underlying evidence is being withdrawn",
    }, memoryCtx);
    await memoryService.recordVerification({
      subjectType: "Customer",
      subjectId: "cust-memory-a",
      state: "invalidated",
      provenanceIds: [],
      criteria: ["source withdrawal"],
      reason: "Primary source withdrawn",
    }, memoryCtx);
    const status = await memoryService.getStatus("Customer", "cust-memory-a", memoryCtx);
    if (status.verificationState !== "invalidated" || status.certificationState !== "revoked") {
      throw new Error("Revocation/invalidation history did not resolve correctly");
    }
  });

  await check("8. Certification expiry is derived from validity time instead of asserted as a mutable label", async () => {
    const provenance = await recordCustomerProvenance(memoryService, "cust-memory-b", memoryCtx);
    const verification = await verifyCustomer(memoryService, "cust-memory-b", provenance.id, memoryCtx);
    const validUntil = new Date(Date.now() + 60_000).toISOString();
    await certifyCustomer(memoryService, "cust-memory-b", verification.id, memoryCtx, validUntil);
    const status = await memoryService.getStatus("Customer", "cust-memory-b", memoryCtx, new Date(Date.now() + 120_000));
    if (status.certificationState !== "expired") throw new Error(`Expected expired, got ${status.certificationState}`);
  });

  await check("9. In-memory transaction rollback removes evidence and its audit record atomically", async () => {
    const beforeProv = await memory.provenanceRepo.count(memoryCtx);
    const beforeAudit = await memory.auditLogsRepo.count(memoryCtx);
    await expectRejects(() => memory.runInTransaction(memoryCtx, async () => {
      await recordCustomerProvenance(memoryService, "cust-memory-b", memoryCtx);
      throw new Error("fault injection");
    }), Error);
    if (await memory.provenanceRepo.count(memoryCtx) !== beforeProv) throw new Error("Provenance survived rolled-back memory transaction");
    if (await memory.auditLogsRepo.count(memoryCtx) !== beforeAudit) throw new Error("Evidence audit survived rolled-back memory transaction");
  });

  const pg = DatabaseStore.createPostgresStore(databaseUrl());
  await pg.bootstrapPersistence();
  await pg.clearPersistentStateForTesting();
  const pgCtx = await seedIdentity(pg, "org-evidence-pg", "user-evidence-pg", "postgres@example.test");
  await pg.customersRepo.create(customer("cust-pg-a"), pgCtx);
  await pg.customersRepo.create(customer("cust-pg-b"), pgCtx);
  const pgService = new EvidenceService(pg);

  let pgProvenanceId = "";
  let pgVerificationId = "";
  await check("10. PostgreSQL persists append-only provenance, verification, and certification histories", async () => {
    const provenance = await recordCustomerProvenance(pgService, "cust-pg-a", pgCtx);
    pgProvenanceId = provenance.id;
    const verification = await verifyCustomer(pgService, "cust-pg-a", provenance.id, pgCtx);
    pgVerificationId = verification.id;
    await certifyCustomer(pgService, "cust-pg-a", verification.id, pgCtx);
    const status = await pgService.getStatus("Customer", "cust-pg-a", pgCtx);
    if (status.verificationState !== "verified" || status.certificationState !== "certified") {
      throw new Error("PostgreSQL canonical state did not resolve");
    }
  });

  await check("11. Fresh PostgreSQL provider instances recover evidence state after process restart", async () => {
    const fresh = DatabaseStore.createPostgresStore(databaseUrl());
    await fresh.bootstrapPersistence();
    const freshService = new EvidenceService(fresh);
    const status = await freshService.getStatus("Customer", "cust-pg-a", pgCtx);
    const provenance = await fresh.provenanceRepo.findById(pgProvenanceId, pgCtx, "Provenance");
    if (status.verificationState !== "verified" || status.certificationState !== "certified") {
      throw new Error("Fresh PostgreSQL provider lost canonical evidence state");
    }
    if (provenance.id !== pgProvenanceId) throw new Error("Fresh PostgreSQL provider lost provenance history");
  });

  await check("12. PostgreSQL evidence repositories reject update/delete even through runtime casts", async () => {
    await expectRejects(() => (pg.provenanceRepo as any).update(pgProvenanceId, { notes: "rewrite" }, pgCtx), ValidationError);
    await expectRejects(() => (pg.verificationsRepo as any).delete(pgVerificationId, pgCtx), ValidationError);
  });

  await check("13. PostgreSQL certification basis must be the current verified decision for the same subject", async () => {
    const otherProv = await recordCustomerProvenance(pgService, "cust-pg-b", pgCtx);
    const otherVerification = await verifyCustomer(pgService, "cust-pg-b", otherProv.id, pgCtx);
    await expectRejects(() => pgService.recordCertification({
      subjectType: "Customer",
      subjectId: "cust-pg-a",
      state: "certified",
      verificationRecordId: otherVerification.id,
      authority: "Executive Certification",
    }, pgCtx), ValidationError);
  });

  await check("14. PostgreSQL tenant boundary hides another organization's evidence history", async () => {
    const otherCtx = await seedIdentity(pg, "org-evidence-pg-other", "user-evidence-pg-other", "other@example.test");
    await expectRejects(() => pg.provenanceRepo.findById(pgProvenanceId, otherCtx, "Provenance"), NotFoundError);
    await expectRejects(() => pgService.getStatus("Customer", "cust-pg-a", otherCtx), NotFoundError);
  });

  await check("15. PostgreSQL transaction rollback removes evidence and audit atomically", async () => {
    const beforeProv = await pg.provenanceRepo.count(pgCtx);
    const beforeAudit = await pg.auditLogsRepo.count(pgCtx);
    await expectRejects(() => pg.runInTransaction(pgCtx, async () => {
      await recordCustomerProvenance(pgService, "cust-pg-b", pgCtx);
      throw new Error("postgres fault injection");
    }), Error);
    if (await pg.provenanceRepo.count(pgCtx) !== beforeProv) throw new Error("Provenance survived PostgreSQL rollback");
    if (await pg.auditLogsRepo.count(pgCtx) !== beforeAudit) throw new Error("Evidence audit survived PostgreSQL rollback");
  });

  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} [${result.passed ? "PASS" : "FAIL"}] ${result.name}`);
    if (!result.passed && result.error) console.error(result.error);
  }
  const passed = results.filter((result) => result.passed).length;
  console.log("-".repeat(80));
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${results.length - passed}`);
  console.log("=".repeat(80));
  if (passed !== results.length) process.exitCode = 1;
}

void main();
