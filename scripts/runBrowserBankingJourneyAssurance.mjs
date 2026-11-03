/**
 * CORTEX — real Chromium / HTTP financial operations golden-path assurance.
 *
 * Runs ONLY with the disposable Stage 10 PostgreSQL/Redis/LocalStack fixture.
 * Never run against AWS staging, production, or an institution's live data.
 * Existing standalone browser auth tests run separately before this suite.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.ASSURANCE_BASE_URL;
if (process.env.CI !== "true" ||
    baseUrl !== "http://localhost:3000" ||
    process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging" ||
    process.env.CORTEX_FINANCIAL_PREVIEW_ENABLED !== "true" ||
    process.env.TEST_ENV !== "true") {
  throw new Error("CORTEX browser banking UAT is permitted only on isolated, opted-in local Stage 10 CI fixtures");
}

const PASSWORD = "Stage10Enterprise!2026";
const id = (role) => `stage10.${role}@example.test`;
const HEAD = "reference,currency,amount_minor,record_id,recorded_at\n";
const expected = HEAD + "SYN-UAT-SETTLEMENT-001,NGN,12500,synthetic-ledger-001,2026-11-02T09:00:00Z\n";
const observed = HEAD + "SYN-UAT-SETTLEMENT-001,NGN,12400,synthetic-provider-001,2026-11-02T09:01:00Z\n";

const browser = await chromium.launch({ headless: true });
const contexts = [];
async function login(role) {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#apex-login-screen").waitFor({ state: "visible" });
  await page.fill("#login-identifier", id(role));
  await page.fill("#login-password", PASSWORD);
  await page.click("#login-submit");
  await page.locator("#apex-authenticated-shell").waitFor({ state: "visible", timeout: 20000 });
  const session = await request(page, "GET", "/api/v1/auth/me");
  assert.equal(session.status, 200, role + " session");
  assert.equal(session.body?.user?.email, id(role), "Correct role browser identity");
  return page;
}
async function request(page, method, path, payload) {
  return page.evaluate(async ({ method, path, payload }) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: payload === undefined ? {} : { "Content-Type": "application/json" },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    return { status: response.status, body: await response.json() };
  }, { method, path, payload });
}
function ok(response, status, step) {
  assert.equal(response.status, status, step + ": HTTP status " +
    response.status + " body=" + JSON.stringify(response.body?.error?.code || null));
  assert.equal(response.body?.success, true, step + ": unexpected response envelope");
  return response.body.data;
}
function denied(response, statuses, step) {
  assert(statuses.includes(response.status), step + ": expected denial, got " + response.status);
  assert.equal(response.body?.success, false, step + ": must be a failure envelope");
}
function report(label) { console.log("PASS: " + label); }

try {
  const anon = await browser.newContext();
  contexts.push(anon);
  const anonymous = await anon.newPage();
  await anonymous.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  denied(await request(anonymous, "POST", "/api/v1/reconciliation/preview", {
    kind: "settlement",
    expected: { feedId: "expected", csv: expected },
    observed: { feedId: "observed", csv: observed },
  }), [401], "anonymous preview blocked");
  denied(await request(anonymous, "GET", "/api/v1/banking-cases?limit=1"),
    [401], "anonymous case data blocked");
  report("anonymous preview and banking case endpoints reject unauthenticated browsers");

  const finance = await login("finance");
  const ops = await login("operations");
  const checker = await login("checker");
  report("three distinct HttpOnly-authenticated Finance, Operations and checker browser sessions");

  await finance.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await finance.locator("#cortex-financial-operations-overview").waitFor({ state: "visible" });
  assert.equal(await finance.getByRole("link", { name: /Review reconciliation/ }).count(), 1);
  assert.equal(await finance.getByRole("link", { name: /Make a review decision/ }).count(), 0);
  await finance.goto(`${baseUrl}/reconciliation`, { waitUntil: "domcontentloaded" });
  await finance.locator("#cortex-reconciliation-workspace").waitFor({ state: "visible" });
  await finance.getByRole("button", { name: "Load synthetic example" }).click();
  await finance.getByRole("button", { name: "Run preview comparison" }).click();
  await finance.getByText("PREVIEW RESULTS · UNVERIFIED").waitFor({ state: "visible", timeout: 20000 });
  const financeResponse = await request(finance, "POST", "/api/v1/reconciliation/preview", {
    kind: "settlement",
    expected: { feedId: "synthetic-uatrecon-ledger", csv: expected },
    observed: { feedId: "synthetic-uatrecon-provider", csv: observed },
  });
  const preview = ok(financeResponse, 200, "Finance preview");
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.sourceStored, false);
  assert.equal(preview.reconciliation.financialLossAssessed, false);
  assert.equal(preview.reconciliation.cases[0].comparisonStatus, "amount_discrepancy");
  denied(await request(finance, "GET", "/api/v1/audit?limit=1"), [403], "Finance audit denial");
  report("Finance compares provisional synthetic CSV, cannot see checker-only reports or audit, and no loss is certified");

  await ops.goto(`${baseUrl}/work/cases?draft=settlement.amount_discrepancy`, { waitUntil: "domcontentloaded" });
  await ops.locator("#cortex-case-create-form").waitFor({ state: "visible", timeout: 20000 });
  assert((await ops.locator("#cortex-case-create-form").innerText()).includes("classification only"));
  await ops.getByRole("button", { name: "Create case", exact: true }).click();
  await ops.getByText("Investigation recorded as open and unverified.", { exact: false })
    .waitFor({ state: "visible", timeout: 20000 });
  const opsCases = ok(await request(ops, "GET", "/api/v1/banking-cases?limit=25"), 200, "Operations cases");
  assert(Array.isArray(opsCases));
  const created = opsCases.find((item) => item.title === "Investigate settlement preview: amount difference");
  assert(created, "Classification-only case must be explicitly created by Operations");
  assert.equal(created.ownerUserId, "user-stage10-operations");
  assert.equal(created.evidenceState, "unverified");
  assert.equal(created.previewOrigin, undefined);
  assert.equal(created.sourceId, undefined);
  report("Operations manually creates an unverified case from classification-only draft; no source is transferred");

  // Real UI: request a narrow Finance task while Operations retains the case.
  const taskTitle = "Inspect synthetic settlement support question";
  const requestTask = ops.getByRole("button", { name: "Request department task" });
  await requestTask.waitFor({ state: "visible", timeout: 20000 });
  await requestTask.click();
  const taskForm = ops.getByRole("region", { name: "Cross-department task request" });
  await taskForm.getByLabel("Named recipient").selectOption("user-stage10-finance");
  await taskForm.getByLabel("Task title").fill(taskTitle);
  await taskForm.getByLabel("Specific question (no confidential account details)")
    .fill("Please check which approved source metadata would be required for this synthetic exception.");
  await taskForm.getByLabel("Expected response or proof")
    .fill("Report what internal source validation remains necessary without certifying posting.");
  await taskForm.getByRole("button", { name: "Send task request" }).click();
  await ops.getByText("Task requested. The case owner remains unchanged", { exact: false })
    .waitFor({ state: "visible", timeout: 20000 });
  const parentBeforeHandoff = ok(await request(ops, "GET", `/api/v1/banking-cases/${created.id}`),
    200, "Task does not transfer parent case");
  assert.equal(parentBeforeHandoff.ownerUserId, "user-stage10-operations");

  await finance.goto(`${baseUrl}/work/cases`, { waitUntil: "domcontentloaded" });
  await finance.locator("#cortex-banking-task-workspace").waitFor({ state: "visible" });
  await finance.getByText(taskTitle, { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  denied(await request(finance, "GET", `/api/v1/banking-cases/${created.id}`),
    [404], "Finance task assignee cannot read original confidential case");
  await finance.getByRole("button", { name: "Accept task" }).click();
  await finance.getByRole("button", { name: "Record response", exact: true })
    .waitFor({ state: "visible", timeout: 20000 });
  await finance.getByRole("button", { name: "Record response", exact: true }).click();
  const taskResponse = "This is synthetic only; no authentic external settlement posting can be inferred from these records.";
  await finance.getByRole("textbox", { name: "Your response" }).fill(taskResponse);
  await finance.getByRole("button", { name: "Record response", exact: true }).last().click();
  await finance.getByText("Task response recorded", { exact: false })
    .waitFor({ state: "visible", timeout: 20000 });

  await ops.goto(`${baseUrl}/work/cases`, { waitUntil: "domcontentloaded" });
  await ops.getByText(taskResponse, { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  const taskList = ok(await request(ops, "GET", "/api/v1/banking-tasks?view=requested&limit=25"),
    200, "Task requester scoped queue");
  const finishedTask = taskList.find(x => x.title === taskTitle);
  assert(finishedTask && finishedTask.status === "responded");
  assert.equal(finishedTask.financialOutcomeVerified, false);
  report("real browser: Operations requests Finance task without case transfer; recipient accepts/responds; original owner sees result but outcome stays unverified");

  const handoff = ok(await request(ops, "POST", `/api/v1/banking-cases/${created.id}/handoff`, {
    recipientUserId: "user-stage10-finance",
    expectedRevision: created.revision,
    reason: "Finance must independently inspect the synthetic source review question",
  }), 200, "Operations handoff");
  assert.equal(handoff.department, "Finance");
  assert.equal(handoff.ownerUserId, "user-stage10-finance");
  denied(await request(ops, "GET", `/api/v1/banking-cases/${created.id}`),
    [404], "Former case owner denied");
  report("Operations to Finance handoff enforces single ownership and hides case from former maker");

  const link = ok(await request(finance, "POST", `/api/v1/banking-cases/${created.id}/evidence`, {
    sourceType: "Document",
    sourceId: "doc-stage10-banking-evidence",
    note: "Synthetic reference only; independently validate any asserted source facts",
    expectedRevision: handoff.revision,
  }), 200, "Finance evidence reference");
  assert.equal(link.evidenceLinks.length, 1);
  assert.equal(link.evidenceState, "unverified");

  const proposal = ok(await request(finance, "POST", `/api/v1/banking-cases/${created.id}/proposal`, {
    disposition: "request_source_review",
    rationale: "Request independent authentication of any alleged source records and do not certify a loss",
    expectedRevision: link.revision,
  }), 200, "Finance investigation plan proposal");
  assert.equal(proposal.decision.state, "pending");
  denied(await request(finance, "POST", `/api/v1/banking-cases/${created.id}/decision`, {
    decisionId: proposal.decision.id,
    verdict: "approved",
    note: "Maker must be forbidden from checking an own proposal",
    expectedRevision: proposal.revision,
  }), [403], "Maker-checker separation");
  denied(await request(finance, "POST", `/api/v1/banking-cases/${created.id}/handoff`, {
    recipientUserId: "user-stage10-operations",
    expectedRevision: proposal.revision,
    reason: "Pending review must lock ownership against transfer",
  }), [409], "Pending handoff lock");
  report("Finance links only existing synthetic metadata, proposes review, cannot self-approve or reassign locked case");

  await checker.goto(`${baseUrl}/reviews`, { waitUntil: "domcontentloaded" });
  await checker.locator("#cortex-independent-reviews").waitFor({ state: "visible" });
  await checker.getByText(created.title, { exact: true }).waitFor({ state: "visible", timeout: 20000 });
  const reviewCard = checker.locator("article").filter({ hasText: created.title });
  await reviewCard.getByRole("button", { name: "Inspect evidence and review" }).click();
  await reviewCard.getByRole("textbox", { name: "Independent checker note" }).fill(
    "Approve internal source inspection only, not cash movement or financial findings"
  );
  await reviewCard.getByRole("button", { name: "Approve internal plan" }).click();
  await checker.getByText("No pending plans found in the visible case records", { exact: false })
    .waitFor({ state: "visible", timeout: 20000 });
  const finalList = ok(await request(checker, "GET", "/api/v1/banking-cases?limit=50"), 200, "Checker cases");
  const final = finalList.find((item) => item.id === created.id);
  assert(final, "Final approved case must remain visible to Administrator");
  assert.equal(final.decision.state, "approved");
  assert.equal(final.decision.reviewedByUserId, "user-stage10-checker");
  assert.equal(final.status, "open");
  assert.equal(final.evidenceState, "unverified");
  assert.deepEqual(final.timeline.map((item) => item.type), [
    "created", "handed_off", "evidence_linked", "decision_proposed", "decision_reviewed",
  ]);
  denied(await request(checker, "POST", `/api/v1/banking-cases/${created.id}/decision`, {
    decisionId: proposal.decision.id,
    verdict: "approved",
    note: "Repeat attempt must never create a second approval",
    expectedRevision: final.revision,
  }), [409], "Duplicate review");
  report("independent checker approves through real Reviews UI; case stays open/unverified, duplicate review rejected");
  await checker.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await checker.locator("#cortex-my-work").waitFor({ state: "visible", timeout: 20000 });
  const workRow = checker.locator("#cortex-my-work a").filter({ hasText: created.title });
  await workRow.getByText("Plan approved · outcome unconfirmed", { exact: true })
    .waitFor({ state: "visible", timeout: 20000 });
  assert((await workRow.innerText()).includes("Obtain independent confirmation"));
  assert((await workRow.innerText()).includes("Outcome not confirmed"));
  report("real browser shows approved plan still requires outcome proof; no fabricated final resolution");


  const audits = ok(await request(checker, "GET", "/api/v1/audit?limit=100"), 200, "Authorized audit");
  const events = audits.filter((event) => event.resourceId === created.id);
  for (const action of [
    "banking_case:create", "banking_case:handoff", "banking_case:evidence_linked",
    "banking_case:decision_proposed", "banking_case:decision_reviewed",
  ]) {
    assert(events.some((event) => event.action === action), "Missing auditable action: " + action);
  }
  report("checker reads durable audit trail, with all five state transitions recorded");

  console.log("CORTEX STAGE 10 HTTP BROWSER BANKING UAT: ALL CHECKS PASSED (isolated synthetic data)");
} finally {
  await Promise.allSettled(contexts.map((ctx) => ctx.close()));
  await browser.close();
}
