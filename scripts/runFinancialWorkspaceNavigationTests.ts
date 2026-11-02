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
assert.match(reviews, /record\.decision\?\.state === "pending"/);
const reports = load("app/reports/page.tsx");
assert.match(reports, /requiredPermission="case:read"/);
assert.match(reports, /api\/v1\/audit\?limit=25/);
assert.match(reports, /hasPermission\("audit:read"\)/);
assert.match(reports, /not an institution-wide total|not a complete/i);

console.log("PASS: 7 financial operations routes, role-guarded review/reconciliation/report surfaces and no invented executive KPIs");
