# CORTEX — Bank-Wide Work Orchestration Roadmap

**Owner:** QORVEX engineering  |  **Target pilot:** 12 November 2026  |  **Baseline:** 3 November 2026, `main` `4657c7b55504805098628965f412a5b6925ac779`

## Product promise and definition of done

CORTEX is a **shared bank operations control layer** atop—not a replacement for—core banking, payment switches, CRM, HR, credit and audit systems. Staff see their permitted work and know who must act next, who is waiting, which decision is approved, and whether an independently sourced outcome is confirmed. Different departments act on **tasks linked to one case** without automatically receiving the entire case or taking case ownership.

**November 12 target:** controlled, demonstrable, security-tested pilot using synthetic cases and separately authenticated role identities, with one complete Operations→Finance task journey, a second workflow using the same task engine, usable task-first UI, staged release evidence and explicit unimplemented capabilities. **Not a promised live bank integration, financial recovery claim, regulatory certification, broad institution deployment, or feature-for-feature incumbent replacement.**

**Current verified base:** 7 permission-filtered primary navigation destinations; authenticated finance synthetic preview (staging opt-in); open/unverified case intake; Operations→Finance owner handoff; evidence references; independently checked internal investigation plans; bounded audit/report views; read-only next-action/outcome-unconfirmed labels; 3-role isolated CI browser gate. The public staging health probes pass. **Missing:** separate departmental tasks and queues, accepted transfers, SLA/due dates, source-backed completion, approved bank identities for live UAT.

## Delivery plan — critical path and exit tests

| Date | Engineering work | Visible demonstration / exit gate | Dependencies |
|---|---|---|---|
| **Nov 3** | Freeze task vs case ownership and restricted-share policy; define task contract, states, RBAC, audit, storage; ship roadmap | Schema and security tests added; no sensitive case leak through task invitations | Existing case tenant store, current member validation |
| **Nov 4** | Tenant-scoped task request/accept/respond lifecycle and revision checks; separate task assignee from case owner | Operations asks Finance a specific question; Finance accepts and responds; origin owner stays accountable | Nov 3 persisted contract |
| **Nov 5** | My Work / Team Queue / Waiting on Others; bounded server-side pagination; transfer request/accept (not automatic reassignment) | Sender can track acceptance; receiving department sees only authorized task details | Task lifecycle, membership roster |
| **Nov 6** | Department registry, named teams and role-scoped visibility; foundation for Branch/Payments/Credit/IT/Risk/Audit | Configured department team receives requested work without unauthorized case access | Task read isolation; no invented scopes |
| **Nov 7** | Deadline policy, escalation owner and overdue work; attribution and audit | A synthetic overdue item appears in a manager's scoped queue and escalates once | Durable dates, manager membership, idempotency |
| **Nov 8** | Completion checkpoint contracts, evidence custody and independent outcome assessment; no false positive | Approved investigation without external confirmation remains open; synthetic confirmation shown as simulated only | Approval history; source authority policy |
| **Nov 9** | Reuse task engine for employee access removal (IT + HR) or credit disbursement (Credit + Finance) | Two different bank processes use the same engine and security model | Department visibility, outcome policies |
| **Nov 10** | Premium QORVEX UX, operator detail drawers, role landing views, onboarding and accessible responsive design | New user completes workflow without support; no fake KPIs | Representative data and actual actions |
| **Nov 11** | Exact-source CI, 3+ user browser UAT, cross-tenant denial, retry/concurrency, storage recovery, rollback rehearsal, accessibility and performance smoke | End-to-end evidence record with pass/fail, signed-in staging where approved identities exist | Feature freeze, deployment artifact |
| **Nov 12** | Production-like *staging* candidate release, public smoke test, customer demo, pitch, known limitations and phase-two backlog | Runnable interactive banking pilot and honest go/no-go record | All required security and CI gates |

**Schedule rule:** no insecure shortcuts to preserve a date. Incomplete features become read-only demonstrators or clearly labeled future work; do not claim they are finished.

## Work model: invariants

**Case:** single institutional reference, originating contact owner, overall status, confidential case detail, participants, verified outcome (initially unverified) and append-only history. **Task:** a bounded question or action within a case; requesting actor, target department, designated recipient/queue, required response/proof, independent lifecycle, requested/accepted timestamps, owner and due timestamp. Case ownership **never** changes as an effect of requesting or accepting a subtask. **Transfer request:** distinct process; original case owner remains accountable until named receiver accepts. **Review:** independent checker approves the scope of an internal decision; this is not evidence an external customer, bank or financial outcome occurred. **Outcome:** defined by a type-specific source-policy, approved verification authority and evidence-backed receipt; absent proof means unconfirmed.

### Initial task lifecycle

