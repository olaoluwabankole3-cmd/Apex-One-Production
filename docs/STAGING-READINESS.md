# CORTEX staging readiness — GO/NO-GO record

**Owner:** QORVEX engineering / staging operator  
**Scope:** Controlled staging validation only. This checklist is not deployment authorization, a completed verification report, or proof that cloud infrastructure is provisioned.  
**Related:** [Deployment contract](DEPLOYMENT.md), [Environment contract](ENVIRONMENT.md), [Infrastructure connection](INFRASTRUCTURE-CONNECTION.md), [Product integrity](PRODUCT-INTEGRITY.md).

## Current evidence status (observed 31 October 2026)

- CORTEX staging **is provisioned** in AWS `eu-west-1`: EC2 application instance, RDS PostgreSQL, ElastiCache Serverless Valkey and encrypted object storage, with a Cloudflare Tunnel for ingress.
- On 31 October, the running release was commit `fd1955dcd4e4634abf26e7e49bb79f4d3c4c4cf5`, ECR digest `sha256:69dc843d3b8c46b83dfe722f4f3ff96013ac30d291100ec241accb08ffe18fad` and release ID `cortex-staging-fd1955dcd4e4`. Live readiness, ECR and GitHub matched.
- Exact-source **CORTEX — Production CI** passed all 12 jobs for the deployed commit and the staging image candidate build succeeded. Stage 9/10/11 assurance passed on earlier commits; exact-source assurance for this staging release was **not** established by that result.
- Read-only staging host checks returned HTTP 200 for liveness, startup and readiness, with zero unavailable authorities and zero configuration issues. These are infrastructure checks, **not** end-to-end user acceptance.
- Future source commits, including changes to this runbook and verifier, need fresh exact-source gates and a new controlled image promotion before their code can be considered deployed.
- The legacy document inventory previously identified an unassessed extracted record. It remains quarantined pending individual source-backed review.
- RDS-managed credential rotation previously required a staging service restart. Automatic credential refresh/recovery has not been validated.
- Staging UAT, rollback rehearsal, two-replica production topology and engineering/security sign-off are still outstanding.

Mark a gate PASS only with the corresponding dated artifact or operator evidence; otherwise record BLOCKED or NOT RUN.

## 1. Pre-release engineering gates

| Gate | Evidence required | Status |
| --- | --- | --- |
| Immutable candidate | Exact 40-character `main` commit SHA, immutable registry `sha256:` digest, release ID | PASS for the deployed `fd1955d` only |
| GitHub checks | Successful **CORTEX — Production CI** for the exact candidate commit, plus Stage 9/10/11 assurance on the changes being promoted | PARTIAL — CI passed; exact-source Stage 9/10/11 proof not established |
| Branch review | All intended code PRs merged; no unreviewed artifacts or unresolved blockers | NOT RUN |
| Product integrity | No legacy customer-facing branding, invented value metrics, or unsupported document terms; access-denied behavior verified | NOT RUN |
| Existing documents | Tenant-scoped inventory, documented source integrity, quarantine/reprocessing decision and audit evidence for old extracted fields | BLOCKED |

Do not use a green PR test from an older base as evidence for the current exact-main commit.

## 2. Provision isolated staging authorities

Provision independently of production and store secrets only in the deployment platform's protected secret store.

- PostgreSQL with TLS, least-privilege user, application data, append-only audit and search indexes.
- Redis over TLS for authenticated sessions and rate limiting.
- A private S3-compatible bucket, server-side controls and a distinct 32-byte document encryption key.
- A scoped server-side Gemini credential; no client-side AI secret.
- Staging-only organization administrator; no production customer data, real email recipients or production financial instructions in test fixtures.
- A trusted staging deployment-controller URL/token and registry access. The repository does **not** provision these external components.

`APP_ENV=production`, `DEMO_MODE=false`, `APEX_DEPLOYMENT_ENVIRONMENT=staging`, durable adapter settings and release identity are required by the existing compatibility contract. **Do not rename the APEX_* environment variables or `apex-one` service IDs as part of this staging exercise.**

