# CORTEX: financial source signer onboarding and emergency revocation

**State:** internal synthetic-only control foundation; **NOT** an approved bank/PSP connector and **NOT** independent institutional signing authority verification. No AWS or production changes.

## Why this exists

CORTEX's existing Ed25519 manifest verification proves **only** that the signature corresponds to the locally pinned public key. A local institution administrator can provide their own key; therefore it is not evidence that any bank owns that key. Institution-owned public keys and authorized export permissions require external legal and technical verification.

This milestone introduces a **durable, tenant-isolated signer onboarding dossier** and the ability to **immediately revoke** an approved source policy without retroactively altering existing evidence records.

## Internal synthetic onboarding workflow

A source-policy proposer and distinct active administrator first perform the existing approval of a source definition containing a pinned Ed25519 SPKI public key and fingerprint. Then:

1. **Request challenge:** an active institutional administrator requests a single-use, random 256-bit Ed25519 possession challenge bound to tenant ID, approved source registry ID, pinned public key fingerprint and a 15-minute expiry. The challenge is returned to the internal test harness; only its SHA-256 digest and expiry are stored in the metadata-only PostgreSQL dossier. No customer identifiers, bank data or private keys are persisted.
2. **Demonstrate possession:** the internal harness supplies a signature over the canonical challenge. The verifier checks the exact approved key, nonce, expiry and signature. The atomic state transition from `challenge_pending` to `proof_verified` prevents replay and competing submitters. **Proof of key possession is not bank ownership.**
3. **Independently review:** a different active administrator—neither the challenge requester nor the proof submitter—may record a review decision, reason, opaque external-evidence reference and SHA-256 digest. A PostgreSQL status/revision compare-and-swap permits exactly one winning reviewer, with audit in the same DB transaction. The actual external evidence is **not** authenticated by CORTEX and is never interpreted as a certified institutional instruction.
4. **Remain NO-GO:** even after `reviewed`, `bankKeyOwnershipIndependentlyVerified=false`, `externalAuthorityApprovalVerified=false`, `sourceAuthenticityVerified=false` remain set. No public onboarding route, source connector, bank API calls, real financial records or reclassified loss claims are introduced.

The proof is scoped to the current source-policy fingerprint; a different or rotated key requires a new independently approved source policy. For now each source registry can generate only one immutable challenge. An expired or failed challenge cannot silently be replaced under the same registry ID.

## Immediate revocation

`FinancialSourceIntakeService.revokeSource` now permits an authorized active institution administrator to revoke a previously approved source key **immediately** with a required reason and expected revision. It performs an atomic `approved → revoked` transition and audit log in the same PostgreSQL transaction, using tenant ID, status and expected revision as predicates.

- A revoked source cannot be reapproved via the pending-source approval path.
- Manifest-signature verification fails closed because only `approved` sources are accepted.
- New synthetic intake and import-journal preparation fail because they require an approved signing policy.
- Existing `stored` journal entries cannot be finalized after revocation: the finalize operation re-reads the policy inside its transaction.
- Already committed metadata remains as an auditable historic record; source revocation does **not** delete protected S3 versions, pretend past signatures are authentic, or move funds.
- Source rotation requires a **new** source proposal, new key, new independent approval and new signing challenge. Reusing a revoked registry ID is forbidden.

## Release/testing

```bash
bun run test:financial-signer-onboarding
bun run test:financial-source-policy-pg
bun run typecheck
bun run build
```

Production CI runs the new synthetic regression test and the existing real PostgreSQL integration suite, extended to cover challenge durability, competing reviewers, competing revokers and denial after revocation. The tested workflows use synthetic identities and cryptographic keys, no bank signatures or external service credentials.

## Required external institutional authorization

Before any real-bank pilot: identify the authorized bank/processor legal entity and feed contract, perform an independently authenticated key ceremony and record verified signatory identities and rotation/revocation channels (out of band from the data sender), establish mutually agreed data scope, verify object custody and legal retention, assess regulatory requirements, and obtain written security/compliance approval. That binding must be implemented and verified by a separate trusted authority control; the local dossier may serve as *supporting evidence*, but is never proof by itself.

**Do not change the false trust flags or enable real financial data on the strength of a valid Ed25519 challenge or an administrator review.**
