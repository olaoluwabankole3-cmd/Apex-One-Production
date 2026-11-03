process.env.TEST_ENV = "true";

import { DatabaseStore } from "../lib/backend/database/store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import type { TenantContext } from "../lib/backend/core/errors";
import { getPermissionsForRole } from "../lib/backend/core/security";
import { hashPassword } from "../lib/backend/core/crypto";
import { RedisWireClient } from "../lib/backend/infrastructure/redis/RedisWireClient";
import {
  S3ObjectStorageError,
  S3WireClient,
} from "../lib/backend/infrastructure/s3/S3WireClient";
import { ensureDurableAuditConstraints } from "../lib/backend/infrastructure/auditDurability";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 10 production assurance`);
  return value;
}

function timestamp(): string {
  return new Date().toISOString();
}

function user(id: string, email: string, name: string, password: string): UserRecord {
  const credentials = hashPassword(password);
  return {
    id,
    email,
    name,
    title: "Stage 10 Assurance",
    status: "active",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    createdAt: timestamp(),
  };
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const redisUrl = required("REDIS_URL");

  // This fixture deliberately resets its test database and Redis. Never
  // allow a developer or operator to run it against institutional authorities.
  const databaseTarget = new URL(databaseUrl);
  const redisTarget = new URL(redisUrl);
  if (process.env.CI !== "true" || process.env.TEST_ENV !== "true" ||
      process.env.ASSURANCE_BASE_URL !== "http://localhost:3000" ||
      databaseTarget.hostname !== "127.0.0.1" || databaseTarget.port !== "11543" ||
      databaseTarget.pathname !== "/apex_stage10_test" ||
      redisTarget.hostname !== "127.0.0.1" || redisTarget.port !== "11679") {
    throw new Error("Stage 10 destructive fixture is restricted to isolated local CI services");
  }

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await ensureDurableAuditConstraints(databaseUrl);
  await store.clearPersistentStateForTesting();

  const org: OrganizationRecord = {
    id: "org-stage10-assurance",
    name: "Stage 10 Assurance Holdings",
    displayName: "Stage 10 Assurance",
    slug: "stage10-assurance",
    industry: "technology",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  const ceo = user(
    "user-stage10-ceo",
    "stage10.ceo@example.test",
    "Stage 10 CEO",
    "Stage10Enterprise!2026"
  );
  const relationshipManager = user(
    "user-stage10-rm",
    "stage10.rm@example.test",
    "Stage 10 Relationship Manager",
    "Stage10Enterprise!2026"
  );

  // Isolated Stage 10 identities for a real HTTP/browser banking golden path.
  // These are only created inside the disposable CI PostgreSQL + Redis fixture.
  const operations = user(
    "user-stage10-operations", "stage10.operations@example.test",
    "Stage 10 Operations Maker", "Stage10Enterprise!2026"
  );
  const finance = user(
    "user-stage10-finance", "stage10.finance@example.test",
    "Stage 10 Finance Operator", "Stage10Enterprise!2026"
  );
  const financeColleague = user(
    "user-stage10-finance-colleague", "stage10.finance-colleague@example.test",
    "Stage 10 Finance Team Member", "Stage10Enterprise!2026"
  );
  const checker = user(
    "user-stage10-checker", "stage10.checker@example.test",
    "Stage 10 Independent Checker", "Stage10Enterprise!2026"
  );

  const memberships: OrganizationMembershipRecord[] = [
    {
      id: "membership-stage10-ceo",
      organizationId: org.id,
      userId: ceo.id,
      role: "CEO",
      department: "Executive",
      joinedAt: timestamp(),
    },
    {
      id: "membership-stage10-rm",
      organizationId: org.id,
      userId: relationshipManager.id,
      role: "Relationship Manager",
      department: "Strategic Accounts",
      joinedAt: timestamp(),
    },
    {
      id: "membership-stage10-operations",
      organizationId: org.id,
      userId: operations.id,
      role: "Operations",
      department: "Operations",
      joinedAt: timestamp(),
    },
    {
      id: "membership-stage10-finance",
      organizationId: org.id,
      userId: finance.id,
      role: "Finance",
      department: "Finance",
      joinedAt: timestamp(),
    },
    {
      id: "membership-stage10-finance-colleague",
      organizationId: org.id,
      userId: financeColleague.id,
      role: "Finance",
      department: "Finance",
      joinedAt: timestamp(),
    },
    {
      id: "membership-stage10-checker",
      organizationId: org.id,
      userId: checker.id,
      role: "Administrator",
      joinedAt: timestamp(),
    },
  ];

  await store.createOrganizationRecord(org);
  await store.createUserRecord(ceo);
  await store.createUserRecord(relationshipManager);
  await store.createUserRecord(operations);
  await store.createUserRecord(finance);
  await store.createUserRecord(financeColleague);
  await store.createUserRecord(checker);
  for (const membership of memberships) await store.createMembershipRecord(membership);

  const ctx: TenantContext = {
    organizationId: org.id,
    userId: ceo.id,
    userEmail: ceo.email,
    userRole: "CEO",
    permissions: [...getPermissionsForRole("CEO")],
    isSuperAdmin: false,
    requestId: "stage10-assurance-seed",
    timestamp: timestamp(),
  } as TenantContext;

  await store.customersRepo.create(
    {
      id: "customer-stage10-grounding",
      name: "Assurance Grounding Customer",
      subsidiary: "Production Assurance Unit",
      tier: "Enterprise",
      status: "active",
      healthScore: 91,
      arr: 123456,
      owner: "Stage 10 Relationship Manager",
      contactName: "Assurance Contact",
      contactRole: "Director",
      contactEmail: "assurance.contact@example.test",
      since: "2026-01-01",
      tags: ["stage10", "grounding"],
      createdAt: timestamp(),
      updatedAt: timestamp(),
    },
    ctx
  );

  // Metadata-only document fixture; no bank records, CSV bytes or live S3
  // source are created or claimed. The case evidence remains unverified.
  await store.documentsRepo.create({
    id: "doc-stage10-banking-evidence",
    name: "Stage 10 synthetic source-review reference",
    fileType: "pdf",
    category: "Other",
    size: "0 B",
    uploadedBy: ctx.userEmail,
    storageKey: "stage10/synthetic-placeholder-not-a-bank-file",
    status: "processing",
    metadata: {
      fileSizeBytes: 0,
      mimeType: "application/pdf",
      storageUri: "s3://stage10-synthetic-placeholder-not-uploaded"
    },
    extractedFields: [],
    tags: ["stage10", "synthetic", "unverified"],
    createdAt: timestamp(),
    updatedAt: timestamp(),
  }, ctx);

  const redis = new RedisWireClient(redisUrl);
  const flushReply = await redis.execute(["FLUSHDB"]);
  if (flushReply !== "OK") throw new Error("Unable to reset Stage 10 Redis fixture");

  const s3 = new S3WireClient({
    bucket: required("S3_BUCKET"),
    region: required("S3_REGION"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
  });
  try {
    await s3.createBucketForIntegrationTests();
  } catch (error) {
    if (!(error instanceof S3ObjectStorageError) || error.status !== 409) throw error;
  }

  console.log("✅ Stage 10 synthetic production-assurance fixture prepared");
  console.log("CEO: stage10.ceo@example.test");
  console.log("RM: stage10.rm@example.test");
  console.log("Banking UAT synthetic roles prepared: Operations, Finance, independent Administrator");

}

void main().catch((error) => {
  console.error("❌ Stage 10 fixture preparation failed:", error);
  process.exit(1);
});