**Blocking condition:** if any required authority, TLS configuration, secret, audit control, or immutable release ID is missing, do not admit application traffic.

## 3. Pre-traffic verification

Run from an approved staging operator environment, with values injected from the protected secret store:

1. Confirm the candidate SHA equals the intended `main` commit and exact-main CI succeeded.
2. Run `bun install --frozen-lockfile` against the candidate revision.
3. Apply `bun run db:migrate` to **staging only** and verify migration/audit success.
4. Perform `bun run infra:bootstrap-admin` **only if** the staging organization has not been bootstrapped; immediately remove bootstrap confirmation and password inputs.
5. Run `bun run infra:verify`; retain its dated per-authority report with no credential values.
6. Build/pull the immutable image, verify the digest and inject `APEX_RELEASE_ID`, `APEX_COMMIT_SHA` and `APEX_IMAGE_DIGEST`.
7. Follow the manual staging promotion contract in `.github/workflows/stage11-release-control.yml`. Never invoke its production environment for this phase.
8. Require `/api/v1/health/startup` and `/api/v1/health/ready` to pass; readiness must report `ready`.
9. Retain proof of TLS, encrypted document round-trip, durable audit append-only controls, and recovered restart state.

**A process returning `/api/v1/health` alone is not sufficient evidence of readiness.**

## 4. Staging user acceptance (UAT)

Use synthetic test fixtures only. Capture test date, tester, expected/observed outcome, screenshot or log reference, and status.

- Authentication and RBAC: unauthenticated access blocked; tenant-crossing denied; password change, session expiry, and login throttling behave as tested.
- Financial truth: cleared transactions and other statuses are distinguished; NGN and USD are never combined into a fabricated universal amount; missing leakage data appears as **unassessed**, not an invented loss.
- AI provenance: an authorized named customer resolves only to their records; disallowed financial tools yield a denial; bounded results disclose their scope; model answers do not claim canonical verification without evidence.
- Document integrity: uploading a PDF/Office/image must not produce invented jurisdiction, SLA, currency or invoice terms; supported explicit JSON fields show source paths and **unassessed** confidence. Historical records must remain quarantined pending an approved repair plan.
- Workflow safety: sensitive execution requires the intended capability and human authorization; auditable states and denial paths are preserved.
- Resilience: exercise Redis/PostgreSQL/S3 outage and recovery on **staging only**, using safe fixture data; traffic must fail closed and only recover when the durable authority does.

No real banking connector, source reconciliation, accounting outcome, or achieved value should be claimed as validated unless the corresponding isolated staging integration has been proven.

## 5. Exit decision and rollback

A staging **GO** requires: all gates PASS, attached evidence for each, an approved cleanup/quarantine of legacy document fields, approved UAT, an identified prior successful immutable digest, rollback rehearsal, and named engineering/security sign-off. Otherwise record **NO-GO** with blocker and owner.

For rollback follow the existing release-control contract and use a previously attested successful digest. Never roll back to a mutable tag, invent a previous-success receipt, or assume that a rollback undoes database schema changes. Keep tenant evidence, audit history and encrypted document objects intact.

| Decision evidence | Value |
| --- | --- |
| Running commit SHA (31 Oct) | `fd1955dcd4e4634abf26e7e49bb79f4d3c4c4cf5` |
| Running ECR image digest (31 Oct) | `sha256:69dc843d3b8c46b83dfe722f4f3ff96013ac30d291100ec241accb08ffe18fad` |
| Staging controller / endpoint | Local HTTP endpoints verified; production-grade controller attestation not established |
| Durable authority report | Ready, no unavailable authorities on 31 Oct; attach formal operator evidence before GO |
| Staging release receipt | Matching runtime and ECR identifiers; no provider-neutral controller receipt |
| Historical document handling | BLOCKED — inventory and safe remediation required |
| Security sign-off | NOT GRANTED |
| Engineering sign-off | NOT GRANTED |
| Overall status | **NO-GO for production — healthy staging, UAT and security sign-offs outstanding** |