`requested -> accepted -> in_progress -> responded`; `requested -> declined`; `requested/accepted/in_progress -> cancelled` (with authorization and reason). All transitions require authenticated tenant, current persisted membership, allowed role, expected revision, actor attribution and durable audit. No arbitrary state jumps; read details minimally by task recipient, requester, relevant case owner or authorized supervisor. A task recipient must **not** inherit access to the parent case description, documents or financial transactions through a task link. Capacity and pagination are bounded; no client-supplied organization ID is authoritative.

### Permissions and privacy

- Check actual persisted membership and active status on every read/mutation, not just a session's cached role. Unknown role denies access.
- Role grants for task capabilities are incremental and scoped. The recipient sees the bounded task question; the case owner retains the full case where authorized. Sensitive AML, HR and Legal cases require **separate** privacy partitions before department onboarding.
- Suppress known/unknown cross-tenant distinctions in error responses. Do not embed bank financial references or document contents in URLs, notifications, browser analytics or logs.
- All updates run under serialized tenant transactions with revision checks. Tests cover replay, concurrent acceptance, stale revision, disabled user, cross-tenant and self-checker.
- The pilot must not expose a public synthetic login or fake real-bank settlement data.

## One main workspace, not 20 dashboards

Use **Home** tabs: My Work, Team Queue, Waiting on Others, My Approvals, Department Overview and Bank Overview. Gate tabs and data by membership and capability. Keep specialist workspaces contextual for Reconciliation, Cases & Requests, Evidence, Reports and Administration, within current seven navigation roots. Department-specific configuration targets: Branch/Channels, Payments Operations, Customer Banking, Credit/Recoveries, Treasury, Finance, Risk, Compliance/Legal/Financial Crime (restricted), Technology/InfoSec (restricted), HR/Corporate Services (restricted), Audit/Internal Control (independent), Executive Governance, Products/Partnerships. These are **target groups**, not completed departments.

## Proof that the product is useful

Run an anonymized comparison with at least one authorized bank operations lead on a multi-team issue. Measure (a) elapsed time to identify the accountable next actor, (b) number of colleague follow-ups, (c) percentage of 'resolved' items with authoritative outcome proof, and (d) time required to reconstruct the handoff/evidence chain. Never describe a superiority claim as validated until this comparison is completed.

## Engineering gates at every merge and staging release

1. **G0 — design/security:** no confidential fields exposed by task DTO; no privilege bypass; state machine and tenant partition tests.
2. **G1 — code:** typecheck, unit, concurrency, real PostgreSQL durability where applicable, auth and RBAC.
3. **G2 — browser:** 3-role authenticated workflow through the production-built HTTP app; fail-closed error scenarios.
4. **G3 — release:** all four PR workflows green, exact-main CI green, verified candidate archive checksum, source commit and OCI revision; immutable ECR digest; staging migration checkpoint if necessary; guarded deploy and rollback.
5. **G4 — operator:** trusted live staging users (not copied production accounts), walk-through, accessible task views, no fabricated data, clear unavailable states, documented limitations.
6. **G5 — bank adoption (later):** explicit data-processing approval, identity federation, audit/export retention policy, vetted bank-owned source feeds, penetration assessment, regulatory/security review, integration contracts and pilot sign-off.

**Non-blocking future program (after Nov 12):** bank-owned ingestion connectors; multi-replica and resilience; SSO/MFA/SCIM, full permission hierarchy; workflow designer and configurable SLA rules; AML restricted tenancy; branch and mobile scale, digital-signature and retention; analytics backed only by verified facts; vendor integrations; migration/cost/enterprise onboarding; compliance and professional security review. A 10-day staging pilot cannot demonstrate completion of this program.

## November 3 execution ledger

- **Merged and staged:** initial named-person cross-department task lifecycle; explicit task accountability separate from confidential case ownership; role-filtered Home task lists.
- **Current change:** department-wide **unassigned** queues ONLY for explicitly shared Operations↔Finance task questions, with atomic first-claim-wins. This is not a general case-sharing or HR/AML task-broadcast capability.
- **Current implementation milestone:** a receiver-accepted **case ownership transfer** replaces normal immediate handoff. The sender remains owner through pending and declined requests. One eligible named recipient may accept through an atomic CAS, while emergency administrator reassignment is separately restricted, audited and blocked during a pending offer. Public staging release and approved live signed-in UAT remain separate gates.
- **Still not delivered:** full department registry, team supervisor hierarchy, deadlines/escalation, authoritative outcome adapters, second bank-wide process and institutional live UAT.
- Every PR still needs four green PR suites, exact-main CI, provenance-bound ECR staging promotion, and actual signed-in UAT where approved accounts exist.

## Honest daily release ledger

Each day, link PR, exact commit, CI run, staging image digest, screenshots/browser evidence and blocker in GitHub issue #55. Mark `NOT STARTED / IN PROGRESS / TESTED / MERGED / STAGED / BLOCKED` separately. **Only STAGED + UAT-verified** features are permitted in the interactive demo.
