# APEX ONE

APEX ONE is a multi-tenant enterprise operating and intelligence platform built with Next.js. The repository contains the application UI, authenticated API, durable persistence adapters, document/knowledge controls, workflow and value-execution domains, AI trust boundary, production readiness probes, structured telemetry, and provider-neutral release controls.

This README describes the architecture that is implemented in the repository after the production-assurance and observability/deployment stages. It is not a mock-only frontend: production mode is deliberately **fail-closed** unless every required durable authority and immutable release identity is valid.

## System at a glance

APEX ONE is organized around authenticated tenant-scoped application services rather than direct client access to infrastructure. The principal product domains are:

- **Customers and enterprise records** — tenant-scoped customer data and related business state.
- **Documents and knowledge** — encrypted object storage, durable search, document consistency, evidence provenance, controlled knowledge revisions, validation, publication, and deletion boundaries.
- **Workflows and actions** — workflow definitions, execution, action lifecycle, authorization, and audit.
- **Value intelligence** — opportunity, simulation, execution-lifecycle, captured-value, and financial-integrity controls.
- **AI intelligence** — permission-scoped retrieval, deterministic facts, provenance references, and model prose that remains explicitly unverified and uncertified.
- **Audit and observability** — append-only durable audit, request correlation, structured telemetry, health probes, release identity, and deployment topology identity.

## Production architecture

The production composition root requires exactly six durable authorities. Memory implementations exist for local development and tests only.

| Authority | Production provider | Purpose |
| --- | --- | --- |
| Database | PostgreSQL | Canonical tenant/business persistence |
| Audit | PostgreSQL | Durable append-only audit; shares the database authority for atomic business + audit work |
| Session | Redis | Authenticated session state |
| Rate limit | Redis | Distributed rate-limit authority |
| Object storage | S3-compatible | Encrypted document ciphertext |
| Search index | PostgreSQL | Durable document search authority |

Production cannot silently fall back to memory providers. Invalid provider selection, missing durable configuration, transport-security violations, incomplete release identity, unavailable authorities, or missing audit durability cause readiness to fail.

For the complete environment contract, see [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). For runtime topology, promotion, and rollback, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Security and trust boundaries

APEX ONE derives tenant identity from the authenticated session, never from an arbitrary client-supplied organization identifier. Requests may authenticate with an `Authorization: Bearer <token>` credential or the HttpOnly `apex_session` cookie. Unknown roles fail closed and authorization is capability-based.

Production security properties include:

- PostgreSQL, Redis, and custom S3 endpoints require encrypted transport according to the environment contract.
- Raw session tokens are treated as opaque credentials; Redis session keys use token digests rather than persisting raw tokens as keys.
- Document content is encrypted with an application-owned 32-byte key before ciphertext is written to S3-compatible storage.
- Durable audit rows are protected by a PostgreSQL append-only trigger that rejects direct `UPDATE` and `DELETE` operations.
- A canonical `X-Request-Id` is propagated through ingress, authenticated tenant context, API handling, and durable audit for correlation.
- Structured telemetry recursively redacts credential-like values and bounds attributes rather than logging request bodies or infrastructure exception details.
- AI retrieval is tenant- and permission-scoped. Deterministic facts are separated from model prose; model prose does not become verified or certified merely because source records carry evidence state.
- `DEMO_MODE=true` is an explicit development-only convenience and cannot enable demo authentication in production.

## Local development

The repository is pinned to **Bun 1.4.0**.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

The development defaults in `.env.example` select in-memory adapters. Set `DEMO_MODE=true` only when you intentionally want the development-only demo identity; otherwise use the authentication API normally.

`GEMINI_API_KEY` is needed when AI model generation is invoked. The AI service can still return system-controlled fallback output in paths where generation is unavailable, but a real Gemini key is required for Gemini-backed prose generation.

### Local durable-provider development

You may opt into PostgreSQL, Redis, or S3-compatible providers individually outside production by changing the corresponding adapter variables. When using PostgreSQL, run migrations before exercising the durable application:

