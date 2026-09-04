import { chromium } from "playwright";

const baseUrl = (process.env.ASSURANCE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const password = "Stage10Enterprise!2026";
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, work) {
  try {
    await work();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error?.stack || String(error) });
    console.error(`❌ ${name}:`, error);
  }
}

async function browserLogin(page, identifier) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#apex-login-screen", { state: "visible", timeout: 15_000 });
  await page.fill("#login-identifier", identifier);
  await page.fill("#login-password", password);
  await page.click("#login-submit");
  await page.waitForSelector("#apex-authenticated-shell", { state: "visible", timeout: 15_000 });
}

const browser = await chromium.launch({ headless: true });
try {
  let ceoContext;
  let ceoPage;

  await check("0. unauthenticated root redirects to the secure APEX ONE login without business data", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 15_000 });
      await page.waitForSelector("#apex-login-screen", { state: "visible", timeout: 15_000 });
      const text = await page.locator("body").innerText();
      assert(text.includes("Sign in to APEX ONE"), "Unauthenticated root did not reach the APEX ONE login");
      assert(!text.includes("APEX CONNECT"), "Unauthenticated root leaked the retired client portal");
      assert(!text.includes("Welcome back"), "Unauthenticated root leaked a hard-coded user greeting");
      assert(!text.includes("$10.48M"), "Unauthenticated root leaked a fabricated wealth balance");
      assert((await page.locator("#apex-authenticated-shell").count()) === 0, "Unauthenticated browser rendered the enterprise shell");
    } finally {
      await context.close();
    }
  });

  await check("0a. login form reports invalid credentials without revealing account status", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      await page.fill("#login-identifier", "stage10.ceo@example.test");
      await page.fill("#login-password", `${password}-invalid`);
      await page.click("#login-submit");
      const alert = page.locator('[role="alert"]');
      await alert.waitFor({ state: "visible", timeout: 15_000 });
      const message = await alert.innerText();
      assert(message.includes("incorrect") || message.includes("unavailable"), "Invalid login disclosed an unexpected account-specific state");
      assert((await page.locator("#apex-authenticated-shell").count()) === 0, "Invalid login entered the enterprise shell");
    } finally {
      await context.close();
    }
  });

  await check("1. browser stores hardened HttpOnly session while JavaScript cannot read it", async () => {
    ceoContext = await browser.newContext();
    ceoPage = await ceoContext.newPage();
    await browserLogin(ceoPage, "stage10.ceo@example.test");
    const cookies = await ceoContext.cookies(baseUrl);
    const session = cookies.find((cookie) => cookie.name === "apex_session");
    assert(session, "Browser did not retain apex_session");
    assert(session.httpOnly === true, "Browser session is not HttpOnly");
    assert(session.secure === true, "Browser session is not Secure on the production-built server");
    assert(session.sameSite === "Lax", `Unexpected SameSite value: ${String(session.sameSite)}`);
    const visibleCookies = await ceoPage.evaluate(() => document.cookie);
    assert(!visibleCookies.includes("apex_session"), "HttpOnly session leaked through document.cookie");
  });

  await check("2. CEO browser session renders org:admin privileged settings surface", async () => {
    await ceoPage.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    await ceoPage.waitForSelector("#organizational-control-center", { state: "visible", timeout: 15_000 });
    const text = await ceoPage.locator("body").innerText();
    assert(text.includes("Settings & Integrations"), "CEO did not receive privileged settings workspace");
  });

  await check("3. Relationship Manager browser session is denied the org:admin UI surface", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await browserLogin(page, "stage10.rm@example.test");
      await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.body.innerText.includes("does not include the capability required"),
        undefined,
        { timeout: 15_000 }
      );
      assert((await page.locator("#organizational-control-center").count()) === 0, "Relationship Manager rendered org:admin controls");
    } finally {
      await context.close();
    }
  });

  await check("4. browser-side API calls cannot bypass backend RBAC", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await browserLogin(page, "stage10.rm@example.test");
      const status = await page.evaluate(async () => (await fetch("/api/v1/audit")).status);
      assert(status === 403, `Expected browser audit request 403, received ${status}`);
    } finally {
      await context.close();
    }
  });

  await check("5. logout clears the browser session and privileged UI fails closed", async () => {
    const status = await ceoPage.evaluate(async () => (await fetch("/api/v1/auth/logout", { method: "POST" })).status);
    assert(status === 200, `Browser logout failed with HTTP ${status}`);
    const cookies = await ceoContext.cookies(baseUrl);
    assert(!cookies.some((cookie) => cookie.name === "apex_session"), "Logout did not clear apex_session");
    await ceoPage.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    await ceoPage.waitForURL((url) => url.pathname === "/login", { timeout: 15_000 });
    await ceoPage.waitForSelector("#apex-login-screen", { state: "visible", timeout: 15_000 });
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 10 BROWSER AUTH / RBAC ASSURANCE");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
