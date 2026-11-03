# CORTEX — Financial Operations MVP Workspace

**QORVEX / CORTEX** is an evidence-aware banking operations workspace for reconciliation exceptions, case investigation, responsible handoffs, and independent investigation-plan reviews.

The intended flagship workflow is: **Compare → Investigate → Hand off → Review → Report**. The internal synthetic preview is not a bank connector, loss certification, settlement action or autonomous recovery.

## Seven task-first navigation destinations

1. **Overview** (`/`) — put authenticated **My assigned requests** and **Waiting on Others** first (up to 25 named, scoped tasks per API page), followed by up to five real authorized case records; show the next step, actor, and the distinction between internal plan approval and independently confirmed completion. No invented financial totals or due dates.
2. **Reconciliation** (`/reconciliation`) — strict settlement/mapped-fee comparison against the existing staging-only audited API. Requires `financial:read` to view and scoped `financial:preview` (or existing `financial:write`) to submit; Finance staff can compare synthetic records without receiving broader write permissions. No raw source retention.
3. **Cases** (`/work/cases`) — create operational issues; inspect authorized cases, evidence links and history; hand off ownership between Operations and Finance.
4. **Reviews** (`/reviews`) — checker role (`case:approve`) examines pending investigation-plan decisions. An authorized reviewer cannot check their own plan; the server enforces maker–checker rules.
5. **Evidence** (`/documents`) — inspect authorized institutional document records and their current status.
6. **Reports** (`/reports`) — show real authorized case record statuses and, only for `audit:read` roles, recent audit events. The printable view is an operational snapshot, not a certified financial report.
7. **Administration** (`/settings`) — institutional configuration, restricted to `org:admin` roles.

The sidebar and mobile menu use the **same** permission-filtered navigation. Different roles may see fewer than seven areas, by design. Existing AI, value, knowledge and workflow capabilities stay in the repo and can be surfaced contextually; they are not additional primary banking dashboards.

## Guided synthetic example

In an **explicitly enabled staging** environment, an authorized finance operator can:

1. Open **Reconciliation** and choose **Load synthetic example**. This only populates client-side synthetic CSV text.
2. Select **Run preview comparison**. The server accepts the request only when `APEX_DEPLOYMENT_ENVIRONMENT=staging` and `CORTEX_FINANCIAL_PREVIEW_ENABLED=true`. The server requires `financial:read` and either a narrowly scoped `financial:preview` or a previously issued authorized `financial:write` capability; preview authority does not permit financial-source writes.
3. Review balanced and amount-discrepancy comparisons, all marked **unverified**. No source completeness, origin or monetary loss is established. The preview does **not** persist a case.
4. On an unbalanced row, choose **Prepare case** if authorized. CORTEX opens the **Cases** form with only a whitelisted comparison classification; **no amounts, references, source CSVs, digests or evidence are passed or attached**. Review and explicitly create a new, unverified operational case. Link existing permitted evidence, assign ownership and propose an internal plan only after appropriate source checks.
5. A different authorized checker opens **Reviews** to approve or reject the plan. All decisions are on the investigation plan, **not transfers or final loss assessments**.
6. Open **Reports** to inspect the visible case register, and recent audit events if authorized.

**The guided preview-to-case step creates no record automatically.** It transfers only the allowed kind and comparison classification through a short URL parameter. It cannot transfer financial data or authenticate evidence. The existing stored synthetic pilot candidate bridge is separate, staging-gated and requires prior durable candidate registration. This browser draft is **not** that bridge and does not link an ephemeral preview to a persisted source or certify a case. A manual case may initially have no evidence, so the investigator must attach an independently authorized source before any plan is proposed.

## Independent browser/HTTP acceptance

Stage 10 CI now includes `scripts/runBrowserBankingJourneyAssurance.mjs`, a real Chromium and production-built HTTP journey across separate disposable **Finance**, **Operations** and **Administrator checker** accounts. It exercises synthetic preview, role restrictions, explicit case intake, accountable handoff, an existing unverified synthetic evidence reference, maker-checker separation, independent review and durable audit records. The browser test fails closed unless `CI=true`, `TEST_ENV=true`, local base URL `http://localhost:3000` and the staging-only preview flags are explicitly provided. Do not run the fixture seed (which clears its dedicated test database) against AWS staging or production.

This test demonstrates the application logic and user interactions **in isolated CI services**, not successful login or organizational membership on the live AWS staging tenant. Live staging acceptance requires three distinct approved synthetic test identities and explicit institutional authorization to create test records; it must not use any real bank accounts or provider data.

## Accepted case ownership transfers — institution pilot

The earlier **immediate** case handoff has been replaced for regular Finance and Operations members by a genuine **request → receiver accepts or declines** workflow. A pending offer is stored on the tenant-scoped BankingCase and does not release the existing owner or provide parent-case read access to the invitee. The receiving employee sees a limited **Incoming Case Transfers** inbox on Home and Cases: originating/receiving departments, priority, and date only; **never** case title, description, evidence, transaction details or private sender reason. The sender may withdraw an offer before acceptance; the recipient may decline with a recorded reason. Both operations leave the owner unchanged. Exactly one accepted transition moves ownership and department, updates the case revision/timeline and records a durable audit receipt with the accepting employee's identity. A competing stale/replayed action fails closed through one tenant-restricted PostgreSQL conditional update. Evidence and plan proposals are locked while an offer is pending.

