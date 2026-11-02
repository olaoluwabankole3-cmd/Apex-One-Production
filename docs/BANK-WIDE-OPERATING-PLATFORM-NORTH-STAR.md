# CORTEX by QORVEX — Bank-Wide Operating Platform North Star

**Status:** proposed long-term product architecture and research hypotheses, **not shipped functionality**, regulatory approval, or permission to process customer banking data.
**Initial target:** Nigerian deposit money banks, payment service banks and regulated payment institutions; build configurable abstractions for other markets and bank types.
**Relationship to current release:** `docs/PRODUCT-INTEGRITY.md` describes the narrower first release and remains authoritative for what we may claim today. No existing functionality is represented as complete because of this document.

## Executive thesis

CORTEX should become an **institution-controlled coordination and intelligence layer above existing systems of record**. It must help every department understand its work, hand work to another department, apply approved controls, prove what happened and learn from the outcome.

**Do not promise to replace core banking, GL, payments switch, SWIFT, card processor, HRIS, ERP, AML transaction-monitoring systems, credit decision engine, or the regulator's systems.** Banks retain those authoritative systems. CORTEX integrates their permitted events and evidence, orchestrates human/system work, and records its own cases, decisions and audit trail. Each outbound high-impact action remains under bank-approved authority.

### Non-negotiable user promises

1. **One work identity and one accountable case** across departments; employees see role-appropriate tasks, not 20 unrelated dashboards.
2. **Know the exact source of every material claim.** Never turn AI prose, synthetic comparisons, low-quality document extraction or a workflow-state update into a verified banking fact.
3. **See where work is stuck, who owns it, the controlling SLA, the policy that applies, and the next permissible action.**
4. **Make the bank's existing systems more usable and auditable** before attempting any costly replacement.
5. **Tie activity to independently demonstrable business outcomes** without conflating potential, approved, recorded, realized and externally verified value.
6. **Protect safety-critical independence:** maker/checker separation; risk, compliance and audit independence; controls defined by institution-approved policies; no unauthorized autonomous payments, account restrictions, risk acceptance, credit decisions or AML dispositions.

## Competitive reality and testable hypotheses

The market is not empty. Pega, ServiceNow FSO, nCino and process-orchestration products already cover significant portions of front/middle/back-office workflows. CORTEX cannot claim these competitors lack cross-department workflows or AI. Validate these **potential gaps** against procurement and user research:

| Hypothesis worth testing | Product response | Proof of value |
| --- | --- | --- |
| Financial exceptions cross many uncoordinated teams and systems | Unified financial-exception case with source lineage, ownership and maker/checker resolution | Reduction in unresolved exceptions, dispute time and write-offs |
| Policies are in documents but absent from daily work | Versioned, approval-backed policy-to-control mapping with evidence of each decision | Less time spent collecting control evidence; fewer missing approvals |
| Departments lose context during handoffs | One shared case graph with task-level privacy, cross-unit escalation and full handoff history | Time from detection to owner assignment; reduced bouncing |
| Institutions cannot show whether AI-driven suggestions were right | Evidence-aware AI with bounded retrieval, citations, confidence limitations, reviewer sign-off and outcome feedback | Reviewed recommendation accuracy, reversal rate and audit sampling |
| Managers see KPIs after incidents rather than early operational bottlenecks | Work queue, process telemetry, aged tasks and recurrence/root-cause detection | SLA breach rate, rework, preventable incident recurrence |
| Local payment/operational rules are awkward to configure | Nigerian bank/PSB process templates, with organization-configurable controls and calendars | Deployment effort, per-workflow adoption and configuration time |
| Existing tools force users through technical screens | Role- and task-driven workbench with natural-language search and guided steps | Time-to-first-action, completion rate, staff training hours |

These are **hypotheses**, not proven customer complaints, claims of competitor absence, or evidence of product-market fit. Research with bank COOs, operations, risk/compliance, internal audit, IT/security and branch/department staff.

## Department and journey catalog

Each domain becomes a **configurable work package**, not a standalone duplicate workflow engine or permanent top-level navigation entry. Group, bank, subsidiary, branch, legal entity and department access boundaries must be modeled where required.

