# APEX ONE durable infrastructure connection

Phase 3 moves normal APEX ONE execution away from process-local state. The
application's durable authorities are:

| Responsibility | Authority |
| --- | --- |
| Application data | PostgreSQL |
| Audit | PostgreSQL, same database authority |
| Document search | PostgreSQL |
| Sessions | Redis |
| Rate limiting | Redis |
| Documents/files | S3-compatible object storage with application-layer AES-256-GCM encryption |
| AI generation | Google Gemini |
| Credentials/keys | deployment platform protected secrets injected as environment variables |

Memory providers remain available for isolated tests only. They are not the
normal application-development profile after Phase 3.

## 1. Durable development environment

Copy the example without committing the result:

```bash
cp deploy/development/development.env.example deploy/development/development.env
```

Replace the placeholder PostgreSQL password, Redis password, S3 credentials,
document encryption key and Gemini key.

Generate the document key out of band:

```bash
openssl rand -base64 32
```

Start PostgreSQL, Redis and S3-compatible LocalStack:

```bash
bun run infra:dev:up
```

The development stack uses named Docker volumes. Stopping containers does not
delete PostgreSQL, Redis AOF, or LocalStack state:

```bash
bun run infra:dev:down
```

Only the explicit destructive command removes the development volumes:

```bash
bun run infra:dev:destroy
```

Do not use the destructive command when state must be preserved.

Load the same environment values into the APEX ONE application process, then
apply migrations:

```bash
bun run db:migrate
```

The migrations cover core PostgreSQL persistence, document search, append-only
audit controls, and Phase 2 username identity constraints.

## 2. Initial organization and administrator

APEX ONE does not fabricate a default production identity. Bootstrap is a
one-time explicit operation.

Populate the `APEX_BOOTSTRAP_*` variables in the protected environment and set:

```env
APEX_BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN
```

Then run:

```bash
bun run infra:bootstrap-admin
```

The operation is conservative and idempotent:

- organization/user/membership IDs are deterministic from the organization slug
  and administrator email;
- an existing incompatible identity causes failure instead of overwrite;
- the role is validated against the backend `Administrator` authority;
- the initial password is PBKDF2-hashed and is never logged;
- the new administrator is created with `passwordChangeRequired=true`;
- first login therefore enters the Phase 2 mandatory password-change flow.

After success, remove `APEX_BOOTSTRAP_CONFIRM` and
`APEX_BOOTSTRAP_ADMIN_PASSWORD` from the runtime environment.

## 3. Active durable-service verification

After migrations, run:

```bash
bun run infra:verify
```

The verifier actively checks, without printing credentials:

1. PostgreSQL connectivity;
2. append-only audit trigger and request-correlation index;
3. PostgreSQL search bootstrap/query;
4. Redis PING through the configured authenticated/TLS connection;
5. encrypted S3 write/read/delete round-trip; and
6. Gemini generation using the configured server-side key.

The command fails if any authority is unavailable.

## 4. Staging

Use `deploy/environments/staging.env.example` as the variable-name contract.
Do not deploy the file itself as a secret source.

Staging deliberately sets:

```env
APP_ENV=production
APEX_DEPLOYMENT_ENVIRONMENT=staging
```

This activates the same fail-closed infrastructure rules used by production:

- PostgreSQL URL must use `sslmode=require` or `sslmode=verify-full`;
- Redis must use `rediss://`;
- custom S3-compatible endpoints must use HTTPS;
- document encryption key must decode to exactly 32 bytes;
- every durable adapter must select its durable provider.

The provider account must create an isolated staging PostgreSQL database, Redis
authority and S3 bucket. Staging credentials must not be reused for development
or production.

The staging sequence is:

```text
Provision isolated services
        ↓
Inject protected secrets/config
        ↓
Run bun run db:migrate
        ↓
Run bun run infra:bootstrap-admin
        ↓
Remove bootstrap secret/confirmation
        ↓
Run bun run infra:verify
        ↓
Start APEX ONE
        ↓
Require /api/v1/health/ready = ready
        ↓
Run staging UAT
```

## 5. Restart-persistence exit condition

Production CI now contains a disposable durable-stack gate that writes state
through one fresh APEX ONE infrastructure process and verifies it from a second
fresh process using the same PostgreSQL, Redis and S3 authorities.

The test requires:

```bash
bun run test:restart-persistence
```

It refuses to run against staging or production.

The Phase 3 exit condition is satisfied only when this test and the inherited
Production CI/Stage 9/Stage 10/Stage 11 gates are green and the actual staging
environment also passes `infra:verify` plus readiness after restart.

## 6. Secrets

The machine-readable secret inventory is
`deploy/environments/secret-contract.json`.

Important rules:

- never commit real `DATABASE_URL`, `REDIS_URL`, S3 credentials,
  `DOCUMENT_STORAGE_ENCRYPTION_KEY`, Gemini keys or bootstrap passwords;
- use environment-specific credentials with least privilege;
- treat the document encryption key as data-recovery-critical material;
- back up/escrow the document encryption key according to the deployment
  platform's secret-management policy;
- rotate any credential that appears in source control or logs;
- never expose infrastructure secrets through health endpoints or telemetry.

## 7. Production

Production service creation is intentionally deferred until staging has passed
durability, restart, security and UAT gates. Production must receive independent
database, Redis, object-storage and secret authorities; it must never reuse the
development or staging data plane.
