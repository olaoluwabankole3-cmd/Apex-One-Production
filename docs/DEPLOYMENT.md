# APEX ONE deployment and release operations

This document describes the deployment contract implemented by APEX ONE after the production-assurance and observability/deployment stages. The application is provider-neutral at the deployment-controller boundary: the repository defines the runtime, topology, health, provenance, promotion, and rollback invariants without requiring a specific orchestrator such as Kubernetes, ECS, or another platform.

The machine-readable topology authority is [`../deploy/production-topology.json`](../deploy/production-topology.json). If an operator guide and an executable validation disagree, the executable validation is authoritative until the documentation is corrected.

## Production topology

The production application tier has these required properties:

| Property | Contract |
| --- | --- |
| Container source | Repository `Dockerfile` |
| Application port | `3000` |
| Runtime user | `node` (non-root) |
| Minimum replicas | `2` |
| Rollout strategy | Rolling |
| `maxUnavailable` | `0` |
| `maxSurge` | `1` |
| Liveness | `/api/v1/health` |
| Startup | `/api/v1/health/startup` |
| Readiness | `/api/v1/health/ready` |

Production also requires the six durable authorities described in [`ENVIRONMENT.md`](ENVIRONMENT.md): PostgreSQL for database/audit/search, Redis for sessions/rate limits, and S3-compatible object storage for encrypted documents.

## Container artifact

The canonical image is a multi-stage build:

- Bun 1.4.0 Alpine builds the Next.js application.
- Node 20 Alpine runs the Next.js standalone server.
- The runtime process runs as the non-root `node` user.
- The image exposes port 3000.
- The image health check calls the liveness endpoint.
- Build-time release ID and commit SHA are retained as runtime environment defaults and OCI metadata labels.

A representative build is:

```bash
docker build \
  --build-arg APEX_RELEASE_ID="release-2026-09-03.1" \
  --build-arg APEX_COMMIT_SHA="<40-character-git-sha>" \
  -t "registry.example/apex-one:<immutable-build-reference>" \
  .
```

After the artifact is pushed, promotion authority is its registry-resolved immutable `sha256:` digest, not its tag. The deployment platform must inject the exact digest into the running application as `APEX_IMAGE_DIGEST` together with `APEX_DEPLOYMENT_ENVIRONMENT`, `APEX_RELEASE_ID`, and `APEX_COMMIT_SHA`.

Do not treat `latest`, a branch tag, or another mutable registry reference as release evidence.

## Database migrations

The repository migration entry point is:

```bash
DATABASE_URL='postgres://...' bun run db:migrate
```

It bootstraps the core PostgreSQL persistence schema, durable document search, and append-only audit controls. The command is idempotent for the migrations currently implemented by the repository.

**The GitHub release-control workflow does not run database migrations.** The operator or deployment controller is responsible for applying required migrations to the target database before traffic is admitted to an application revision that depends on them.

A safe release procedure therefore treats schema migration as an explicit pre-traffic step and verifies `/api/v1/health/ready` afterward. Do not assume that a successful image promotion compensates for a missing database migration; audit readiness is specifically designed to fail when its durability controls are absent.

## Health model

APEX ONE separates process health, static startup validity, and active serving readiness.

### Liveness — `/api/v1/health`

Liveness answers whether the application process is alive. It is suitable for container/process restart decisions and intentionally does not require all durable authorities to be healthy.

Canonical topology timing:

- timeout: 5 seconds
- period: 30 seconds

### Startup — `/api/v1/health/startup`

Startup validates static infrastructure and release configuration without making it the active durable-authority probe. It is the appropriate gate for detecting malformed provider selection or incomplete release identity during deployment initialization.

Canonical topology timing:

- timeout: 5 seconds
- period: 10 seconds

### Readiness — `/api/v1/health/ready`

Readiness is the serving-traffic authority. It actively verifies:

- PostgreSQL connectivity;
- Redis connectivity;
- append-only audit trigger and request-correlation index;
- S3-compatible document storage through a write/read/delete probe;
- PostgreSQL document-search availability;
- valid infrastructure configuration;
- complete immutable release identity; and
- deployment topology identity.

Canonical topology timing:

- timeout: 10 seconds
- period: 15 seconds

Readiness reports provider/authority state and probe duration but intentionally suppresses connection strings, credentials, and raw dependency exception text.

## Fail-closed traffic behavior

An alive process is not necessarily ready to receive application traffic. Production middleware and assurance tests enforce the distinction: required infrastructure loss causes readiness to become `not_ready`, and normal application traffic fails closed rather than silently switching to memory state.

The production-assurance suite exercises outage and recovery for Redis, PostgreSQL, and S3-compatible storage to ensure the process recovers only after its durable authorities recover.

## Release workflow

Controlled release operations are implemented in:

```text
.github/workflows/stage11-release-control.yml
```

The workflow is intentionally manual (`workflow_dispatch`) and has read-only repository/action permissions. The selected GitHub environment (`staging` or `production`) supplies the protected controller endpoint and token:

- `APEX_DEPLOYMENT_CONTROL_URL`
- `APEX_DEPLOYMENT_CONTROL_TOKEN`

The workflow never commits release state back to the repository.

### Exact-main CI gate

Before deployment control executes, the workflow:

