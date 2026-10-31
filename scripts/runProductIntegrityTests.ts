import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function collectSourceFiles(directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const full = join(absolute, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(relative(root, full)));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const productionUiFiles = [
  ...collectSourceFiles("app"),
  ...collectSourceFiles("components"),
  ...collectSourceFiles("lib/data/repositories"),
];

// Product identity is a release contract, not a cosmetic string.
const legacyBrandTerms = ["APEX ONE", "Apex One", "Apex Sync", "APEX SYNC"];
for (const file of productionUiFiles) {
  const source = readFileSync(file, "utf8");
  for (const legacy of legacyBrandTerms) {
    assert(!source.includes(legacy), `${relative(root, file)} still exposes legacy product identity: ${legacy}`);
  }
}

for (const path of [
  "lib/organizationConfig.ts",
  "lib/backend/domains/ai/aiOrchestratorService.ts",
  "metadata.json",
  "README.md",
]) {
  const source = readFileSync(join(root, path), "utf8");
  assert(source.includes("CORTEX"), `${path} does not identify the current CORTEX product`);
  for (const legacy of legacyBrandTerms) {
    assert(!source.includes(legacy), `${path} still identifies the retired brand: ${legacy}`);
  }
}

const bannedProductionUiTerms = [
  "APEX CONNECT",
  "ApexConnectDashboard",
  "CANARY POINT OS",
  "Canary Point Logo",
  "Olaoluwa Bankole",
  "Elena Cho",
  "High-Yield Custody Note",
  "Prime Real Estate Bond",
  "Private Wealth Managed Fund",
  "Sovereign Ledger",
  "canarypoint.com/ref",
  "Customer Portal",
];

for (const file of productionUiFiles) {
  const source = readFileSync(file, "utf8");
  for (const banned of bannedProductionUiTerms) {
    if (source.includes(banned)) {
      failures.push(`${relative(root, file)} contains prohibited prototype/product-drift term: ${banned}`);
    }
  }
}

assert(
  !existsSync(join(root, "components/dashboard/ApexConnectDashboard.tsx")),
  "The quarantined wealth/private-client dashboard must not exist in the production component tree."
);

const rootPage = readFileSync(join(root, "app/page.tsx"), "utf8");
assert(!rootPage.includes("ApexConnectDashboard"), "Root page must never route to a client/wealth portal fallback.");
assert(
  rootPage.includes("cortex-executive-command-center"),
  "Root page must identify the CORTEX Executive Command Center."
);

const shell = readFileSync(join(root, "components/layout/AppShell.tsx"), "utf8");
assert(shell.includes("apex-authentication-required"), "AppShell must expose an unauthenticated fail-closed state.");
assert(shell.includes('!isAuthenticated'), "AppShell must check authenticated session state before rendering enterprise UI.");
assert(shell.includes('!hasPermission("org:read")'), "AppShell must require internal org:read capability.");
assert(
  shell.indexOf('!isAuthenticated') < shell.indexOf('id="apex-authenticated-shell"'),
  "Authentication denial must occur before the authenticated application shell."
);

for (const navigationFile of ["components/layout/Sidebar.tsx", "components/layout/Topbar.tsx"]) {
  const source = readFileSync(join(root, navigationFile), "utf8");
  assert(!source.includes("useRole"), `${navigationFile} must not use presentation role state as navigation authority.`);
  assert(source.includes("hasPermission"), `${navigationFile} must derive visibility from authenticated capabilities.`);
}

// Financial-institution release surface: keep the seven core journeys
// visible and retire unsupported/duplicate standalone screens.
const navigation = readFileSync(join(root, "components/layout/navigation.ts"), "utf8");
const primaryDestinations = [
  ...navigation.matchAll(/\{ href: "([^"]+)", label: "([^"]+)", icon:/g),
].map((match) => [match[1], match[2]]);
const expectedDestinations = [
  ["/", "Command Center"],
  ["/ai-workspace", "CORTEX Intelligence"],
  ["/knowledge-hub", "Institutional Memory"],
  ["/documents", "Documents & Evidence"],
  ["/value-intelligence", "Value & Risk"],
  ["/workflows", "Action Center"],
  ["/value-intelligence/captured", "Recorded Outcomes"],
];
assert(
  JSON.stringify(primaryDestinations) === JSON.stringify(expectedDestinations),
  "Financial-institution primary navigation must contain only the seven reviewed intelligence journeys."
);
assert(
  !navigation.includes("valueNavigation"),
  "Duplicate Value Intelligence sidebar menu must not return."
);
assert(
  navigation.includes('permission: "org:read"') &&
    navigation.includes('permission: "value:read"') &&
    navigation.includes('permission: "workflow:read"'),
  "Financial navigation must preserve session-derived capability requirements."
);
for (const path of ["components/layout/Sidebar.tsx", "components/layout/Topbar.tsx"]) {
  assert(
    !readFileSync(join(root, path), "utf8").includes("valueNavigation"),
    `${path} still renders the retired duplicate navigation section.`
  );
}

const accountMenu = readFileSync(join(root, "components/auth/UserMenu.tsx"), "utf8");
assert(
  accountMenu.includes('hasPermission("org:admin")') &&
    accountMenu.includes('href="/settings"'),
  "Admin-only organization settings must remain discoverable through the account menu."
);

const retiredPages: Record<string, string> = {
  "app/analytics/page.tsx": "/value-intelligence",
  "app/calendar/page.tsx": "/workflows",
  "app/operations/page.tsx": "/value-intelligence",
  "app/value-intelligence/ai-analyst/page.tsx": "/ai-workspace",
  "app/value-intelligence/capacity/page.tsx": "/value-intelligence",
  "app/value-intelligence/customer/page.tsx": "/customers",
  "app/value-intelligence/simulator/page.tsx": "/value-intelligence",
  "app/value-intelligence/reports/page.tsx": "/value-intelligence/captured",
  "app/value-intelligence/execution/page.tsx": "/workflows",
};
for (const [route, destination] of Object.entries(retiredPages)) {
  const source = readFileSync(join(root, route), "utf8");
  assert(
    source.includes('import { redirect } from "next/navigation"') &&
      source.includes(`redirect("${destination}")`),
    `${route} must redirect to a reviewed, authorization-gated destination.`
  );
  assert(
    !source.includes('"use client"') && !source.includes("setTimeout") &&
      !source.includes("isDemoMode") && !source.includes("fetch("),
    `${route} still contains a standalone prototype or simulated UI.`
  );
}
const financialValueHub = readFileSync(join(root, "app/value-intelligence/page.tsx"), "utf8");
assert(
  financialValueHub.includes("/value-intelligence/leakage") &&
    financialValueHub.includes("/value-intelligence/opportunities") &&
    financialValueHub.includes("/value-intelligence/captured") &&
    financialValueHub.includes('hasPermission(item.permission)'),
  "Financial value hub must retain evidence-aware investigations with permission checks."
);

const demoMode = readFileSync(join(root, "lib/demo.ts"), "utf8");
assert(
  /export function isDemoMode\(\): boolean \{\s*return false;\s*\}/m.test(demoMode),
  "Frontend demo mode must remain hard-disabled while product integrity recovery is active."
);

const valueEngine = readFileSync(join(root, "components/value-engine/ValueEngineContext.tsx"), "utf8");
for (const simulatedMarker of [
  "REDUNDANT WEST AFRICA EDGE SERVERS",
  "Value Capture Play EXECUTED successfully",
  "Establishing secure API tunnel",
  "APEX automation",
]) {
  assert(!valueEngine.includes(simulatedMarker), `Value engine still contains simulated execution marker: ${simulatedMarker}`);
}

if (failures.length > 0) {
  console.error("CORTEX — PRODUCT INTEGRITY GATE FAILED");
  for (const failure of failures) console.error(`❌ ${failure}`);
  process.exit(1);
}

console.log("CORTEX — PRODUCT INTEGRITY GATE PASSED");
console.log(`Checked ${productionUiFiles.length} production-facing source files.`);
console.log("✅ Unauthenticated root fails closed");
console.log("✅ No private-wealth/client-portal fallback");
console.log("✅ Navigation is capability-derived");
console.log("✅ Known prototype identities/products are absent from production UI source");
console.log("✅ Shared value engine contains no simulated execution mutations");
