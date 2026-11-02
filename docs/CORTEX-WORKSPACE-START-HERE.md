# CORTEX workspace — where to begin

CORTEX, a product in development by QORVEX, is intended to help financial-institution teams work from **authorized records to evidence-aware understanding, decisions and follow-up**. It is not a connected core-banking system, a money-transfer tool, an automated collection engine or a certified loss-recovery platform.

## First visit: the CORTEX home screen

The first screen answers a single question: **what is CORTEX for, and where do I begin?**
It explains the intended financial-institution journey without implying that
live bank integrations or verified recoveries already exist.

The recommended three-step journey is:

1. **Review the records** (`/documents`): find authorized documents and check stored summaries or extracted fields against originals.
2. **Look into possible issues** (`/value-intelligence`): review recorded potential risks, fee-related opportunities and source limitations. A recorded amount is not confirmed loss.
3. **Follow up** (`/workflows`): view authorized actions, owners and next steps.

The five primary menu destinations are **Home**, **Documents**, **Value & Risk**,
**Ask CORTEX** and **Actions**. AI analysis still distinguishes retrieved facts
from generated synthesis. Institutional knowledge and recorded outcomes remain
available through authorized contextual links, not top-level menu items.

All destinations and actions remain filtered by authenticated permissions
and enabled organization features. Disabled tasks explain their unavailability
instead of linking to inaccessible pages.

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
