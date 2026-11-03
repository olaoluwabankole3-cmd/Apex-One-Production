/** Sprint-one product gate: seven real authorized task destinations, no fake money dashboards. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { primaryNavigation, isNavigationItemActive } from "../components/layout/navigation";

const load = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const expected = [
  "/", "/reconciliation", "/work/cases", "/reviews", "/documents", "/reports", "/settings",
];
assert.deepEqual(primaryNavigation.map(item => item.href), expected);
assert.equal(new Set(primaryNavigation.map(item => item.href)).size, 7);
for (const item of primaryNavigation) {
  assert(item.permission.length > 0, item.href);
  const route = item.href === "/" ? "app/page.tsx" : `app${item.href}/page.tsx`;
  assert(load(route).length > 100, `Missing route: ${route}`);
  assert(isNavigationItemActive(item.href, item.href));
}
assert.equal(isNavigationItemActive("/reviews", "/work/cases"), false);
assert.equal(isNavigationItemActive("/work/cases", "/reviews"), false);
assert.equal(isNavigationItemActive("/reports", "/"), false);
assert.equal(isNavigationItemActive("/", "/"), true);

const overview = load("app/page.tsx");
assert.match(overview, /api\/v1\/banking-cases\?limit=5/);
const authenticatedShell = load("components/layout/AppShell.tsx");
assert(authenticatedShell.includes("{children}"), "Authenticated shell must render the actual route");
assert(!authenticatedShell.includes('pathname === "/" ?'),
  "Do not replace the banking overview with an old welcome component");
assert(!authenticatedShell.includes("CortexWelcome"),
  "Legacy knowledge/AI welcome screen must not replace financial operations home");
for (const route of ["/reconciliation", "/work/cases", "/documents", "/reviews", "/reports"]) {
  assert(overview.includes('href: "' + route + '"'), "Missing banking task entry: " + route);
}
assert(overview.indexOf('href: "/documents"') < overview.indexOf('href: "/reviews"'),
  "Authorized evidence inspection must precede independent plan review");
assert(overview.includes("const allowedJourneys = journeys.filter(item => hasPermission(item.permission))"),
  "Home task actions must be filtered by the authenticated role");
assert.match(overview, /not an institution-wide total/);
assert(overview.includes('id="cortex-my-work"'), "Home must show work needing attention");
assert(overview.includes('<BankingTaskWorkspace />'),
  "Home must show the same bounded, authenticated My Tasks and Waiting on Others work queues");
assert(overview.indexOf('<BankingTaskWorkspace />') < overview.indexOf('id="cortex-my-work"'),
  "Actual assigned work must appear ahead of the case and specialist lists");
const taskWorkspace = load("components/banking-cases/BankingTaskWorkspace.tsx");
assert(taskWorkspace.includes('view=received&limit=25') &&
  taskWorkspace.includes('view=requested&limit=25') &&
  taskWorkspace.includes('view=team&limit=25'),
  "Home task workspace must use only the server-scoped received/requested/team queues");
assert(taskWorkspace.includes('id="cortex-department-team-queue"'),
  "Explicit department-shared requests need a dedicated Team Queue");
assert(taskWorkspace.includes('deliveryMode === "department"'),
  "Department-sharing must be an explicit choice, not implicit on every task");
const teamTaskRoute = load("app/api/v1/banking-tasks/route.ts");
assert(teamTaskRoute.includes('view !== "team"') &&
  teamTaskRoute.includes('"deliveryMode"') && teamTaskRoute.includes('"targetDepartment"'),
  "Team work must be a validated, authenticated server API, not client-side global aggregation");
const teamTaskService = load("lib/backend/domains/banking-tasks/bankingWorkTaskService.ts");
assert(teamTaskService.includes("claimUnassignedBankingTask"),
  "Claiming a department task must use the atomic tenant-bound persistence operation");
assert(taskWorkspace.includes('A named employee can help on a specific request'),
  "Task inbox must distinguish subtask responsibility from case ownership");
assert(overview.indexOf('id="cortex-my-work"') < overview.indexOf('aria-labelledby="cortex-start-heading"'),
  "My Work must appear ahead of the workspace/tool menu");
assert(overview.includes("describeCaseAttention(item"), "Case list must derive truthful next actions");
const caseDetail = load("components/banking-cases/BankingCaseReviewPanel.tsx");
assert(caseDetail.includes("Outcome checkpoint"), "Case investigations must show the missing outcome checkpoint");
assert(caseDetail.includes("No authoritative outcome-confirmation feed"),
  "Case detail must disclose that real outcome verification is not yet available");
for (const obsolete of ["RevenueChart", "KpiGrid", "PortfolioBreakdown", "ExecutiveSummary"]) {
  assert(!overview.includes(obsolete), `Obsolete or unverified dashboard item: ${obsolete}`);
}
assert.match(overview, /No cases are visible|No cases currently/);
assert.match(overview, /financial loss|Financial loss|financial conclusion/i);

const reconciliation = load("app/reconciliation/page.tsx");
assert.match(reconciliation, /api\/v1\/reconciliation\/preview/);
assert.match(reconciliation, /synthetic/i);
assert.match(reconciliation, /requiredPermission="financial:read"/);
assert(!reconciliation.includes("bankVerified: true"));
const previewRoute = load("app/api/v1/reconciliation/preview/route.ts");
assert.match(previewRoute, /APEX_DEPLOYMENT_ENVIRONMENT !== "staging"/);
assert.match(previewRoute, /CORTEX_FINANCIAL_PREVIEW_ENABLED !== "true"/);

const reviews = load("app/reviews/page.tsx");
assert.match(reviews, /requiredPermission="case:approve"/);
assert.match(reviews, /BankingCaseReviewPanel/);
assert.match(reviews, /item\.decision\?\.state === "pending"/);
assert.match(reviews, /encodeURIComponent\(nextCursor\)/,
  "Review pagination must URL-encode server-issued cursors");
assert.match(reviews, /setCases\(previous => nextCursor/,
  "Later review pages must append rather than replace authorized cases");
assert.match(reviews, /existing\.id === item\.id/,
  "Review pagination must suppress duplicate cases across pages");
assert.match(reviews, /Load next 50 cases/,
  "The checker must be able to reach pending plans beyond the first page");
assert.match(reviews, /if \(nextCursor\) \{[\s\S]*?setPageError\(true\)/,
  "Failure loading another page must preserve cases already inspected");
const casesWorkspace = load("app/work/cases/page.tsx");
assert(casesWorkspace.includes('assignees && item.decision?.state !== "pending"'),
  "Case reassignment must be hidden while checker review locks ownership");
assert(casesWorkspace.includes("Independent checker review is pending. Ownership and evidence are locked"),
  "Operators must understand why reassignment and evidence edits are unavailable");
const reports = load("app/reports/page.tsx");
assert.match(reports, /requiredPermission="case:read"/);
assert.match(reports, /api\/v1\/audit\?limit=25/);
assert.match(reports, /hasPermission\("audit:read"\)/);
assert.match(reports, /not an institution-wide total|not a complete/i);

console.log("PASS: 7 financial operations routes, role-guarded review/reconciliation/report surfaces and no invented executive KPIs");