The legacy `POST /api/v1/banking-cases/[id]/handoff` is retained **only** for a currently authenticated and persisted **Administrator** emergency reassignment, separately audited as `banking_case:emergency_handoff`, with the same compare-and-update guard and no ability to override a pending invitation. No ordinary employee can invoke instant reassignment.

**Boundaries:** Only explicitly named Operations ↔ Finance transfers are supported. The invitation does not certify identity beyond current tenant membership, verify an external banking outcome, or move any funds. Invitations list up to 50 pending entries with an explicit overflow warning; broader team-based case transfer requests and institution identity federation are future extensions. Isolated synthetic CI with real PostgreSQL/Chromium is not the same as live signed-in staging UAT.

## Outcome-confirmation architecture — first increment

**What is real in the UI:** the Overview and case details derive next-action checkpoints directly from the authorized case record. A case with an approved internal investigation plan explicitly says **plan approved; outcome unconfirmed**. This projection is read-only; it does not invent a bank delivery confirmation, task deadline or case closure. Existing Finance/Operations ownership is still the only persisted assignment model; no shared cross-department subtask inbox has been built yet.

**What is simulated in CI:** `lib/cortexCompletionRules.ts` defines reusable completion policies for failed transfers, loan disbursements, employee access removal and internal-control remediation. The evaluator accepts `synthetic_ci_fixture` receipts only, and can show two contrasting endings: a simulated required event was observed, versus no valid event and responsibility remains open. The tests assert that **both** results have `bankOutcomeVerified=false`. No real source-authority adapter or independent evidence verification exists yet.

**Next architectural dependencies:** institute permission-scoped case participants and separate task requests from case ownership, accepted transfers, department queues, promised deadlines, escalation, authoritative confirmation adapters, and independent outcome verification. Do not advertise these as completed. Bank-wide feature coverage remains the goal; narrow banking-case routes are the current pilot.

## Cross-department departmental task foundation (Nov 3 milestone)

CORTEX includes a **separate tenant-scoped BankingWorkTask record**, private named-recipient requests and **explicitly department-shared requests** with a first-claim-wins rule. A named task follows request/accept/respond/decline; a department-shared task is unassigned while requested, and only becomes a named recipient's task after they atomically claim it. It is reachable through **Home** and the existing **Cases** workspace as **My assigned requests** and **Waiting on Others**, with a case-specific **Request department task** control. A task records a bounded title, question, requested response, requester, named recipient, target department, state and independent revision. The case owner stays unchanged; accepting/responding is not a financial operation or real-world outcome proof.

**Privacy:** A task recipient is not granted case/document access simply because they have a task. The API lists personal requests by current recipient/requester only. The **Team Queue** is a separate read permission for active, correctly departmentalized Operations/Finance staff: it reveals *only* tasks the sender explicitly chose to share with that department, and it never grants the confidential parent case, documents, or finance records. Existing private named tasks never appear in it. A generic administrator has no automatic Team Queue read authority. A member may claim an unassigned shared request with **one atomic tenant/revision/state-checked PostgreSQL update**, after which it disappears from the unclaimed queue and is visible to that named member. Only that member may respond. All transitions are audited and no response certifies a bank outcome. The first rollout allows **Operations and Finance** recipients only, since those are the validated case-assignment roles. Task text must not contain confidential account data; no source attachment is automatically transferred.

**Limitations:** This Team Queue is limited to explicitly department-shared Operations↔Finance requests. It is not an organization-wide broadcast, an arbitrary department directory, a case ownership-transfer acceptance workflow, an SLA engine, independently source-verified outcomes, or access to restricted HR/Compliance/Legal cases. Those remain future work per [the delivery roadmap](CORTEX-BANK-WIDE-DELIVERY-ROADMAP-NOV-2026.md). Pagination and case task counts are bounded; no financial metrics are inferred.

## Empty, failure and permission boundaries

- All counts on the Overview, Reviews and Reports pages are explicitly limited to the API's first 5, 50 or 25 visible entries; they are **not** global totals.
- API failures show an unavailable state, not simulated or cached metrics.
- A user without `case:approve` will not see Reviews in the sidebar.
- A user without `org:admin` will not see Administration.
- An operator with read-only financial authority may view Reconciliation but cannot run a preview.
- Production does **not** enable financial preview, even if a client opens the page directly.
- There is no public raw-bank-data upload interface, real-bank connector, production retention certification, movement of money or authorized loss confirmation.
- Bank data remains NO-GO without independent institutional approvals and immutable-storage readiness.

## UX design and delivery focus

The application uses QORVEX charcoal `#171715`, copper `#C58D5F`, warm copper `#D9A06F` and ivory `#F5F1E8`. Historic CSS utility tokens named `gold` can remain for backward compatibility, but must resolve to QORVEX copper rather than introduce unrelated gold branding.

### 10-day sprint priority

- **Now:** Deliver seven task-first routes, a genuine case-backed command center and safe synthetic reconciliation/review/report screens. Keep existing backend authorization controls.
- **Next:** Usability polish for cases and evidence, support a guided role-specific scenario, test and refine mobile navigation and empty/error states.
- **Release:** Confirm all four GitHub CI workflows; verify combined-main CI; approve a restricted staging deployment and smoke test. Merge does **not** automatically deploy to AWS.
- **Outside the synthetic MVP:** Independently approved financial feeds, real S3 Object Lock custody proof, live institution signing authority and financial compliance sign-off. None are guaranteed by the sprint deadline.

This document describes engineering scope and current safety boundaries, **not** a claim that the latest GitHub source is already running in an AWS staging application.
