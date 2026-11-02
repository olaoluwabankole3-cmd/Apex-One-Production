# CORTEX — Financial Operations MVP Workspace

**QORVEX / CORTEX** is an evidence-aware banking operations workspace for reconciliation exceptions, case investigation, responsible handoffs, and independent investigation-plan reviews.

The intended flagship workflow is: **Compare → Investigate → Hand off → Review → Report**. The internal synthetic preview is not a bank connector, loss certification, settlement action or autonomous recovery.

## Seven task-first navigation destinations

1. **Overview** (`/`) — explain CORTEX, show role-appropriate next actions, and display up to five real authorized case records. No invented financial totals.
2. **Reconciliation** (`/reconciliation`) — strict settlement/mapped-fee comparison against the existing staging-only audited API. Requires `financial:read` to view and `financial:write` to submit; no raw source retention.
3. **Cases** (`/work/cases`) — create operational issues; inspect authorized cases, evidence links and history; hand off ownership between Operations and Finance.
4. **Reviews** (`/reviews`) — checker role (`case:approve`) examines pending investigation-plan decisions. An authorized reviewer cannot check their own plan; the server enforces maker–checker rules.
5. **Evidence** (`/documents`) — inspect authorized institutional document records and their current status.
6. **Reports** (`/reports`) — show real authorized case record statuses and, only for `audit:read` roles, recent audit events. The printable view is an operational snapshot, not a certified financial report.
7. **Administration** (`/settings`) — institutional configuration, restricted to `org:admin` roles.

The sidebar and mobile menu use the **same** permission-filtered navigation. Different roles may see fewer than seven areas, by design. Existing AI, value, knowledge and workflow capabilities stay in the repo and can be surfaced contextually; they are not additional primary banking dashboards.

## Guided synthetic example

In an **explicitly enabled staging** environment, an authorized finance operator can:

1. Open **Reconciliation** and choose **Load synthetic example**. This only populates client-side synthetic CSV text.
2. Select **Run preview comparison**. The server accepts the request only when `APEX_DEPLOYMENT_ENVIRONMENT=staging` and `CORTEX_FINANCIAL_PREVIEW_ENABLED=true`. Both `financial:read` and `financial:write` are enforced on the server.
3. Review balanced and amount-discrepancy comparisons, all marked **unverified**. No source completeness, origin or monetary loss is established. The preview does **not** persist a case.
4. On an unbalanced row, choose **Prepare case** if authorized. CORTEX opens the **Cases** form with only a whitelisted comparison classification; **no amounts, references, source CSVs, digests or evidence are passed or attached**. Review and explicitly create a new, unverified operational case. Link existing permitted evidence, assign ownership and propose an internal plan only after appropriate source checks.
5. A different authorized checker opens **Reviews** to approve or reject the plan. All decisions are on the investigation plan, **not transfers or final loss assessments**.
6. Open **Reports** to inspect the visible case register, and recent audit events if authorized.

**The guided preview-to-case step creates no record automatically.** It transfers only the allowed kind and comparison classification through a short URL parameter. It cannot transfer financial data or authenticate evidence. The existing stored synthetic pilot candidate bridge is separate, staging-gated and requires prior durable candidate registration. This browser draft is **not** that bridge and does not link an ephemeral preview to a persisted source or certify a case. A manual case may initially have no evidence, so the investigator must attach an independently authorized source before any plan is proposed.

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
