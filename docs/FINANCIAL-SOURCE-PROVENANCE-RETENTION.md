# Financial Source Provenance and Versioned Retention — CORTEX

**Status:** internal-only synthetic verification foundation, disabled for production. Neither a live bank connector nor a bank-certified financial result.

## Controls added

**Cryptographic source manifest (Ed25519):** An optional Ed25519 SPKI verifier key can be proposed with a source policy. The existing two-person approval pins its exact SHA-256 fingerprint, issuer key ID, source kind and expected/observed role. The verifier accepts only strict canonical UTC source manifests signed with that exact key. Each signed manifest binds the authenticated organization, approved registry ID, source reference (opaque), reconciliation kind/role, CSV SHA-256, byte count, issue time and expiry. It rejects cross-institution reuse, changed amounts/bytes, changed sources, expired and future-dated manifests, invalid signatures, unsupported or swapped keys.

**Important:** A valid Ed25519 signature proves only that someone controlled the private key corresponding to the locally approved public key. Approval by two CORTEX administrators **does not independently prove the bank or PSP owns that key**. Therefore `sourceAuthenticityVerified=false`, `bankKeyOwnershipIndependentlyVerified=false`, `externalSourceAuthorityVerified=false` remain explicit. An external, bank-approved key ceremony and independently authenticated signatory registry are still required.

**Version-specific S3 Object Lock inspection:** The existing S3 SigV4 wire client now captures `x-amz-version-id` on write and supports signed `GET` and `HEAD` reads with an explicitly pinned `versionId` query parameter. The encrypted S3 storage adapter can read/decrypt exactly that object version. `checkFinancialSnapshotObjectLock` rejects missing, ambiguous or wrong version IDs; missing retention headers; GOVERNANCE mode; insufficient/expired retention; mismatched plaintext SHA-256; and retention metadata that changes between before/after reads. It accepts only S3 `COMPLIANCE` mode with retain-until at least 24 hours beyond the inspection timestamp **as a technical predicate, not as a bank retention policy**. No bucket policy or retention settings are modified.

**Important:** S3 Object Lock protects individual object versions. A new version can be written at the same key. Therefore never read a financial source from latest-key semantics for a WORM claim. A provider's retention headers also depend on appropriate `s3:GetObjectRetention` permission. CORTEX's inspection result sets `complianceModeObserved=true`, `exactVersionBytesMatched=true` but **`bankRetentionPolicyVerified=false`**. It does not establish a full WORM compliance assessment, backup/replication policy, key custody or regulator-approved retention window.

**Audit trail:** Current authorized institution members can call the new **internal** `FinancialSourceIntakeService.checkSnapshotManifestSignature` and `checkSnapshotRetention` methods. Successful checks write scoped audit receipts with fingerprints/version metadata only, never raw financial CSV or customer references. No public endpoint, autonomous bank connector, settlement correction, case disposition, value verification or production release is introduced.

## Tests

- `bun run test:financial-provenance` verifies canonical Ed25519 signature binding, expiration, foreign institution and altered manifest denial, missing/swap/malformed key denial, immutable S3 version read predicate, COMPLIANCE vs GOVERNANCE, expired retention, altered plaintext, mismatched version, missing version and changing retention headers.
- `bun run test:financial-source-intake` uses real encrypted LocalStack S3 to test a signed manifest from a locally pinned key, tamper failure and absent Object Lock fail-closed. A basic LocalStack bucket does **not** prove S3 COMPLIANCE retention.
- Existing real PostgreSQL source maker-checker and rollback tests remain part of Production CI.

## Non-negotiable gate before real financial data

1. Obtain bank/processor-authorized source feed agreement and independently confirm signer identity/public key outside the request that carries a source manifest; keep proof of key rotation/revocation.
2. Establish versioned S3 Object Lock infrastructure in COMPLIANCE mode and independently test retention on real AWS S3, including bucket versioning, IAM `GetObjectRetention`, deny-bypass, encryption key custody, backup and approved retention duration. The LocalStack simulation does not replace this.
3. Pin trusted manifest identity and actual S3 version ID during import; do not permit client-supplied public keys to override the institution-approved registry. Verify signed digest, actual version bytes and retention evidence before promoting any snapshot into a trusted pipeline.
4. Implement an outbox/commit reconciliation for S3 uploads and PostgreSQL manifests; remove orphaned objects only after institution retention rules are validated.
5. Threat model and obtain institution security/compliance sign-off. Only then connect an approved read-only bank source connector and a controlled pilot with real bank data.

**Current verdict:** Cryptographic check and version-specific retention inspection implemented; independent bank signer ownership and approved WORM retention remain NO-GO. Do not represent a cryptographic match as a verified financial discrepancy.
