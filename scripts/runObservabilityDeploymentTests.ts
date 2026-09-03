process.env.TEST_ENV = "true";

import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseStore } from "../lib/backend/database/store";
import type { TenantContext } from "../lib/backend/core/errors";
import {
  PostgresWireConnection,
  quotePostgresLiteral,
} from "../lib/backend/database/adapters/postgres/PostgresWireClient";
import {
  ensureDurableAuditConstraints,
  getDurableAuditStatus,
} from "../lib/backend/infrastructure/auditDurability";
import {
  assertProductionTopology,
  getProductionTopology,
} from "../lib/backend/infrastructure/deploymentTopology";
import {
  createReleasePlan,
  executeReleasePlan,
} from "../lib/backend/infrastructure/releaseControl";
import {
  getProductionReleaseIdentityIssues,
  resolveReleaseIdentity,
} from "../lib/backend/infrastructure/releaseIdentity";
import {
  createTelemetryEvent,
  normalizeRequestId,
  redactTelemetryAttributes,
} from "../lib/backend/observability/telemetry";

interface Result {
  name: string;
  passed: boolean;
  error?: string;
}

const results: Result[] = [];

async function check(name: string, work: () => void | Promise<void>): Promise<void> {
  try {
    await work();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
  }
}

function expectThrow(work: () => unknown, label: string): void {
  let rejected = false;
  try {
    work();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

async function expectAsyncThrow(work: () => Promise<unknown>, label: string): Promise<void> {
  let rejected = false;
  try {
    await work();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stage 11 tests");

  await check("1. Structured telemetry emits the canonical schema and immutable release identity", () => {
    const event = createTelemetryEvent(
      "stage11.test",
      {
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        outcome: "success",
        attributes: { component: "observability" },
      },
      {
        APP_ENV: "production",
        APEX_DEPLOYMENT_ENVIRONMENT: "production",
        APEX_RELEASE_ID: "release-stage11-001",
        APEX_COMMIT_SHA: "a".repeat(40),
        APEX_IMAGE_DIGEST: digest("b"),
      }
    );
    if (event.schemaVersion !== 1 || event.service !== "apex-one") throw new Error("Unexpected telemetry schema");
    if (event.release.complete !== true) throw new Error("Complete release identity was not retained");
    if (event.requestId !== "123e4567-e89b-42d3-a456-426614174000") throw new Error("Request correlation was lost");
  });

  await check("2. Telemetry redacts credentials, connection URLs and nested secrets", () => {
    const redacted = redactTelemetryAttributes({
      authorization: "Bearer stage11-secret",
      DATABASE_URL: "postgres://user:password@example.test/apex",
      nested: { token: "nested-secret", safe: "visible" },
    });
    const serialized = JSON.stringify(redacted);
    if (serialized.includes("stage11-secret") || serialized.includes("password@example") || serialized.includes("nested-secret")) {
      throw new Error("Sensitive telemetry material survived redaction");
    }
    if (!serialized.includes("visible") || !serialized.includes("[REDACTED]")) {
      throw new Error("Redaction removed safe context or failed to mark protected fields");
    }
  });

  await check("3. Request correlation accepts only canonical UUID request IDs", () => {
    const valid = "123e4567-e89b-42d3-a456-426614174000";
    if (normalizeRequestId(valid) !== valid) throw new Error("Valid request ID was rejected");
    if (normalizeRequestId("not-a-request-id\nforged") !== undefined) throw new Error("Malformed request ID was accepted");
  });

  await check("4. Production release identity requires release, commit, digest and environment", () => {
    const env = {
      APP_ENV: "production",
      APEX_DEPLOYMENT_ENVIRONMENT: "production",
      APEX_RELEASE_ID: "release-stage11-002",
      APEX_COMMIT_SHA: "c".repeat(40),
      APEX_IMAGE_DIGEST: digest("d"),
    };
    if (getProductionReleaseIdentityIssues(env).length !== 0) throw new Error("Valid release identity was rejected");
    if (!resolveReleaseIdentity(env).complete) throw new Error("Release identity did not become complete");
    if (getProductionReleaseIdentityIssues({ APP_ENV: "production" }).length < 4) {
      throw new Error("Incomplete production release identity did not fail closed");
    }
  });

  await check("5. Production topology encodes HA rollout and all six durable authorities", () => {
    const topology = assertProductionTopology(getProductionTopology());
    if (topology.runtime.minimumReplicas < 2) throw new Error("Topology is not highly available");
    if (topology.runtime.rollout.maxUnavailable !== 0) throw new Error("Rollout permits intentional unavailability");
    if (topology.authorities.length !== 6 || topology.authorities.some((authority) => !authority.required)) {
      throw new Error("Durable authority topology is incomplete");
    }
  });

  await check("6. Topology binds liveness, startup and readiness to distinct probe contracts", () => {
    const topology = getProductionTopology();
    const paths = [topology.probes.liveness.path, topology.probes.startup.path, topology.probes.readiness.path];
    if (new Set(paths).size !== 3) throw new Error("Deployment probes are not distinct");
  });

  await check("7. Staging promotion accepts only an immutable image digest", () => {
    const plan = createReleasePlan({
      action: "promote",
      environment: "staging",
      sourceEnvironment: "candidate",
      commitSha: "e".repeat(40),
      imageDigest: digest("f"),
      now: new Date("2026-09-03T00:00:00.000Z"),
      releaseId: "stage11-staging-release",
    });
    if (plan.targetImageDigest !== digest("f")) throw new Error("Promotion digest changed");
    expectThrow(
      () => createReleasePlan({ action: "promote", environment: "staging", commitSha: "e".repeat(40), imageDigest: "apex-one:latest" }),
      "Mutable-tag promotion"
    );
  });

  await check("8. Production promotion requires a staging source", () => {
    expectThrow(
      () => createReleasePlan({
        action: "promote",
        environment: "production",
        sourceEnvironment: "candidate",
        commitSha: "1".repeat(40),
        imageDigest: digest("2"),
      }),
      "Direct candidate-to-production promotion"
    );
    const plan = createReleasePlan({
      action: "promote",
      environment: "production",
      sourceEnvironment: "staging",
      commitSha: "1".repeat(40),
      imageDigest: digest("2"),
    });
    if (plan.sourceEnvironment !== "staging") throw new Error("Staging promotion source was not preserved");
  });

  await check("9. Rollback requires an explicit previous immutable digest", () => {
    expectThrow(
      () => createReleasePlan({ action: "rollback", environment: "production", commitSha: "3".repeat(40) }),
      "Rollback without target"
    );
    const plan = createReleasePlan({
      action: "rollback",
      environment: "production",
      sourceEnvironment: "staging",
      commitSha: "3".repeat(40),
      imageDigest: digest("4"),
      rollbackToDigest: digest("5"),
    });
    if (plan.targetImageDigest !== digest("5")) throw new Error("Rollback target was not preserved");
  });

  await check("10. Deployment controller execution verifies the active digest and does not place credentials in payload", async () => {
    const plan = createReleasePlan({
      action: "promote",
      environment: "staging",
      commitSha: "6".repeat(40),
      imageDigest: digest("7"),
      releaseId: "stage11-controller-test",
    });
    let capturedBody = "";
    let capturedAuthorization = "";
    const receipt = await executeReleasePlan(plan, {
      controlUrl: "http://127.0.0.1:9999",
      token: "stage11-controller-secret",
      allowInsecureLoopbackForTesting: true,
      fetchImpl: async (_input, init) => {
        capturedBody = String(init?.body || "");
        const headers = new Headers(init?.headers);
        capturedAuthorization = headers.get("authorization") || "";
        return new Response(
          JSON.stringify({
            deploymentId: "deployment-stage11-test",
            status: "succeeded",
            activeImageDigest: plan.targetImageDigest,
            verifiedCommitSha: plan.commitSha,
            completedAt: "2026-09-03T00:01:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    });
    if (!capturedAuthorization.includes("stage11-controller-secret")) throw new Error("Controller authentication header was not sent");
    if (capturedBody.includes("stage11-controller-secret") || capturedBody.includes("127.0.0.1")) {
      throw new Error("Controller credential or endpoint leaked into release payload");
    }
    if (receipt.activeImageDigest !== plan.targetImageDigest) throw new Error("Deployment receipt digest mismatch");
  });

  await check("11. Deployment controller rejects an unconfirmed or mismatched rollout", async () => {
    const plan = createReleasePlan({
      action: "promote",
      environment: "staging",
      commitSha: "8".repeat(40),
      imageDigest: digest("9"),
    });
    await expectAsyncThrow(
      () => executeReleasePlan(plan, {
        controlUrl: "http://127.0.0.1:9999",
        token: "test-token",
        allowInsecureLoopbackForTesting: true,
        fetchImpl: async () => new Response(JSON.stringify({
          deploymentId: "bad-deployment",
          status: "succeeded",
          activeImageDigest: digest("a"),
        }), { status: 200 }),
      }),
      "Mismatched deployment receipt"
    );
  });

  await check("12. Stage 11 durable audit migration is idempotent and ready", async () => {
    await ensureDurableAuditConstraints(databaseUrl);
    await ensureDurableAuditConstraints(databaseUrl);
    const status = await getDurableAuditStatus(databaseUrl);
    if (!status.appendOnlyTrigger || !status.requestCorrelationIndex) {
      throw new Error("Durable audit constraints were not installed");
    }
  });

  const store = DatabaseStore.createPostgresStore(databaseUrl);
  await store.bootstrapPersistence();
  await ensureDurableAuditConstraints(databaseUrl);
  await store.clearPersistentStateForTesting();
  const ctx: TenantContext = {
    organizationId: "org-stage11-observability",
    userId: "user-stage11-observability",
    userEmail: "stage11@example.test",
    userRole: "CEO",
    permissions: ["audit:read"],
    requestId: "123e4567-e89b-42d3-a456-426614174001",
    timestamp: new Date().toISOString(),
  };
  const audit = await store.recordAuditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    action: "stage11:durable_audit_test",
    resource: "Stage11",
    resourceId: "stage11-audit-resource",
    requestId: ctx.requestId,
    status: "success",
    metadata: { fixture: true },
    timestamp: new Date().toISOString(),
  });

  await check("13. PostgreSQL audit records remain readable through the tenant-scoped authority", async () => {
    const page = await store.auditLogsRepo.findMany(ctx, { limit: 10 });
    if (!page.items.some((item) => item.id === audit.id)) throw new Error("Durable audit record was not readable");
  });

  await check("14. Database-level UPDATE of a durable audit row is rejected", async () => {
    const connection = await PostgresWireConnection.connect(databaseUrl);
    try {
      await expectAsyncThrow(
        () => connection.query(
          `UPDATE apex_audit_logs SET occurred_at = occurred_at WHERE id = ${quotePostgresLiteral(audit.id)}`
        ),
        "Audit UPDATE"
      );
    } finally {
      await connection.close();
    }
  });

  await check("15. Database-level DELETE of a durable audit row is rejected", async () => {
    const connection = await PostgresWireConnection.connect(databaseUrl);
    try {
      await expectAsyncThrow(
        () => connection.query(`DELETE FROM apex_audit_logs WHERE id = ${quotePostgresLiteral(audit.id)}`),
        "Audit DELETE"
      );
    } finally {
      await connection.close();
    }
  });

  await check("16. Durable audit survives a new PostgreSQL-backed application instance", async () => {
    const restarted = DatabaseStore.createPostgresStore(databaseUrl);
    await restarted.bootstrapPersistence();
    const page = await restarted.auditLogsRepo.findMany(ctx, { limit: 10 });
    const restored = page.items.find((item) => item.id === audit.id);
    if (!restored || restored.requestId !== ctx.requestId) throw new Error("Audit correlation was lost after restart");
  });

  await check("17. Stage 11 release workflow is read-only to repository contents and environment-gated", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/stage11-release-control.yml"), "utf8");
    if (!/contents:\s*read/.test(workflow) || !/actions:\s*read/.test(workflow)) {
      throw new Error("Release workflow lacks explicit read-only repository/action permissions");
    }
    if (/contents:\s*write/.test(workflow)) throw new Error("Release workflow can write repository contents");
    if (!/environment:\s*\$\{\{\s*inputs\.environment\s*\}\}/.test(workflow)) {
      throw new Error("Release workflow is not protected by a GitHub deployment environment");
    }
  });

  await check("18. Release workflow requires exact-main Production CI before deployment control", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/stage11-release-control.yml"), "utf8");
    if (!workflow.includes("APEX ONE — Production CI") || !workflow.includes("git rev-parse HEAD")) {
      throw new Error("Release workflow does not gate deployment on exact-main CI evidence");
    }
    if (!workflow.includes("APEX_DEPLOYMENT_CONTROL_TOKEN") || !workflow.includes("release:control")) {
      throw new Error("Release workflow is not wired to the controlled deployment boundary");
    }
  });

  await check("19. Docker runtime is non-root and carries OCI release metadata", () => {
    const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
    if (!dockerfile.includes("USER node")) throw new Error("Production image is not non-root");
    if (!dockerfile.includes("org.opencontainers.image.revision")) throw new Error("Production image lacks commit metadata");
    if (!dockerfile.includes("io.apex.release.id")) throw new Error("Production image lacks release metadata");
  });

  await check("20. Startup/readiness endpoints and topology are kept outside normal traffic authorization", () => {
    const middleware = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    if (!middleware.includes("pathname.startsWith(\"/api/v1/health/\")")) {
      throw new Error("Health probes are not exempt from normal traffic readiness blocking");
    }
    const startup = fs.readFileSync(path.join(process.cwd(), "app/api/v1/health/startup/route.ts"), "utf8");
    if (!startup.includes("getInfrastructureReadiness") || !startup.includes("configurationIssueCount")) {
      throw new Error("Startup probe does not validate static deployment configuration");
    }
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 11 OBSERVABILITY & DEPLOYMENT");
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

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});