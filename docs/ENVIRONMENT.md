# APEX ONE environment reference

This document describes the environment contract implemented by APEX ONE. The application deliberately distinguishes local/test convenience from production authority: memory adapters are valid outside production, while `APP_ENV=production` is fail-closed unless every required durable provider, secure transport requirement, and immutable release-identity field is valid.

Do not commit real credentials. `.env.example` contains names and safe defaults only.

## Environment classes

### Local development

Phase 3 makes durable providers the normal application-development profile.
`.env.example` now selects PostgreSQL, Redis and S3-compatible storage rather
than process-local memory.

Use the disposable durable development stack documented in
[`INFRASTRUCTURE-CONNECTION.md`](INFRASTRUCTURE-CONNECTION.md):

```bash
cp deploy/development/development.env.example deploy/development/development.env
bun run infra:dev:up
bun run db:migrate
bun run infra:verify
```

The copied `deploy/development/development.env` file is ignored by Git. Replace
all placeholder credentials and generate a unique document encryption key.

Memory adapters remain supported for isolated unit/assurance tests that
explicitly select them. They are no longer the recommended normal application
development configuration.

`DEMO_MODE` should remain `false` for ordinary product development.
Production security ignores demo mode whenever either `NODE_ENV=production`
or `APP_ENV=production`.

`GEMINI_API_KEY` is required when the Gemini-backed generation path is actively
verified or used.

### Staging and production

Staging/production deployments should use the durable provider shape below. For the application’s production boundary, `APP_ENV=production` is the switch that activates fail-closed provider and transport validation.

```env
APP_ENV=production
APEX_DEPLOYMENT_ENVIRONMENT=production

APEX_DATABASE_ADAPTER=postgres
APEX_SESSION_ADAPTER=redis
APEX_RATE_LIMIT_ADAPTER=redis
APEX_AUDIT_ADAPTER=postgres
APEX_OBJECT_STORAGE_ADAPTER=s3
APEX_SEARCH_INDEX_ADAPTER=postgres
```

For staging, keep `APP_ENV=production` and set
`APEX_DEPLOYMENT_ENVIRONMENT=staging` so the same durable-provider and secure
transport validation used by production is exercised before production exists.

The variable-name contract is committed at
`deploy/environments/staging.env.example`. Real values belong in the deployment
platform's protected environment/secret store.

## Variable reference

| Variable | Local/test | Production requirement | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Usually `development` or test-specific | Must be `production` for the production fail-closed boundary | Selects production infrastructure behavior |
| `DEMO_MODE` | Optional; `true` enables explicit development demo identity | Must not be relied on; production security disables it | Development-only authentication convenience |
| `APEX_DEPLOYMENT_ENVIRONMENT` | Optional | `staging` or `production` | Immutable release/deployment identity |
| `APEX_RELEASE_ID` | Optional | Required; 3–128 safe identifier characters | Stable identifier for the deployed release |
| `APEX_COMMIT_SHA` | Optional | Required full 40-character Git SHA | Binds runtime identity to source revision |
| `APEX_IMAGE_DIGEST` | Optional | Required `sha256:` digest with 64 hexadecimal characters | Binds runtime identity to immutable container artifact |
| `GEMINI_API_KEY` | Required only for Gemini generation | Required if production AI generation uses Gemini | Server-side Google Gemini credential |
| `APEX_DATABASE_ADAPTER` | `memory` or `postgres` | `postgres` | Canonical business persistence provider |
| `APEX_SESSION_ADAPTER` | `memory` or `redis` | `redis` | Session authority provider |
| `APEX_RATE_LIMIT_ADAPTER` | `memory` or `redis` | `redis` | Distributed rate-limit provider |
| `APEX_AUDIT_ADAPTER` | `memory` or `postgres` | `postgres` | Durable audit provider |
| `APEX_OBJECT_STORAGE_ADAPTER` | `memory` or `s3` | `s3` | Document object-storage provider |
| `APEX_SEARCH_INDEX_ADAPTER` | `memory` or `postgres` | `postgres` | Durable document-search provider |
| `DATABASE_URL` | Required when a PostgreSQL-backed adapter is selected | Required; TLS via `sslmode=require` or `sslmode=verify-full` | PostgreSQL authority for business state, audit and search |
| `REDIS_URL` | Required when Redis is selected | Required and must use `rediss://` | Redis authority for sessions and rate limits |
| `S3_BUCKET` | Required when S3 is selected | Required | Document bucket name |
| `S3_REGION` | Required when S3 is selected | Required | S3 signing/region configuration |
| `S3_ENDPOINT` | Optional | Optional for AWS S3; if supplied, must use `https://` | Custom S3-compatible endpoint |
| `S3_ACCESS_KEY_ID` | Required when S3 is selected | Required | Object-storage access credential |
| `S3_SECRET_ACCESS_KEY` | Required when S3 is selected | Required | Object-storage secret credential |
| `DOCUMENT_STORAGE_ENCRYPTION_KEY` | Required when S3 is selected | Required; base64 encoding of exactly 32 bytes | AES-256-GCM application encryption key for documents |
| `APEX_DEPLOYMENT_CONTROL_URL` | Not required by normal app runtime | Required by the release-control runner; HTTPS | Provider-neutral deployment-controller endpoint |
| `APEX_DEPLOYMENT_CONTROL_TOKEN` | Not required by normal app runtime | Required by the release-control runner | Bearer credential for the deployment controller |

