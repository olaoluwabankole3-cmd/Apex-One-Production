import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

const envExample = source(".env.example");
const gitignore = source(".gitignore");
const staging = source("deploy/environments/staging.env.example");
const development = source("deploy/development/development.env.example");
const compose = source("deploy/development/docker-compose.infrastructure.yml");
const localstackInitPath = path.join(
  process.cwd(),
  "deploy/development/localstack/init-s3.sh"
);
const localstackInitMode = fs.statSync(localstackInitPath).mode;
const bootstrap = source("scripts/bootstrapInitialAdministrator.ts");
const verifier = source("scripts/verifyDurableInfrastructure.ts");
const restartWorker = source("scripts/infrastructureRestartWorker.ts");
const restartRunner = source("scripts/runInfrastructureRestartPersistenceTests.ts");
const secretContract = JSON.parse(
  source("deploy/environments/secret-contract.json")
);
const packageJson = JSON.parse(source("package.json"));

for (const [name, expected] of Object.entries({
  APEX_DATABASE_ADAPTER: "postgres",
  APEX_SESSION_ADAPTER: "redis",
  APEX_RATE_LIMIT_ADAPTER: "redis",
  APEX_AUDIT_ADAPTER: "postgres",
  APEX_OBJECT_STORAGE_ADAPTER: "s3",
  APEX_SEARCH_INDEX_ADAPTER: "postgres",
})) {
  assert(
    envExample.includes(`${name}=${expected}`),
    `.env.example must default ${name} to ${expected}`
  );
}

assert(
  !/APEX_(DATABASE|SESSION|RATE_LIMIT|AUDIT|OBJECT_STORAGE|SEARCH_INDEX)_ADAPTER=memory/.test(
    envExample
  ),
  ".env.example must not default application development back to memory adapters"
);

assert(
  gitignore.includes("deploy/development/development.env"),
  "Local durable development credentials are not ignored by Git"
);
assert(
  gitignore.includes("deploy/environments/*.env"),
  "Real deployment environment files are not ignored by Git"
);

for (const required of [
  "postgres:16-alpine",
  "redis:7-alpine",
  "localstack/localstack:3.8.1",
  "apex_postgres_data",
  "apex_redis_data",
  "apex_localstack_data",
]) {
  assert(
    compose.includes(required),
    `Development durable stack is missing ${required}`
  );
}

assert(
  (localstackInitMode & 0o111) !== 0,
  "LocalStack development initialization hook must remain executable"
);

assert(
  development.includes("APEX_DATABASE_ADAPTER=postgres") &&
    development.includes("APEX_SESSION_ADAPTER=redis") &&
    development.includes("APEX_OBJECT_STORAGE_ADAPTER=s3"),
  "Development profile is not wired to durable authorities"
);

assert(
  staging.includes("APP_ENV=production"),
  "Staging must activate the production fail-closed boundary"
);
assert(
  staging.includes("APEX_DEPLOYMENT_ENVIRONMENT=staging"),
  "Staging deployment identity is missing"
);
assert(
  staging.includes("sslmode=verify-full"),
  "Staging PostgreSQL example must demonstrate TLS verification"
);
assert(
  staging.includes("REDIS_URL=rediss://"),
  "Staging Redis example must require TLS"
);
assert(
  staging.includes("S3_ENDPOINT=https://"),
  "Staging custom S3 endpoint must demonstrate HTTPS"
);

assert(
  bootstrap.includes(
    'APEX_BOOTSTRAP_CONFIRM !== "CREATE_INITIAL_ADMIN"'
  ),
  "Initial administrator bootstrap lacks explicit confirmation"
);
assert(
  bootstrap.includes('getPermissionsForRole("Administrator")'),
  "Initial administrator role is not validated against backend authority"
);
assert(
  bootstrap.includes("passwordChangeRequired: true"),
  "Initial administrator must require a first-login password change"
);
assert(
  !bootstrap.includes("adminPassword,"),
  "Bootstrap script appears to include plaintext admin password in structured output"
);

for (const probe of [
  "postgres.database",
  "postgres.audit",
  "postgres.search",
  "redis.session-rate-limit",
  "s3.encrypted-document-storage",
  "gemini.generation",
]) {
  assert(
    verifier.includes(`"${probe}"`),
    `Active durable verifier is missing ${probe}`
  );
}

assert(
  restartWorker.includes('appEnv === "production"') &&
    restartWorker.includes('deployment === "staging"') &&
    restartWorker.includes('deployment === "production"'),
  "Restart persistence worker does not refuse real environments"
);
assert(
  restartRunner.includes('runWorker("write"') &&
    restartRunner.includes('runWorker("verify"'),
  "Restart persistence assurance does not use two fresh processes"
);

const requiredSecrets = new Set([
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "DOCUMENT_STORAGE_ENCRYPTION_KEY",
  "GEMINI_API_KEY",
  "APEX_BOOTSTRAP_ADMIN_PASSWORD",
]);
const declaredSecrets = new Set(
  (secretContract.secretAuthorities || []).map(
    (item: { name?: string }) => item.name
  )
);
for (const name of requiredSecrets) {
  assert(
    declaredSecrets.has(name),
    `Secret contract is missing ${name}`
  );
}

for (const script of [
  "infra:dev:up",
  "infra:dev:down",
  "infra:dev:destroy",
  "infra:verify",
  "infra:bootstrap-admin",
  "test:restart-persistence",
]) {
  assert(
    typeof packageJson.scripts?.[script] === "string",
    `package.json is missing ${script}`
  );
}

if (failures.length > 0) {
  console.error("APEX ONE — PHASE 3 INFRASTRUCTURE CONNECTION GATE FAILED");
  for (const failure of failures) console.error(`❌ ${failure}`);
  process.exit(1);
}

console.log("APEX ONE — PHASE 3 INFRASTRUCTURE CONNECTION GATE PASSED");
console.log("✅ Durable providers are the normal application-development profile");
console.log("✅ Local/deployment secret files are ignored");
console.log("✅ Development stack has persistent PostgreSQL, Redis, and S3-compatible volumes");
console.log("✅ Staging requires production fail-closed provider/TLS semantics");
console.log("✅ Initial admin bootstrap is explicit and first-login safe");
console.log("✅ Active verifier covers PostgreSQL, audit, search, Redis, S3, and Gemini");
console.log("✅ Restart persistence assurance refuses staging/production");
console.log("✅ Provider-neutral secret inventory is complete");