| Department / function | End-to-end journeys to support | Systems / records involved | Guardrails |
| --- | --- | --- | --- |
| Payments and settlement operations | Inward/outward exceptions, failed transfers, settlement differences, card/ATM/POS disputes, chargebacks, suspense items, reversals and clearing | Core banking, switch, processors, settlement reports, GL | No automated fund movement without explicit approved command authority |
| Finance / financial control | GL breaks, reconciliations, month-end close, expense approvals, fee validation, accrual exceptions, financial reporting evidence | GL, ERP, reconciliation, statements | Reconciled vs estimated vs approved distinctions |
| Treasury / ALM | Liquidity operations tasks, funding requests, limit alerts, collateral and settlement confirmations, position sign-offs | Treasury system, market/position feeds, GL | No autonomous dealing, funding or limit changes |
| Credit / lending | Loan origination coordination, documents, underwriting checklists, committee approvals, disbursement readiness, covenants, collateral and exceptions | LOS/LMS, CBS, bureau, collateral registers | Independent credit approval, suitability and fair-treatment controls |
| Collections / recoveries | Arrears segmentation, authorized outreach cases, restructuring requests, dispute handling, recovered-fund evidence | LMS, CRM, payments | Consumer protection, authorization and collections law |
| Fraud and financial crime | Fraud alert triage, evidence review, interbank cooperation, AML/KYC alert escalation, sanctions case coordination | Existing fraud/AML/KYC engines, core, screening | No arbitrary automated suspicion decisions or account freezes; preserve legal restrictions |
| Risk management | Operational loss events, risk-control self-assessments, KRIs, risk acceptance, remediation and control testing | GRC, audit, incidents | Second-line independence and explicit risk owners |
| Compliance and regulatory affairs | Obligation register, regulatory change impact, regulatory reporting preparation, evidence packs, breaches and remediation | Regulatory library, GRC, reporting systems | Human legal/regulatory validation; not a certified reporting engine |
| Internal audit | Audit universe, planning, walkthroughs, evidence requests, findings, issue remediation, closure validation | Audit management, working papers | Third-line independence and segregation from auditees |
| Information security | Access certifications, privileged-access reviews, security incidents, vulnerability remediation, third-party exposures | IAM, SIEM, EDR, ITSM | Least privilege, incident confidentiality, dual-control |
| Technology and IT operations | Outages, change approvals, releases, deployment risk, asset incidents, root-cause analysis, business continuity | ITSM, monitoring, CMDB, DevOps | Fail-safe changes, rollback evidence, service dependencies |
| Branch / retail operations | Cash balancing, teller exceptions, branch complaints, account servicing, account-opening exceptions, branch audits | CBS, CRM, branch systems | Location controls, access boundaries and physical controls |
| Customer service / contact center | Complaints, failed payments, turnaround SLAs, escalations, compensation approvals, feedback closure | CRM, case systems, contact channels | Sensitive-data masking, consent and customer privacy |
| Corporate / commercial banking | Relationship onboarding, service requests, account maintenance, service exceptions, exposure follow-up | CRM, core, LOS | Entity-level permissions, controlled communications |
| Trade finance and correspondent banking | LC/documentary credit checks, discrepancies, guarantees, correspondent queries, sanctions coordination | Trade platform, SWIFT interfaces, documents | Human legal/trade review and sanctions gates |
| Legal / company secretariat | Contract review, litigation holds, subpoenas, legal opinions, board/committee actions, signing workflows | DMS, e-sign, contract systems | Legal privilege, records holds and restricted disclosure |
| Procurement / vendor / facilities | Sourcing, due diligence, purchase approvals, third-party risk reviews, renewals, asset maintenance | ERP, vendor/GRC systems | Conflict-of-interest, budget and vendor controls |
| HR / people operations | Employee onboarding/offboarding, training attestations, leave approvals, HR requests, role changes | HRIS, IAM, training platform | Confidential HR compartment, no broad employee surveillance |
| Executive / board | Institution-wide exposure, unresolved material cases, strategy execution, regulatory remediation oversight, verified value and operational resilience | Aggregated authorized case telemetry and source-backed KPIs | Read-only oversight unless separately granted approval authority |

**Important:** “Bank-wide” means common case/control/workflow infrastructure and the ability to configure or integrate each function. This catalog is **not a declaration that CORTEX currently performs all these workflows**.

## Shared platform objects and services

Create these primitives **once**, used across every bank function:

