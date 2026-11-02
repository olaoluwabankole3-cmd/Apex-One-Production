# Banking case maker-checker review and reconciliation preview bridge

**Status:** feature branch / staged release gate. These capabilities do not constitute live-bank reconciliation, bank certification, permission for real bank CSV uploads, autonomous financial settlement, or verified recoveries.

## What exists in this implementation

1. Banking cases retain a versioned chronological list of case creation, staff handoff, evidence linking, investigation-plan proposal and independent review. Timeline entries are service-appended within an audit-backed database transaction. **The timeline is not cryptographically immutable or an independently certified event store.**
2. Current case owner (or authorized institution administrator) can reference existing **same-tenant** Documents or ValueOpportunities, after source read permission and current tenant membership are checked. Repeated, foreign, missing and unauthorized references are rejected. Every entry is still labeled **unverified**; existence does not prove content or banking-source authority.
3. A current authorized case maker proposes an **internal investigation plan** with rationale, case revision, a list of evidence-reference IDs, and disposition: `continue_investigation`, `request_source_review`, or `escalate_for_control_review`. One decision cycle per case for this release, and no automatic money movement, external instruction, ledger change, case closure or value capture.
4. A current, active institution **CEO or Administrator** with `case:approve` and `case:read` must approve or reject the plan. Neither the case creator nor proposal maker can approve; a second approval attempt or stale/concurrent revision is rejected. A pending review blocks handoff and evidence changes.
5. The application displays the linked references, decision and timeline under My Cases. It does not expose source bytes or create financial-recovery records.

## End-to-end financial pilot bridge — conservative first release

**Internal mechanism:** `BankingCasePilotBridge` reads a **previously registered and explicitly escalated** candidate from the existing PostgreSQL `FinancialPreviewCaseLedger`. It creates a single deterministic-ID BankingCase containing only candidate IDs, comparison category and explicit `sourceStored:false`, `coverageVerified:false`, `financialLossAssessed:false` flags. Duplicate attempts conflict. It does not persist transaction references, amount deltas or CSV bytes in the banking case. A preview-only candidate without a real linked source can only propose `request_source_review`.

**Staging-only endpoint:** `POST /api/v1/banking-cases/reconciliation-candidate` accepts bounded IDs `batchId` and `candidateId`, requires an existing PostgreSQL preview ledger, an authenticated session with `financial:read`, `financial:write`, `case:create` and a current active institutional membership. It requires **both** `APEX_DEPLOYMENT_ENVIRONMENT=staging` and `CORTEX_FINANCIAL_CASE_BRIDGE_ENABLED=true`. The endpoint is disabled by default and in production. Do not enable before institution privacy, security and synthetic-data test approval.

**Prerequisite for this endpoint:** the preview candidate must already have been created and escalated through `FinancialPreviewCaseLedger.register/review` by an authorized internal process. There is **no publicly exposed ledger registration/triage endpoint** in this delivery. The existing `/api/v1/reconciliation/preview` is ephemeral and does not register batches, which is intentional until trusted ingestion is established.

The integration test `bun run test:financial-ledger` now exercises the full actual PostgreSQL chain:

- deterministic synthetic expected/observed financial CSV
- registered metadata-only preview candidate, then staged triage escalation
- new BankingCase with bounded metadata and no financial claim
- maker proposes `request_source_review`
- a distinct authorized checker approves the internal investigative plan
- audit and persisted case state are read back from PostgreSQL

The suite must run against an **isolated disposable test database**. **Never use production banking data or production database credentials.**

## Security and integrity boundaries / follow-up

- The case timeline is bounded (100 entries), evidence references bounded (50), approvals are locked to a single cycle per case, all changes happen in institution-scoped serializable PostgreSQL transactions and include durable audit inserts. Historical cases without structured timeline retain their older audit logs.
- A case reviewer validates that linked source records still exist and are visible, but source authenticity, checksum custody, document-extraction accuracy and independent reconciliation completeness are **not** established by that check.
- Case read security is limited to current owner or institution administrator; the maker's prior ownership does not confer enduring access after handoff. Future compliance/audit compartment-specific access requires separate ABAC design.
- The preview ledger remains metadata-only and has no contractually approved ingestion adapter. The pilot cannot receive or certify live bank inputs until institution-specific authorized read-only connectors, immutable encrypted storage and source custody are completed.
- Actual financial resolutions require bank-approved policy version, a separate financial-action authorization process, independent proof of funds/ledger corrections, outcome capture and verification. None is implemented in this slice.
- Follow-ups: multi-cycle plan revision, explicit reviewer queue/notifications, full bank legal-entity/branch access rules, audit-log external immutability, approved bank integrations, UAT threat-model and disaster recovery evidence.

## CI

```bash
bun run test:banking-cases
bun run test:banking-reviews
bun run test:financial-ledger
bun run typecheck
bun run build
```

PR must not merge until Production CI, Stage 9, Stage 10 and Stage 11 are green. No AWS staging or production deployment occurs as part of this PR.
