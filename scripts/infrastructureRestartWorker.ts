import { createHash } from "node:crypto";
import { createApplicationInfrastructure } from "../lib/backend/infrastructure/composition";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  UserRecord,
} from "../lib/backend/database/schema";
import { hashPassword } from "../lib/backend/core/crypto";
import { getPermissionsForRole } from "../lib/backend/core/security";
import { S3WireClient } from "../lib/backend/infrastructure/s3/S3WireClient";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 24)}`;
}

function refuseRealEnvironment(): void {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const deployment = process.env.APEX_DEPLOYMENT_ENVIRONMENT
    ?.trim()
    .toLowerCase();
  if (
    appEnv === "production" ||
    deployment === "staging" ||
    deployment === "production"
  ) {
    throw new Error(
      "Restart-persistence worker may run only against disposable development/test infrastructure"
    );
  }
  if (process.env.TEST_ENV !== "true") {
    throw new Error("TEST_ENV=true is required for restart-persistence assurance");
  }
}

async function createTestBucket(): Promise<void> {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!endpoint) return;
  const client = new S3WireClient({
    bucket: required("S3_BUCKET"),
    region: required("S3_REGION"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    endpoint,
  });
  try {
    await client.createBucketForIntegrationTests();
  } catch {
    // S3 bucket creation is idempotent enough for the disposable test path:
    // an existing bucket is acceptable and the subsequent object write is the authority.
  }
}

async function write(marker: string): Promise<void> {
  await createTestBucket();
  const infrastructure = createApplicationInfrastructure(process.env);
  await infrastructure.database.bootstrapPersistence();

  const organizationId = stableId("org_restart", marker);
  const userId = stableId("usr_restart", marker);
  const membershipId = stableId("mem_restart", marker);
  const email = `${marker}@restart.example.test`;
  const now = new Date().toISOString();

  const organization: OrganizationRecord = {
    id: organizationId,
    name: "APEX ONE Restart Persistence",
    displayName: "APEX ONE Restart Persistence",
    slug: `restart-${marker.slice(0, 20)}`,
    industry: "Assurance",
    plan: "enterprise",
    currency: "USD",
    currencySymbol: "$",
    timezone: "UTC",
    createdAt: now,
    updatedAt: now,
  };

  const credentials = hashPassword("RestartPersistencePassword!");
  const user: UserRecord = {
    id: userId,
    email,
    username: `restart.${marker.slice(0, 20)}`,
    name: "Restart Persistence User",
    title: "Assurance",
    status: "active",
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    createdAt: now,
  };

  const membership: OrganizationMembershipRecord = {
    id: membershipId,
    organizationId,
    userId,
    role: "Administrator",
    department: "Assurance",
    joinedAt: now,
  };

  await infrastructure.database.createOrganizationRecord(organization);
  await infrastructure.database.createUserRecord(user);
  await infrastructure.database.createMembershipRecord(membership);

  const session = await infrastructure.sessionStore.createSession({
    user: { id: userId, email, name: user.name },
    org: { id: organizationId, name: organization.displayName },
    role: "Administrator",
    permissions: [...getPermissionsForRole("Administrator")],
    ttlSeconds: 600,
    userAgent: "phase3-restart-persistence-assurance",
  });

  const objectKey = `restart-persistence/${marker}.txt`;
  await infrastructure.objectStorage.putObject(
    objectKey,
    Buffer.from(JSON.stringify({ marker, purpose: "restart-persistence" }), "utf8"),
    "application/json"
  );

  process.stdout.write(
    JSON.stringify({
      marker,
      organizationId,
      userId,
      membershipId,
      sessionToken: session.token,
      objectKey,
    })
  );
}

async function verify(marker: string): Promise<void> {
  const stateRaw = required("APEX_RESTART_PERSISTENCE_STATE");
  const state = JSON.parse(stateRaw) as {
    marker: string;
    organizationId: string;
    userId: string;
    membershipId: string;
    sessionToken: string;
    objectKey: string;
  };

  if (state.marker !== marker) {
    throw new Error("Restart-persistence marker mismatch");
  }

  const infrastructure = createApplicationInfrastructure(process.env);
  const organization = await infrastructure.database.findOrganizationById(
    state.organizationId
  );
  const user = await infrastructure.database.findUserById(state.userId);
  const membership = await infrastructure.database.findUserMembership(
    state.userId,
    state.organizationId
  );
  const session = await infrastructure.sessionStore.getSession(
    state.sessionToken
  );
  const object = await infrastructure.objectStorage.getObject(state.objectKey);

  if (!organization || organization.id !== state.organizationId) {
    throw new Error("PostgreSQL organization state did not survive process restart");
  }
  if (!user || user.id !== state.userId) {
    throw new Error("PostgreSQL user state did not survive process restart");
  }
  if (
    !membership ||
    membership.id !== state.membershipId ||
    membership.role !== "Administrator"
  ) {
    throw new Error("PostgreSQL membership state did not survive process restart");
  }
  if (
    !session ||
    session.userId !== state.userId ||
    session.organizationId !== state.organizationId
  ) {
    throw new Error("Redis session state did not survive process restart");
  }
  if (!object || !Buffer.isBuffer(object.data)) {
    throw new Error("S3 encrypted object state did not survive process restart");
  }
  const restored = JSON.parse(object.data.toString("utf8")) as {
    marker?: string;
    purpose?: string;
  };
  if (
    restored.marker !== marker ||
    restored.purpose !== "restart-persistence"
  ) {
    throw new Error("S3 encrypted object changed across process restart");
  }

  await infrastructure.sessionStore.revokeSession(state.sessionToken);
  await infrastructure.objectStorage.deleteObject(state.objectKey);

  process.stdout.write(
    JSON.stringify({
      status: "passed",
      marker,
      authorities: ["postgres", "redis", "s3"],
    })
  );
}

async function main(): Promise<void> {
  refuseRealEnvironment();
  const mode = process.argv[2];
  const marker = required("APEX_RESTART_PERSISTENCE_MARKER");

  if (mode === "write") {
    await write(marker);
    return;
  }
  if (mode === "verify") {
    await verify(marker);
    return;
  }
  throw new Error("Usage: infrastructureRestartWorker.ts <write|verify>");
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