1. checks out `main`;
2. resolves the exact local commit SHA;
3. confirms it still equals remote `main`; and
4. requires a successful **APEX ONE — Production CI** run whose `head_sha` is that exact commit.

A successful CI run for an older commit is not promotion evidence for a newer `main`.

## Promotion procedure

### 1. Produce and publish an immutable artifact

Build the image from the intended source commit, publish it to the registry, and resolve its `sha256:` digest.

The release controller must be able to attest that the supplied digest corresponds to the exact frozen commit supplied in the release plan.

### 2. Promote candidate to staging

Dispatch the release-control workflow with:

- `action`: `promote`
- `environment`: `staging`
- `source_environment`: `candidate`
- `image_digest`: the immutable digest
- optional `release_id`: a stable release identifier

Promotion rejects mutable image references.

A successful controller receipt must confirm the target digest is active and must attest `verifiedCommitSha` equal to the frozen release-plan commit.

### 3. Validate staging

Use the deployed application’s startup/readiness endpoints and the deployment platform’s normal validation suite. Production promotion is authorized only for the same immutable digest that was successfully established in staging.

### 4. Promote the same digest to production

Dispatch the workflow with:

- `action`: `promote`
- `environment`: `production`
- `source_environment`: `staging`
- `image_digest`: **the exact same digest used in staging**
- the intended `release_id`

The production controller receipt must confirm all of the following:

- `status` is `succeeded`;
- `activeImageDigest` equals the target release-plan digest;
- `verifiedCommitSha` equals the frozen Git commit;
- `verifiedSourceEnvironment` is `staging`; and
- `verifiedSourceImageDigest` equals the same target digest.

If any attestation is absent or mismatched, release control fails closed even if the controller returned HTTP success.

## Rollback procedure

Rollback never infers a target from `latest`, registry history, or the current deployment. The operator must provide an explicit previous immutable digest.

Dispatch the workflow with:

- `action`: `rollback`
- target `environment`: normally the affected environment;
- `rollback_to_digest`: the explicit previous successful `sha256:` digest;
- `image_digest`: when supplied, the currently active digest; it must differ from the rollback target;
- a source-environment input as required by the workflow form (rollback provenance itself is determined by the controller attestation).

A successful rollback receipt must confirm:

- the rollback digest is now the active digest; and
- `verifiedPreviousSuccessfulDigest` equals that exact rollback target.

Without that previous-success attestation, APEX ONE rejects the rollback receipt. This prevents an arbitrary immutable digest from being treated as a safe rollback merely because its syntax is valid.

After rollback, verify startup and readiness before restoring or expanding traffic.

## Deployment-controller HTTP boundary

The provider-neutral controller endpoint is configured by `APEX_DEPLOYMENT_CONTROL_URL` and must use HTTPS outside isolated loopback tests. The repository sends a bearer token in the HTTP `Authorization` header and the stable release ID as the idempotency key.

Release intent is sent to:

```text
/v1/releases/promote
/v1/releases/rollback
```

The controller credential and controller URL are not part of the release-plan payload. Release receipts contain deployment evidence, not authentication material.

At minimum, a successful receipt contains:

```json
{
  "deploymentId": "deployment-identifier",
  "status": "succeeded",
  "activeImageDigest": "sha256:<64-hex-characters>",
  "completedAt": "<ISO-8601 timestamp>"
}
```

Promotion and rollback require the additional provenance fields described above.

## Runtime release identity

A production process is ready only when its runtime identity is complete:

- `APEX_DEPLOYMENT_ENVIRONMENT`: `staging` or `production`
- `APEX_RELEASE_ID`: valid stable release identifier
- `APEX_COMMIT_SHA`: exact 40-character commit SHA
- `APEX_IMAGE_DIGEST`: immutable `sha256:` image digest

These values should describe the artifact actually running, not merely the intended release request.

## Required GitHub environment configuration

Create/maintain `staging` and `production` GitHub environments according to your organizational approval policy. Each environment used for release control must provide:

```text
APEX_DEPLOYMENT_CONTROL_URL
APEX_DEPLOYMENT_CONTROL_TOKEN
```

Environment reviewers, wait timers, branch restrictions, and other approval rules are repository/organization governance choices; the workflow is designed to honor the selected GitHub environment rather than bypass it.

## Post-deployment verification

For each deployment:

1. Confirm the deployment controller returned a synchronous successful receipt with the expected digest and required provenance attestations.
2. Confirm `/api/v1/health` is healthy.
3. Confirm `/api/v1/health/startup` accepts the release/provider configuration.
4. Confirm `/api/v1/health/ready` reports `ready` and no required authority is unavailable.
5. Confirm the readiness release identity matches the intended environment, release ID, commit SHA, and image digest.
6. Confirm the orchestrator is maintaining the topology constraints (minimum two replicas and zero deliberate unavailability during rolling rollout).
7. Use structured telemetry and the canonical request ID for incident correlation; do not use raw infrastructure credentials or URLs as correlation data.

## What this repository does not prescribe

The deployment-controller implementation and infrastructure provider are intentionally outside the application repository. This document therefore does not prescribe cluster namespaces, cloud account IDs, load balancer products, registry vendors, DNS providers, or secret-manager products.

Those platform-specific choices must still satisfy the code-owned APEX ONE contract described here and in `deploy/production-topology.json`.