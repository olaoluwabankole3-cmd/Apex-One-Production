# CORTEX — institution onboarding and first-value journey

Status: product and engineering architecture proposal. This is **not** a declaration of deployed capabilities.

## Problem

CORTEX currently exposes several strong engineering foundations behind a first-use
experience that assumes an institution is already provisioned, authorized users
already exist, and sources already contain useful records. Operators cannot discover
how a company is onboarded or what the first meaningful result should be.

**Product principle:** show an institution the next authorized action and its state,
not a wall of dashboards. Navigation count is not the problem. Preserve the seven
existing primary destinations while organizing them around one continuous workflow.

## The promise of the financial-institution MVP

For a bank or payment service provider, CORTEX should allow an approved operator
to review a bounded, authorized set of settlement/fee records, identify **candidate**
discrepancies, inspect the source evidence, assign a reviewer, record decisions
and track whether an outcome has been independently verified.

The product must **not** claim fraud detection, recovered funds, verified financial
losses, live integrations, or complete reconciliation where they are not present.

## Journey and authoritative states

| Stage | Owner and main screen | Definition of complete | State today |
| --- | --- | --- | --- |
| 1. Provision institution | QORVEX platform operator, then institution admin | Organization created with server-side tenant isolation, signed onboarding approval, administrator identity and a testable access boundary | Controlled bootstrap script exists; self-service org creation does not |
| 2. Activate team | Institution admin | Approved colleagues have server-bound memberships, appropriate roles and auditable invitations; no cross-tenant access | Server-side roles/memberships exist; no verified invite/approval UX in Settings |
| 3. Choose pilot use case | Admin and operations lead | First reconciliation scope and owner selected; permitted source data and expected outcomes documented | No formal in-app use-case setup |
| 4. Approve source connection | Security/data owner | Explicit institutional authorization, minimal access scope, audited source inventory, ingestion and connection health | No institution-approved trusted bank-feed connector or authoritative connector inventory |
| 5. Validate financial inputs | Operations and data owner | Mapped fields, time range, lineage, quality checks, independent raw-source integrity, and signed validation | Bounded synthetic CSV comparison foundations; not full production ingestion |
| 6. Investigate | Analyst | Candidate discrepancy tied to concrete evidence and readable calculation; uncertain findings labeled provisional | Partial document, AI, and recorded-value foundations |
| 7. Resolve | Reviewer and approver | Assigned ownership, review, disposition, approval trail and captured outcome separated from independent certification | Workflow and lifecycle foundations, not a completed bank-approved resolution chain |
| 8. Measure | Institution leadership | Source-supported trends and verified outcomes; no invented balances or recoveries | Dashboard and recorded outcome surfaces exist, but no verified live recoveries |

## What a first-time institution should see

### Before signup or login
- Clear explanation: who CORTEX serves, what it investigates and how data is protected.
- Institution onboarding must be **approved**, not an anonymous instant banking workspace.
- A controlled request/onboarding channel is needed before public self-service sign-up.
- No request for live banking credentials in chat or generic document forms.

### First administrator login
- Confirm organization name from **authenticated server session**, never from a
  browser-supplied tenant ID.
- Show the setup sequence with truthfully labeled stages: access confirmed,
  operator provisioning required, connection unavailable, authorized records viewable.
- Explain that the current Settings guide is informational, not a full self-service wizard.
- One relevant next action per stage; no fake "Connect now", "Invite team" or
  "Reconcile" control without an authenticated production endpoint.

### First analyst login
- Show authorized institution, their role and today's permitted starting task.
- If source data is unavailable, explain *why* and what approved step is needed.
- If data is available, move directly to a scoped evidence/case review.
- Source status and ownership should be visible next to every finding.

### First reviewer login
- Show assigned review queues, source-backed details, approval boundaries and
  decisions that still need independent verification.
- Reject cases where sources or permissions are missing, rather than inventing a decision.

## Required architecture boundaries

1. **Tenant provisioning:** a server-authoritative organization record, a unique
   tenant boundary, approved administrative operator and tenant-level audit events.
2. **Identity/membership:** institution-managed SSO or approved accounts, invite
   acceptance, role assignments, revocation and least privilege.
3. **Source registry:** connector type, authorization and owner, allowed scope,
   validation state, last successful ingestion, freshness, errors, and disconnect.
4. **Ingestion:** encrypted transport and storage; immutable raw provenance as
   allowed by institution policy; explicit source origin and row/document IDs.
5. **Reconciliation:** bounded financial matching with reproducible calculations,
   exceptions and reason codes. Do not let an LLM create authoritative amounts.
6. **Case and evidence ledger:** candidate → reviewed → resolved/rejected with
   attributable owners, source links, audit trail and reviewer authorization.
7. **Outcome verification:** separate "recorded", "approved" and "independently
   confirmed" states with durable evidence and exportable review history.
8. **Experience orchestration:** derive onboarding state from backend facts, not
   local-storage checkboxes or inferred company activity.

The frontend organization config currently uses presentation defaults; only
server-issued session organization identity is authoritative. Do not derive a
company's regulatory status, integrations, completed onboarding, or recovery
totals from frontend defaults.

## Suggested vertical-slice engineering order

1. Define institution setup and source-registry server contracts with
   tenant-based authorization and audit events. Make all missing states explicit.
2. Build operator-approved new-tenant provisioning and secure invitation flows.
   Do not expose the existing bootstrap script as a public route.
3. Implement a narrowly scoped, institution-approved CSV ingestion pilot with
   integrity, schema validation, and clearly bounded data provenance.
4. Implement the first real **fee/settlement exception investigation** from
   source ingestion to reviewable provisional case and reviewer disposition.
5. Add outcome verification, completion criteria, traceable exports and UAT gates.
6. Only then scale to additional source connectors and richer intelligence dashboards.

## UX acceptance tests

- A new admin can explain the product, their institution state and the next
  onboarding dependency in **under 60 seconds** without external explanation.
- An operator can identify which team member owns the next step.
- No button implies the existence of a backend action it cannot perform.
- An empty workspace explains whether the blocker is permissions, absent data,
  unsupported source integration, or a technical failure.
- No unverified figure is styled as certified loss, financial savings or recovered cash.
- A user never sees data from another organization; authorization is enforced
  by backend scopes, not navigation visibility alone.
- CORTEX branding and interaction patterns are consistent, but visual polish
  does not substitute for the end-to-end process.

## What the first implementation slice changes

The admin-only Settings surface now exposes a truthful setup guide tied to
authenticated session identity, with links to existing permission-checked
documents, value and workflow areas. Admins can discover this from the Command
Center.

It **does not** provision a new company, invite colleagues, connect bank feeds,
ingest trusted financial sources, or mark onboarding complete. Those features
need separate backend work, tests and institution-approved release gates.