`NODE_ENV` is framework/runtime-owned. The canonical production image sets `NODE_ENV=production`; do not use `NODE_ENV` as a substitute for the application’s `APP_ENV` infrastructure contract.

## Durable provider requirements

Production uses the following exact authority mapping:

| Authority | Provider | Shared authority notes |
| --- | --- | --- |
| Database | PostgreSQL | Canonical tenant/business state |
| Audit | PostgreSQL | Composed from the same database authority to preserve atomic business + audit work |
| Search index | PostgreSQL | Durable document-search authority |
| Session | Redis | Opaque authenticated session state |
| Rate limit | Redis | Shares the Redis authority while using its own keys/operations |
| Object storage | S3-compatible | Stores encrypted document ciphertext |

A production deployment is invalid if any of these adapter variables selects `memory` or an unsupported value.

## PostgreSQL

A production `DATABASE_URL` must be a valid PostgreSQL URL and must include one of the accepted TLS modes:

```env
DATABASE_URL=postgres://USER:PASSWORD@db.example:5432/apex?sslmode=require
```

or:

```env
DATABASE_URL=postgres://USER:PASSWORD@db.example:5432/apex?sslmode=verify-full
```

The same URL is used by the database, audit, and PostgreSQL document-search authorities. Run the repository migration entry point against the target database before serving a schema that requires it:

```bash
DATABASE_URL='postgres://...' bun run db:migrate
```

The migration entry point bootstraps core persistence, PostgreSQL document search, and the append-only audit constraints.

## Redis

Production Redis must use TLS:

```env
REDIS_URL=rediss://USER:PASSWORD@redis.example:6380/0
```

`redis://` is accepted for local/test environments but fails production configuration validation.

Raw opaque session tokens are not persisted as Redis keys. The session implementation derives SHA-256 token digests for its storage keys and indexes.

## S3-compatible object storage

For AWS S3, `S3_ENDPOINT` may be empty and the standard AWS endpoint is used. For an S3-compatible service, set an explicit HTTPS endpoint:

```env
S3_BUCKET=apex-documents
S3_REGION=us-east-1
S3_ENDPOINT=https://objects.example.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
DOCUMENT_STORAGE_ENCRYPTION_KEY=...
```

The application encrypts document bytes before storing ciphertext. `DOCUMENT_STORAGE_ENCRYPTION_KEY` must be standard base64 that decodes to exactly 32 bytes. Generate it outside the repository, for example:

```bash
openssl rand -base64 32
```

Treat this key as high-value secret material. Loss of the key can make stored ciphertext unrecoverable; disclosure compromises the confidentiality boundary for data encrypted with that key. Store and rotate it using your deployment platform’s secret-management process rather than Git history.

## One-time initial administrator bootstrap

After the target PostgreSQL database is migrated, the controlled bootstrap
command is:

```bash
bun run infra:bootstrap-admin
```

It requires the `APEX_BOOTSTRAP_*` values and the explicit confirmation
`APEX_BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`. New bootstrap administrators are
created with `passwordChangeRequired=true`, so Phase 2 forces a password update
on first login.

Remove the bootstrap password and confirmation from the environment immediately
after successful creation.

## Active external-service verification

Run:

```bash
bun run infra:verify
```

This actively checks PostgreSQL, durable audit controls, PostgreSQL search,
Redis, encrypted S3 write/read/delete, and Gemini generation without printing
raw connection strings or secret values.

## Immutable release identity

Production readiness requires a complete release identity:

```env
APEX_DEPLOYMENT_ENVIRONMENT=production
APEX_RELEASE_ID=release-2026-09-03.1
APEX_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567
APEX_IMAGE_DIGEST=sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

The example values above are placeholders, not valid deployment evidence. The actual values must identify the artifact being served.

Release identity has two roles:

1. It is exposed in bounded readiness/telemetry identity so operators can correlate a running process to its release without exposing registry credentials.
2. Production readiness fails if any identity component is absent or malformed.

The deployment controller additionally attests artifact provenance during promotion; see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Release-controller secrets

`APEX_DEPLOYMENT_CONTROL_URL` and `APEX_DEPLOYMENT_CONTROL_TOKEN` belong to the controlled release runner, not application business logic. In the GitHub release workflow they are read from the selected protected deployment environment.

Do not write either value into `release-plan.json`, application configuration committed to Git, container labels, or user-visible readiness responses. Release plans contain deployment intent; controller authentication remains out-of-band.

## Secret-handling rules

- Commit variable names and safe examples only.
- Use `deploy/environments/secret-contract.json` as the provider-neutral inventory of secret material.
- Never commit `deploy/development/development.env` or real files under `deploy/environments/*.env`.
- Keep database, Redis, S3, Gemini and deployment-controller credentials in the deployment platform’s protected secret store.
- Do not place credentials in image tags, release IDs, request IDs, telemetry attributes, readiness URLs, or repository variables that are intended to be public/non-secret.
- Rotate a secret if it is ever committed or emitted to a log; removing it from the latest revision is not sufficient remediation.
- Prefer environment-specific credentials with the minimum provider privileges required by APEX ONE.

## Readiness behavior

Static infrastructure configuration is not the final readiness authority. `/api/v1/health/ready` actively checks the configured durable dependencies and the audit durability controls. A syntactically valid environment can therefore still be `not_ready` if PostgreSQL, Redis, object storage, search, or the append-only audit migration is unavailable.

Readiness deliberately reports authority/provider state and timing without returning raw dependency exceptions, connection strings, or credentials.