```bash
bun run db:migrate
```

See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for provider values and required connection variables.

## Production runtime

The canonical production image is the repository `Dockerfile`:

- Bun 1.4.0 builder stage.
- Node 20 Alpine runtime.
- Next.js standalone output.
- Runtime user `node` (non-root).
- Application port `3000`.
- OCI commit/release metadata labels.
- Container health check against `/api/v1/health`.

The provider-neutral production topology is code-reviewed in [`deploy/production-topology.json`](deploy/production-topology.json). It requires at least two application replicas and a rolling rollout with `maxUnavailable: 0` and `maxSurge: 1`.

### Health probes

| Probe | Endpoint | Meaning |
| --- | --- | --- |
| Liveness | `GET /api/v1/health` | Process is alive |
| Startup | `GET /api/v1/health/startup` | Static deployment/release configuration is valid |
| Readiness | `GET /api/v1/health/ready` | Required durable authorities are actively usable and audit durability is installed |

Readiness actively checks PostgreSQL, Redis, S3-compatible object storage, PostgreSQL document search, and the append-only audit controls. Probe responses expose health/topology/release information without returning connection strings, credentials, or raw dependency exceptions.

## Release and rollback model

Deployments are controlled through `.github/workflows/stage11-release-control.yml` and the provider-neutral deployment-controller boundary.

Key invariants:

1. Release source is frozen to the exact `main` commit.
2. Successful **Production CI for that exact main SHA** is required before release control runs.
3. Promotion accepts only an immutable `sha256:` image digest.
4. Every promoted digest must be attested by the deployment controller to the frozen Git commit.
5. Production promotion must originate from staging and must use the exact same digest attested in staging.
6. Rollback requires an explicit immutable digest that the controller attests was previously successful.
7. Mutable tags such as `latest` are not release authority.
8. Staging and production use protected GitHub environments; repository permissions in the release workflow remain read-only.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the operator procedure and controller contract.

## Validation and CI

The normal pull-request path inherits the repository’s production gates. Important local commands include:

```bash
bun run typecheck
bun run build
bun run test:security
bun run test:postgres
bun run test:redis
bun run test:s3
bun run test:search
bun run test:composition
bun run test:recovery
bun run test:evidence
bun run test:lifecycle
bun run test:ai-trust
bun run test:consistency
bun run test:observability
```

Production assurance additionally exercises a production-built standalone server, authentication/RBAC in Chromium, HTTP/AI/concurrency behavior, Redis/PostgreSQL/S3 outage and recovery, fail-closed deployment-image behavior, request-correlation durability, and standalone runtime hygiene.

## Repository layout

```text
app/                         Next.js pages and API routes
components/                  Product UI and authenticated workspaces
lib/backend/core/            Security, validation, HTTP and crypto boundaries
lib/backend/database/        Repository contracts, PostgreSQL adapters and migrations
lib/backend/domains/         Auth, customers, documents, knowledge, evidence, workflows, AI and value domains
lib/backend/infrastructure/  Production composition, readiness, topology, release control, Redis/S3 clients
lib/backend/observability/   Structured telemetry and request correlation
scripts/                     Migration, assurance, integration and release-control entry points
deploy/                      Provider-neutral production topology
docs/                        Environment and deployment operator documentation
.github/workflows/           Production CI, assurance, consistency, observability and release workflows
```

## Documentation authority

Operational documentation intentionally follows the implemented architecture:

- `.env.example` — copyable, secret-free environment template.
- `docs/ENVIRONMENT.md` — environment variables, provider selection, TLS and secret requirements.
- `deploy/production-topology.json` — machine-readable production topology contract.
- `docs/DEPLOYMENT.md` — deployment, migration, probes, promotion and rollback procedure.

When documentation and executable safeguards disagree, treat the executable validation as authoritative and update the documentation in the same change rather than weakening the runtime boundary.