1. **Institution / entity / organizational structure** — tenant, legal entity, country, line of business, department, branch, cost center, ownership; verified provisioning and secure staff lifecycle.
2. **Identity, entitlements and delegation** — SSO/SAML/OIDC when appropriate, MFA, RBAC+ABAC, maker/checker, temporary delegation, fine-grained data entitlements, scoped guest access, revocation and session controls.
3. **Universal case and issue model** — one immutable ID, type, source, business impact, stage, severity, owner, participants, timelines, related cases, privacy classification, allowed transitions and resolution.
4. **Universal task/inbox** — personal, team and management inboxes; SLAs and calendars, escalations, handoffs, reminders, dependency blockers and substitute assignees.
5. **Durable workflow orchestration** — versioned process definition, human approvals, system events, idempotency, compensating actions, retries, timeouts, dead-letter handling and manual recovery.
6. **Evidence and data lineage** — original references, checksums, ingestion timestamp, data owner, schema, lineage, permission and retention policies; immutable/signed audit receipts and legal hold controls.
7. **Connector / source registry** — approved source, connection owner, health, permissions, field mappings, polling/events, test-to-production promotion, data quality and revocation; no fictional connection statuses.
8. **Institution policy/control engine** — versioned bank-approved policy, obligations, control mapping, approval matrices, thresholds, segregation-of-duties and auditable exceptions.
9. **Bank operating graph** — scoped associations among customers, accounts, transactions, case references, systems, policies, employees, departments and outcomes; never expose unauthorized connections.
10. **AI intelligence layer** — scoped retrieval, deterministic calculations, optional model interpretation, per-answer provenance, refusal/uncertainty states, reviewer feedback, model version and budget controls.
11. **Business event, alert and process telemetry** — durable events, event schema, root-cause linking, recurrence analysis, delayed/cancelled work, notification routing and escalation.
12. **Outcome and verification ledger** — predicted, identified, validated, approved, recorded, realized and independently verified states; source-linked economic effect, reconciliation and sign-off.
13. **Reporting and oversight** — role-based command centers, evidence-backed drill-down, regulatory-ready exports only after validation, data access logs and audit packages.
14. **Operational resilience** — backups/restore drills, disaster recovery, fail-closed startup, workflow replay, incident command, dependency mapping, change and third-party risk management.
15. **Integration governance** — APIs, events/webhooks, file/batch, queue and tightly scoped UI adapters where permitted, with contracts, rate limits, monitoring and risk approvals.
16. **Enterprise tenant lifecycle** — contract/approval, isolated provisioning, setup checklist, data governance, partner approvals, pilot progression, support and secure offboarding/export.

## Operating UX: tasks first, departments second

Do not create 19 permanent top-level dashboards for these domains.

**Core UX:** My Work, Cases & Investigations, CORTEX Intelligence, Source & Evidence, Department Workspaces, Controls & Approvals, Outcomes & Reporting, and institution administration. Keep the current 7-item navigation as the release baseline; any changes require a tested migration and user review.

- **Individual contributor:** My assigned tasks, due dates, case context, evidence, next authorized action.
- **Reviewer/checker:** Approval inbox, policy context, provenance, conflict-of-interest warning, reject/request-changes.
- **Department head:** Team queues, exceptions, bottlenecks, breach forecasts, capacity and handoff history.
- **Risk/compliance/audit:** Independent control, incidents, findings and traceable evidence access.
- **Executive:** Bank-wide exposure, critical issues, remediation ownership and verified outcomes—not synthetic loss counters.
- **Administrator:** Institution setup, teams, permissions, sources, policies, approvals, audit and release safety.

The selected task should bring in context from other departments **without making the user navigate multiple dashboards**. The side navigation is not a mirror of the bank's org chart.

## Differentiation bets (subject to bank discovery)

### One case follows an issue from detection to verified resolution
A candidate settlement fee break should not become an unrelated item in Finance, Operations, Risk, Compliance and Audit. Each function sees its allowed portion of the same case, with independent sign-offs and a source-to-outcome trace.

### Control-aware AI
AI summarizes and recommends within permission scope; deterministic rules calculate money. Before a risky action, the orchestration layer checks the bank's current policy version, maker/checker authority, source quality and approval chain. A human can reject and document why. CORTEX records policy decisions and provenance, not autonomous regulatory compliance claims.

### Process intelligence rather than more charts
From permissioned workflow/event logs, CORTEX can identify recurring delays, frequent handoff loops, recurring exceptions and unused/overloaded capacity. Each insight should link to a specific case or process improvement and a testable outcome.

### Revenue assurance with defensible proofs
Focus on bank-approved fee schedules, transaction lifecycle/settlement exceptions, suspense, failed transfers, disputed reversals and unexplained control differences. Calculate using deterministic source pairs and versioned rules; separately track recovery actually confirmed.

### Nigeria-first operational workflow packs
Design configurable reference templates relevant to Nigerian payment rails, institutions, CBN obligations, NIBSS/processor operations and local calendars, **subject to bank contracts and applicable law**. Do not imply access to CBN/NIBSS systems or certification.

## Illustrative end-to-end interdepartmental case

**Situation:** Authorized reconciliation source pair indicates a possible ₦250,000 settlement-fee discrepancy. This is an illustration, not live data.

1. Source owner authorizes the file/API scope; ingestion validates completeness, checksum, period, mapping and permission.
2. Deterministic comparison computes a **candidate** difference and attaches original source references, rule version and run ID.
3. Operations receives a case in My Work, reviews matching records and assigns a disposition.
4. Finance checks GL/settlement evidence and independently verifies the amount; marked pending if unavailable.
5. Risk/Compliance reviews only if institution policy thresholds or incident conditions require escalation.
6. An authorized checker approves any external claim or corrective instruction; CORTEX does not move funds itself.
7. An external bank system performs any approved financial action (if separately integrated and contractually permitted).
8. Authorized evidence confirms or rejects the final amount; Recorded Outcomes separates claimed and verified figures.
9. Root-cause learning links the case to a recurring control failure and any approved process change.
10. Management sees ownership, ageing, total exposure and separately verified recoveries.

