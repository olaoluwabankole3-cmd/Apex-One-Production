# CORTEX staging image candidate — AWS deployment boundary

This runbook accompanies `.github/workflows/cortex-staging-image-candidate.yml`.

## Verified staging facts (31 October 2026)

- CORTEX staging is running on a single small EC2 application instance behind a Cloudflare Tunnel. Its container binds to loopback port 3000.
- RDS PostgreSQL, ElastiCache Serverless Valkey and encrypted S3 are provisioned in AWS. After the RDS-managed credential rotated, restarting the staging application service restored `/api/v1/health/ready` to HTTP 200.
- The **existing** staging image was built from an earlier September source revision and remains the confirmed working rollback candidate.
- There is no confirmed AWS CodeBuild project, CodePipeline, or GitHub-to-AWS OIDC role; don't assume a release controller exists. A private ECR repository does exist.
- The EC2 host has limited memory and disk space: **do not build a fresh Next.js image on the live EC2 server**. A separate builder avoids exhausting staging resources.
- No released October CORTEX image has been pushed to ECR as of this audit.

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

## Current release status

- Successful source commit candidate: `299dc8614ba2b319d333a9e114e61dce7d9d4b68` at the time of this audit.
- Staging service: restored and healthy on its **older** image.
- Latest CORTEX candidate image: **not yet built or published to AWS ECR**.
- Staging deployment: **not yet promoted**; no new source code was deployed.
- AWS staging builder/controlled promotion path: **operator provisioning required**. No additional billable AWS resources or IAM trusts were created in this audit.
