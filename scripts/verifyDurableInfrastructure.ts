import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { PostgresConnectionManager } from "../lib/backend/database/adapters/postgres/PostgresPersistence";
import { getDurableAuditStatus } from "../lib/backend/infrastructure/auditDurability";
import { RedisWireClient } from "../lib/backend/infrastructure/redis/RedisWireClient";
import { S3CompatibleObjectStorageService } from "../lib/backend/domains/documents/documentStorage";
import { PostgresDocumentSearchIndex } from "../lib/backend/domains/documents/documentSearchIndex";
import {
  getInfrastructureReadiness,
  type InfrastructureEnvironment,
} from "../lib/backend/infrastructure/runtime";

type CheckResult = {
  name: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function runCheck(
  name: string,
  work: () => Promise<void>
): Promise<CheckResult> {
  const started = Date.now();
  try {
    await work();
    return { name, ok: true, durationMs: Date.now() - started };
  } catch {
    return {
      name,
      ok: false,
      durationMs: Date.now() - started,
      detail: "connection or authority verification failed",
    };
  }
}

async function verifyGemini(): Promise<void> {
  const key = required("GEMINI_API_KEY");
  const client = new GoogleGenAI({ apiKey: key });
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Gemini verification timed out")),
        8_000
      );
    });
    const response = await Promise.race([
      client.models.generateContent({
        model: "gemini-3.6-flash",
        contents:
          "Return exactly the text APEX_ONE_INFRA_OK. Do not add explanation.",
      }),
      timeout,
    ]);
    if (!response.text?.includes("APEX_ONE_INFRA_OK")) {
      throw new Error("Gemini returned an unexpected verification response");
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const env = process.env as InfrastructureEnvironment;
  const staticReadiness = getInfrastructureReadiness(env);

  const durable = staticReadiness.configuration;
  const expected = {
    database: "postgres",
    session: "redis",
    rateLimit: "redis",
    audit: "postgres",
    objectStorage: "s3",
    searchIndex: "postgres",
  } as const;

  const mismatches = Object.entries(expected)
    .filter(([key, value]) => durable[key as keyof typeof durable] !== value)
    .map(([key, value]) => `${key} must use ${value}`);

  if (staticReadiness.issues.length > 0 || mismatches.length > 0) {
    console.error("Durable infrastructure configuration is invalid.", {
      issues: [...staticReadiness.issues, ...mismatches],
    });
    process.exit(1);
  }

  const databaseUrl = required("DATABASE_URL");
  const redisUrl = required("REDIS_URL");
  const bucket = required("S3_BUCKET");
  const region = required("S3_REGION");
  const accessKeyId = required("S3_ACCESS_KEY_ID");
  const secretAccessKey = required("S3_SECRET_ACCESS_KEY");
  const encryptionKey = required("DOCUMENT_STORAGE_ENCRYPTION_KEY");
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;

  const checks = await Promise.all([
    runCheck("postgres.database", async () => {
      const manager = new PostgresConnectionManager(databaseUrl);
      await manager.withConnection(async (connection) => {
        const result = await connection.query("SELECT 1::text AS ok");
        if (result.rows[0]?.ok !== "1") {
          throw new Error("PostgreSQL probe returned unexpected result");
        }
      });
    }),
    runCheck("postgres.audit", async () => {
      const audit = await getDurableAuditStatus(databaseUrl);
      if (!audit.appendOnlyTrigger || !audit.requestCorrelationIndex) {
        throw new Error("Durable audit controls are incomplete");
      }
    }),
    runCheck("postgres.search", async () => {
      const search = new PostgresDocumentSearchIndex(databaseUrl);
      await search.bootstrap();
      await search.search("__apex_infrastructure_verifier__", "nonexistent");
    }),
    runCheck("redis.session-rate-limit", async () => {
      const redis = new RedisWireClient(redisUrl);
      if (!(await redis.ping())) throw new Error("Redis PING failed");
    }),
    runCheck("s3.encrypted-document-storage", async () => {
      const storage = new S3CompatibleObjectStorageService({
        bucket,
        region,
        accessKeyId,
        secretAccessKey,
        encryptionKey,
        endpoint,
      });
      const key = `infrastructure-verification/${randomUUID()}.txt`;
      const payload = Buffer.from(
        JSON.stringify({ purpose: "durable-infrastructure-verification" }),
        "utf8"
      );
      await storage.putObject(key, payload, "application/json");
      const restored = await storage.getObject(key);
      if (!restored || !Buffer.isBuffer(restored.data)) {
        throw new Error("S3 verification object could not be read");
      }
      if (!restored.data.equals(payload)) {
        throw new Error("S3 verification object did not survive encryption round-trip");
      }
      await storage.deleteObject(key);
    }),
    runCheck("gemini.generation", verifyGemini),
  ]);

  const failed = checks.filter((check) => !check.ok);
  console.log(
    JSON.stringify(
      {
        environment:
          process.env.APEX_DEPLOYMENT_ENVIRONMENT ||
          process.env.APP_ENV ||
          "unspecified",
        checkedAt: new Date().toISOString(),
        checks,
        status: failed.length === 0 ? "ready" : "not_ready",
      },
      null,
      2
    )
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(
    "Durable infrastructure verification failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