**Single case, separate control lines, no claims without evidence.**

## Deployment, compliance and trust requirements

- Bank-approved deployment choices: private tenant/VPC and deployment models subject to security architecture and cost; don't promise on-prem support until engineered.
- Encryption, key custody, secrets management, access logs, data minimization, masking, retention and lawful basis for processing.
- Align controls and vendor diligence with applicable CBN requirements, Nigerian Data Protection Act and the bank's outsourcing policy. Have qualified bank counsel/compliance validate exact obligations before public compliance claims.
- Independent second-line and third-line review must not be silently replaced by workflow automation.
- Operational resilience: contingency mode, critical-service mapping, backups, tested recovery, change control and incident exercises.
- Financially impactful system changes, transactions, account restrictions, credit decisions and AML dispositions require authoritative bank system controls and human/legal authorization.
- No production banking data in test workspaces or ordinary AI chat; no implicit permission to scrape bank staff activity, customer transactions or privileged records.
- Maintain enterprise evidence for penetration testing, security assurance, privacy assessments, SLAs, incident notification and exit/data portability. No certification claims until independently completed.

## Rollout sequence and gates (capability-driven, not promised dates)

### Phase A — trustworthy institution operating foundation
Controlled institution provisioning; secure roles, team invite/activation, organization hierarchy, role-based work inbox, universal cases and tasks, approval matrix, audit, source registry and onboarding status. One bank can onboard with a documented UAT path. **Current code has only some foundations.**

### Phase B — a financial workflow that pays for itself
Authorized pilot CSV/source pair, mapped deterministic fee/settlement comparison, candidate exception → operations case → finance review → approval → evidence-backed resolution, with measurable reduction in ageing/rework. No synthetic headline losses.

### Phase C — cross-department control fabric
Compliance obligation-to-task mapping, risk/control assessments, internal audit remediation, IT incident/change, customer complaints/disputes and third-party approval routing on common primitives. Integrate with bank-owned systems and prove segregation of duties.

### Phase D — broad bank coverage, adaptive UX
Credit/lending, treasury, trade finance, branch, collections, legal, HR and procurement packs; advanced process intelligence, dependency graph, AI assistants within safe envelopes, regulator-ready validated exports when applicable.

At each phase: threat modeling, integration contracts, permission tests, data-quality tests, bank sponsor approval, human usability evaluation, rollback, and evidence of measurable economic/operational improvement.

## Pilot scorecard (proposed; baselines required)

- Time to controlled institution setup and first productive use.
- Percentage of cross-department cases with clear current owner.
- Median/p95 case resolution time and days in each handoff.
- SLA breaches, rework/duplicate cases, override/rejection frequency.
- Source coverage, age, data quality and provenance completeness.
- Candidate vs validated discrepancies, recorded vs independently verified recoveries.
- Audit sampling time and missing-evidence rate.
- Security and operational assurance: access violations, stale-role revocation, queue replay recovery, tested RTO/RPO.
- Adoption: weekly active authorized users, task completion, pilot-to-production conversions.
- Economic proof: validated hours saved, cost avoided and independently supported value recovered.

Avoid promising ROI or banking-wide replacement until a prospective institution supplies a baseline and a controlled pilot validates measurable improvement.

## Next engineering decision

Before redesigning any more dashboards, build a **single cross-department case/task/approval domain** integrated with the existing organization, session, document, audit, workflow and value services. Then connect one trusted approved financial reconciliation use case as the proving ground. Only after this vertical slice works should we roll out department packs.

## Market/regulatory references for validation, not compliance certification

- Pega banking coverage: https://www.pega.com/industries/financial-services
- ServiceNow Financial Services Operations: https://www.servicenow.com/docs/r/financial-services-operations/exploring-fso-apps.html
- nCino Bank Operating System description: https://marketplace.informatica.com/listings/cloud/solutions/the_ncino_bank_operating_system.html
- Camunda 2026 bank orchestration research: https://page.camunda.com/report-state-of-agentic-orchestration-automation-banking-and-financial-services-camunda
- Basel principles for operational resilience: https://www.bis.org/committees/bcbs/basel-consolidated-guidelines/module/orr/20
- Basel operational risk and three lines of defence: https://www.bis.org/committees/bcbs/basel-consolidated-guidelines/module/orr/10
- CBN payments supervision reference index: https://www.cbn.gov.ng/PaymentsSystem/index.html
