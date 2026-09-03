# APEX ONE Product Integrity

This document defines the production-facing product boundary established during Product Integrity Recovery.

## Product identity

The application is **APEX ONE — Executive Intelligence Operating System** by Apex Sync Intelligence.

The production application must not silently switch into a separate private-wealth, investor, client-portal, banking, custody, or fictional financial-product experience.

## Session boundary

The application shell is fail-closed:

1. While the server-backed session is unresolved, no enterprise UI is rendered.
2. An unauthenticated browser receives an authentication-required state.
3. An authenticated session without `org:read` receives access denied.
4. Only an authenticated session with `org:read` enters the internal APEX ONE workspace.
5. Domain-specific navigation is additionally filtered by server-issued permission capabilities.

Frontend role/presentation context is never an authorization authority.

## APEX ONE information architecture

Primary workspace:

- Executive Overview
- AI Workspace
- Customers
- Operations
- Documents
- Analytics
- Workflows
- Calendar
- Notifications
- Knowledge Hub
- Settings

Value Intelligence:

- Value Overview
- Value Opportunities
- Revenue Leakage
- Customer Value
- Capacity Intelligence
- Value Captured
- Execution Center
- AI Value Analyst
- Value Simulator
- Executive Value Reports

Visibility is capability- and feature-derived; it is not selected by a client-side role switch.

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

The gate checks the fail-closed root boundary, APEX ONE product identity, capability-derived navigation, removal of the former wealth/client portal, and known prototype/simulation markers.
