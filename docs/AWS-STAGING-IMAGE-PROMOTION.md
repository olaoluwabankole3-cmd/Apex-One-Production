# CORTEX staging image candidate — AWS deployment boundary

This runbook accompanies `.github/workflows/cortex-staging-image-candidate.yml`.

## Verified staging facts (31 October 2026)

- CORTEX staging is running on a single small EC2 application instance behind a Cloudflare Tunnel. Its container binds to loopback port 3000.
- RDS PostgreSQL, ElastiCache Serverless Valkey and encrypted S3 are provisioned in AWS. After the RDS-managed credential rotated, restarting the staging application service restored `/api/v1/health/ready` to HTTP 200.
- September ECR staging images remain historical rollback *candidates*; a prior digest must be verified and attested before it is approved for rollback.
- There is no confirmed AWS CodeBuild project, CodePipeline, or GitHub-to-AWS OIDC role; don't assume a release controller exists. A private ECR repository does exist.
- The EC2 host has limited memory and disk space: **do not build a fresh Next.js image on the live EC2 server**. A separate builder avoids exhausting staging resources.
- An October CORTEX staging image was pushed to ECR and subsequently deployed on 31 October (see verified status below).

These observations may change. Recheck live conditions immediately before a deployment.

## 1. Build without touching AWS runtime

After a successful exact-`main` CORTEX Production CI run, the candidate workflow builds on GitHub-hosted infrastructure. It:

1. Checks out the precise successful commit and verifies that it is still the current `main`.
2. Builds the repository `Dockerfile`, passing the exact commit SHA and release ID.
3. Checks that the image's OCI revision label matches the commit.
4. Saves the Docker image as a compressed archive, adds a SHA-256 checksum and candidate manifest, and stores them as a **seven-day GitHub Actions artifact**.

This is **not a registry release**. The archive's SHA-256 checksum, Docker image ID and eventual ECR image digest are three distinct identifiers. Do not put the archive checksum into `APEX_IMAGE_DIGEST`.

No AWS IAM role, deployment secret, infrastructure change, or AWS image push occurs in this workflow.

## 2. Transfer to a protected AWS builder (operator-controlled)

Use an operator-approved, non-production build/promotion workstation with ECR push permissions and enough memory and disk space. Download the candidate artifact through authenticated GitHub access.

1. Verify the `candidate.json` source SHA equals the intended current main release.
2. Verify `sha256sum -c <archive>.sha256` before loading.
3. `docker load -i <archive>.tar.gz` (or `gzip -dc <archive>.tar.gz | docker load`).
4. Confirm `org.opencontainers.image.revision` equals the intended commit.
5. Authenticate to **staging ECR only**, choose an unused immutable tag, push the candidate and obtain the registry-resolved `sha256:` digest using ECR `DescribeImages`.
6. Verify the ECR image's revision label against the intended SHA before promotion.

Never expose AWS passwords, long-lived keys or presigned URLs in GitHub workflow logs or public commits. The current EC2 instance profile's broad ECR/secrets policy must **not** be reused as a GitHub CI trust identity.

## 3. Staging pre-traffic gate

Before changing the running application:

- Confirm a successful **CORTEX — Production CI** result for the exact proposed commit.
- Confirm the new ECR image digest, previous known-working immutable ECR digest and a documented way to restore the prior startup configuration.
- Record a **completed, restorable manual RDS snapshot** and database restore procedure, not just automated backup retention.
- Run the candidate's migration validation against isolated staging PostgreSQL and review additive/index impact on existing data.
- Apply necessary database migrations **separately**, with protected database credentials. The container runtime image does not include the Bun migration CLI.
- Run `bun run infra:verify` with protected staging environment variables, using a reviewed migration tool image or authorized operator workstation. Do not put secret material into console output.
- Ensure RDS credential rotation will not leave the next container with stale credentials. Existing systemd startup dynamically reads the RDS-managed secret; confirm this behavior before the promotion.
- Record whether a deploy controller exists. The current systemd/Docker staging host is **not** evidence of the repository's production two-replica/rolling-rollout guarantees.

## 4. Manual staging promotion (only after approval and gates)

1. Create a change record with previous and target immutable digest, source commit, release ID, expected brief downtime for the single container, smoke tests and rollback owner.
2. Update only the staging service's trusted image digest/commit/release reference via an operator-reviewed mechanism; never edit production environments.
3. Restart the staging application service using the existing secrets-fetching launch helper.
4. Confirm all of: `/api/v1/health`, `/api/v1/health/startup`, and `/api/v1/health/ready` return HTTP 200; readiness must show zero configuration issues and all required authorities ready.
5. Confirm runtime `release.commitSha`, `release.imageDigest`, and `release.releaseId` exactly match the promoted ECR image.
6. Run authentication/RBAC, tenant isolation, financial evidence, document quarantine and recovery smoke tests using synthetic staging records only.
7. If health or identity mismatches persist, immediately restore the previous immutable image and service configuration, then verify readiness. Do not claim rollback reverted DB DDL.

**Staging GO/NO-GO:** See `docs/STAGING-READINESS.md`. A healthy container alone is not release approval. Historical document inventories and UAT still require tenant-by-tenant evidence.

## Current release status (verified 31 October 2026)

- Deployed GitHub commit: `fd1955dcd4e4634abf26e7e49bb79f4d3c4c4cf5`.
- ECR immutable digest: `sha256:69dc843d3b8c46b83dfe722f4f3ff96013ac30d291100ec241accb08ffe18fad`.
- Release ID: `cortex-staging-fd1955dcd4e4`. The live readiness report matches all three identifiers.
- Liveness, startup and readiness returned HTTP 200 from the staging host, and readiness reported no unavailable authorities or configuration issues.
- Exact-source Production CI and the staging image candidate workflow passed for the deployed commit. Stage 9/10/11 gates were green on earlier revisions; do not treat those as exact-source evidence for this one.
- The staging promotion was successful at the single-container level, **not** proof of a two-replica production rollout, UAT, release-controller attestation or a rehearsed rollback.
- Credential rotation resilience still needs engineering: a prior RDS secret rotation required restarting the staging application to refresh its credentials.
- The legacy extracted document remains quarantined and requires source-backed review; production launch remains **NO-GO** without UAT and sign-off.

## Repeatable staging verification

The repo provides a fail-closed, read-only verifier. Run it from an approved operator environment able to reach the staging endpoint. Obtain expected identifiers independently from the approved GitHub commit and ECR manifest; do **not** trust the values printed by the readiness endpoint as your expectations.

```bash
CORTEX_STAGING_URL=http://127.0.0.1:3000 \
CORTEX_EXPECTED_COMMIT_SHA=<approved-40-character-main-SHA> \
CORTEX_EXPECTED_IMAGE_DIGEST=sha256:<64-character-ECR-hex> \
CORTEX_EXPECTED_RELEASE_ID=<approved-release-id> \
bun run staging:verify
```

It checks the three health routes, all six durable authorities, production-mode fail-closed configuration, immutable commit/image identity and staging-only deployment environment. Run regression tests locally with `bun run test:staging-http`; the same tests also run in Production CI.

This verification does not reprocess historical data, authorize deployment, reset passwords, perform UAT, or attest to rollback safety. New source changes require fresh CI and a separate controlled staging promotion.
