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
  rootPage.includes("apex-one-executive-command-center"),
  "Root page must identify the APEX ONE Executive Command Center."
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
  console.error("APEX ONE — PRODUCT INTEGRITY GATE FAILED");
  for (const failure of failures) console.error(`❌ ${failure}`);
  process.exit(1);
}

console.log("APEX ONE — PRODUCT INTEGRITY GATE PASSED");
console.log(`Checked ${productionUiFiles.length} production-facing source files.`);
console.log("✅ Unauthenticated root fails closed");
console.log("✅ No private-wealth/client-portal fallback");
console.log("✅ Navigation is capability-derived");
console.log("✅ Known prototype identities/products are absent from production UI source");
console.log("✅ Shared value engine contains no simulated execution mutations");
