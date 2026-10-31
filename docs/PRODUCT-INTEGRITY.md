# CORTEX Product Integrity

This document defines the production-facing product boundary established during Product Integrity Recovery.

## Product identity

The application is **CORTEX — Executive Intelligence Operating System** by QORVEX.

The production application must not silently switch into a separate private-wealth, investor, client-portal, banking, custody, or fictional financial-product experience.

## Session boundary

The application shell is fail-closed:

1. While the server-backed session is unresolved, no enterprise UI is rendered.
2. An unauthenticated browser receives an authentication-required state.
3. An authenticated session without `org:read` receives access denied.
4. Only an authenticated session with `org:read` enters the internal CORTEX workspace.
5. Domain-specific navigation is additionally filtered by server-issued permission capabilities.

Frontend role/presentation context is never an authorization authority.

## First release: financial institutions

The initial CORTEX product targets banks, payment service providers, and other
financial institutions. It is not a full replacement for a core banking system,
CRM, reconciliation engine, financial ledger, regulatory reporting platform, or
fraud detection product.

The product is being narrowed to an **evidence-to-action intelligence loop**:

1. Resolve trusted institutional context and source provenance across documents,
   knowledge, authorized customer records and connected systems.
2. Surface supported financial opportunities, leakage-related records and risks
   without inventing transaction data, results, detection coverage or confidence.
3. Give authorized staff a path to human-reviewed workflows and actions.
4. Record outcomes separately from independently verified proof, with audit trails.

Sector pain points are fragmented risk data, weak lineage, manual exceptions,
and accountability from detection to resolution. Industry standards and
supervisory observations guide prioritization but do not certify CORTEX:
- https://www.bis.org/publications/implementation-principles-effective-risk-data-aggregation-and-risk-reporting-bcbs-239-principles
- https://www.bankingsupervision.europa.eu/press/supervisory-newsletters/newsletter/2025/html/ssm.nl250219.en.html

## CORTEX information architecture

**Seven permission-filtered primary destinations:**

- Command Center (`/`)
- CORTEX Intelligence (`/ai-workspace`)
- Institutional Memory (`/knowledge-hub`)
- Documents & Evidence (`/documents`)
- Value & Risk (`/value-intelligence`)
- Action Center (`/workflows`)
- Recorded Outcomes (`/value-intelligence/captured`)

Account Settings are accessible to `org:admin` users through the account menu;
password/security controls and organization switching remain there. The
Notifications view is accessed from the topbar's bell icon. Customer source
records, value opportunities and revenue leakage investigations remain
permission-gated drill-down destinations instead of permanent navigation.

**Retired standalone UI pages** are thin Next.js redirects that preserve old
bookmarks without rendering stale demo/prototype screens:

| Old path | Destination | Why |
| --- | --- | --- |
| `/analytics` | `/value-intelligence` | Generic customer-metric dashboard duplicated value intelligence |
| `/calendar` | `/workflows` | No calendar integration exists |
| `/operations` | `/value-intelligence` | No authoritative operations telemetry integration exists |
| `/value-intelligence/ai-analyst` | `/ai-workspace` | Duplicate AI analyst screen with obsolete branding |
| `/value-intelligence/capacity` | `/value-intelligence` | No source-backed capacity telemetry integration |
| `/value-intelligence/customer` | `/customers` | Duplicate customer-valuations view; customer records remain drill-down only |
| `/value-intelligence/simulator` | `/value-intelligence` | Synthetic financial baselines not acceptable in a first financial-institution release |
| `/value-intelligence/reports` | `/value-intelligence/captured` | Mock success/export timers, not functioning reports |
| `/value-intelligence/execution` | `/workflows` | Duplicate execution UI rather than canonical action workflow |

The existing `/value-intelligence/opportunities`, `/value-intelligence/leakage`,
`/customers` and `/notifications` routes are retained as contextual views.
They do not silently imply real-time transaction ingestion, reconciliation,
AML/fraud detection, risk scoring, or regulated reporting capabilities.

**Backend services are not deleted** by a navigation or page retirement.
Organization boundaries, authorization, encrypted source objects, PostgreSQL
records, search, audit, workflows, AI provenance, and verification gates remain
intact. Any financial signal must be source-backed and explicitly qualified.
Do not silently conflate recorded captured value with certified value.

## Truthfulness rules

Production-facing UI must not:

- render customer, financial, workflow, document, or enterprise data before authentication succeeds;
- invent a user identity, portfolio, balance, investment product, KYC result, ledger event, blockchain event, or capital-deployment result;
- present a static calculation or timer as completed operational execution;
- label deterministic text as AI-generated;
- claim confidence, provenance, source counts, or operational success that the authoritative response did not provide;
- make an inert button appear to execute a command when no command endpoint exists.

When authoritative data is unavailable, the correct state is an explicit empty/unavailable state.

## Development fixtures

Legacy development/demo fixtures may remain only where they are isolated from the production surface. The current frontend `isDemoMode()` function is hard-disabled. Product-integrity CI verifies that this remains true.

Development fixtures are not release evidence and must never be used as a production fallback.

## Regression gate

Run:

```bash
bun run test:product-integrity
```

The gate checks the fail-closed root boundary, CORTEX product identity, capability-derived navigation, removal of the former wealth/client portal, and known prototype/simulation markers.
