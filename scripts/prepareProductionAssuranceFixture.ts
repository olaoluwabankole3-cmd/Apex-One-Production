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

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
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
  ];

  await store.createOrganizationRecord(org);
  await store.createUserRecord(ceo);
  await store.createUserRecord(relationshipManager);
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
}

void main().catch((error) => {
  console.error("❌ Stage 10 fixture preparation failed:", error);
  process.exit(1);
});
