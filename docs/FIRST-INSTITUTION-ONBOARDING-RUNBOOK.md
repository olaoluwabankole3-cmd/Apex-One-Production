# CORTEX — first financial institution pilot onboarding

**Status:** controlled pilot runbook; not a customer self-service registration feature.
**Audience:** QORVEX platform operator, authorized institution administrator, institution data/security representative.

## What an institution receives today

- A server-provisioned isolated organization and its initial Administrator account.
- Login with a mandatory first-password-change boundary and server-issued roles.
- An admin-only **Institution setup** guide in Settings, including a real scoped
  team roster after the team-readiness milestone is released.
- Permission-checked access to existing documents, intelligence and action workflows.

**Not yet available:** online company signup; secure institution-managed team invitations;
live financial connector provisioning; independently verified bank reconciliation;
customer-ready onboarding completion or verified financial recoveries.

## Before creating an institutional tenant

Obtain a documented approval from the institution's authorized sponsor and
confirm QORVEX is allowed to provision a restricted pilot workspace.

Collect only the minimum non-secret setup details through an approved channel:
- Legal institution name and preferred workspace display name.
- A unique workspace slug.
- Institution type/industry, currency, currency symbol and timezone.
- Nominated initial administrator's work email, full name and title.
- A named data/security owner and agreed scope of a first **synthetic or
  institution-approved, non-production** pilot.

Do **not** request customer passwords, production banking login credentials,
unapproved account data, encryption keys or live transaction files over AI chat
or generic onboarding forms.

## Current authorized provisioning path (operator controlled)

The existing guarded operator script is
`scripts/bootstrapInitialAdministrator.ts` (invoked by
`bun run infra:bootstrap-admin`). It requires a production database URL,
explicit `APEX_BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`, institution metadata
environment variables, and initial administrator details.

Only a QORVEX operator with approved production or staging deployment access
may run it in the correct environment. The operator must use the organization's
approved secrets channel for `DATABASE_URL` and
`APEX_BOOTSTRAP_ADMIN_PASSWORD`, not commit them to GitHub or paste them in
screenshots or messages. Initial credentials must be delivered securely to the
authorized administrator and rotated at first login.

The script is deterministic/idempotent for the same scoped organization slug
and admin email; a uniqueness conflict must be investigated rather than
overridden. It does not bulk-create staff or connect an external bank feed.
No script execution, credential handling or production tenant provisioning is
performed by the UI work in this PR.

## What the administrator does after provisioning

1. Sign in through the authorized CORTEX staging domain and complete the
   required password change; sign in again as needed.
2. Confirm the active institution identity in the authenticated session.
3. Open **Settings → Institution setup**. Verify the signed-in administrator,
   institution name and team directory. This directory is read-only.
4. If other team members are needed, request controlled provision/approval
   from the platform operator; there is currently no production-ready invitation button.
5. Work with the institution's data/security owner to approve the first source.
   Do not send bank credentials to AI chat or generic Documents fields.
6. Once permitted data is available, use **Documents & Evidence** to inspect
   authorized source records. This is not yet real transaction reconciliation.
7. Review any existing **Value & Risk** and **Action Center** records under
   assigned permissions. Outcomes remain provisional unless separately verified.

## First-value pilot exit criteria

The pilot is **not complete** until a test institution has:
- Proved tenant isolation and permission boundaries (including admin removal).
- Approved its data scope and demonstrated secure, audited source acquisition.
- Produced one reproducible candidate fee/settlement discrepancy from validated
  source inputs, with no LLM-generated authoritative financial figures.
- Assigned the candidate case to a reviewer, recorded a disposition and retained
  an audit trail.
- Distinguished recorded outcomes from independently verified financial results.
- Passed institutional user acceptance and security review.

Until then, label the environment **staging/pilot**, and treat all preliminary
comparison output as an engineering aid rather than financial advice or a bank
finding.

## Operations and rollback

Never merge or deploy the onboarding UI as a substitute for approved tenant
provisioning or bank source authorization. Use the existing PR checks, build
artifact attestation, database backup, controlled AWS staging promotion and
signed-in browser verification before exposing the release to institution users.
