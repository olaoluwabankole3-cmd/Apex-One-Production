# CORTEX workspace — where to begin

CORTEX, a product in development by QORVEX, is intended to help financial-institution teams work from **authorized records to evidence-aware understanding, decisions and follow-up**. It is not a connected core-banking system, a money-transfer tool, an automated collection engine or a certified loss-recovery platform.

## First visit: the Command Center

The first authenticated screen deliberately does **not** show invented financial totals, arbitrary synthetic chart data or promises of a connected bank source. It presents four real, role-gated starting points, in order:

1. **Documents & Evidence** (`/documents`): view authorized source documents. Upload and deletion depend on separate permissions. Documents and extracted fields are not independently certified simply because they are stored.
2. **Institutional Memory** (`/knowledge-hub`): explore information published to your authorized organization. Items may be missing, unpublished or quarantined.
3. **CORTEX Intelligence** (`/ai-workspace`): ask questions about authorized records. Coverage, confidence and source-backed verification are constrained by data availability and the model trust boundary.
4. **Action Center** (`/workflows`): view and manage permitted workflows or follow-ups, subject to capability checks and human approvals where applicable.

Users with the appropriate permission may also open **Value & Risk** (`/value-intelligence`) to review recorded opportunity and risk context. **Recorded Outcomes** (`/value-intelligence/captured`) are lifecycle records, **not** proof of independently verified financial recovery.

Access to a journey is derived from the authenticated session and the organization's enabled features. An unavailable step is shown as unavailable, not linked to an unauthorized page.

## Capabilities: available versus experimental

**Available engineering foundations:** authentication/RBAC, organization scoping, documents and extraction boundaries, knowledge workflows, AI provenance restrictions, audit trails, workflow/action records, and value/opportunity lifecycle records.

**Experimental/internal, not a bank integration:** deterministic settlement/fee comparison for bounded synthetic CSVs, staging-only preview endpoint disabled by default, metadata-only internal provisional case ledger, read-only encrypted-source byte integrity checks.

**Still missing:** institution-approved trusted feed acquisition, cryptographically authenticated origin, provider-enforced immutable/locked retention, robust reconciliation of real switch/acquirer/core-ledger data, resolution/approval chain, confirmed recoveries and signed-off institutional UAT. Never label a recorded amount as verified loss, saved funds or financial results unless supported by an independent authority.

## QORVEX design basis

The corporate source of truth is `olaoluwabankole3-cmd/QORVEX`, especially `QORVEX/src/qorvex3/base.css` and the SVG mark in `QORVEX/public/qorvex-emblem.svg`. The application uses:

- Charcoal / dark ink `#171715`
- Copper `#C58D5F`, darker copper `#A65A2E`
- Cream `#F5F1E8`, stone `#E5E1D8`
- Light copper highlight `#D9A06F`

Existing semantic Tailwind class names `gold`, `ivory`, `matte` and `charcoal` remain for **backward-compatible styling only**. Their mapped values now match QORVEX. The rest of the product's screens still need individual usability reviews: the first change addresses global brand tokens, app chrome and the entry flow, not complete redesign of every functional screen.

## Next product work

1. Interview/screen-record a first-time authorized operator and test whether they can explain CORTEX and find a document without instruction.
2. Redesign **Documents & Evidence** as a guided upload / inspect / verify journey, including truthful empty/loading/error states and non-durable extraction disclaimers.
3. Redesign **CORTEX Intelligence** for source citations, visible authorized scope and explicit unsupported-question outcomes.
4. Make **Value & Risk** task-driven, separate provisional estimates from verified outcomes, and align workflow/action review with role permissions.
5. Build institution-authorized source ingestion and actual audited case-management capability before claiming full financial reconciliation.

**Release:** first stage UI redesign only; do not auto-deploy to AWS on merge. CI and controlled staging promotion are separate gates.
