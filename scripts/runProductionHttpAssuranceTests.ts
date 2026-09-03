interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: CheckResult[] = [];
const baseUrl = (process.env.ASSURANCE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = "Stage10Enterprise!2026";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

async function jsonRequest(
  path: string,
  init: RequestInit = {},
  cookie?: string
): Promise<{ response: Response; body: any }> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  const text = await response.text();
  let body: any = undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function login(email: string): Promise<{ cookie: string; setCookie: string; body: any }> {
  const { response, body } = await jsonRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login failed for ${email}: HTTP ${response.status}`);
  const setCookie = response.headers.get("set-cookie") || "";
  assert(setCookie.toLowerCase().includes("apex_session="), "Login did not set apex_session cookie");
  return { cookie: setCookie.split(";", 1)[0], setCookie, body };
}

async function main(): Promise<void> {
  let ceoCookie = "";
  let rmCookie = "";
  let knowledgeId = "";

  await check("1. liveness endpoint answers independently of authentication", async () => {
    const { response, body } = await jsonRequest("/api/v1/health");
    assert(response.status === 200, `Expected liveness 200, received ${response.status}`);
    assert(body?.status === "healthy", "Liveness payload did not report healthy");
  });

  await check("2. active readiness proves durable authorities before traffic assurance", async () => {
    const { response, body } = await jsonRequest("/api/v1/health/ready");
    assert(response.status === 200, `Expected readiness 200, received ${response.status}`);
    assert(body?.status === "ready", "Readiness payload did not report ready");
    assert(Array.isArray(body?.checks), "Readiness checks are missing");
    assert(body.checks.every((item: any) => item.state !== "unavailable"), "At least one readiness authority is unavailable");
    assert(response.headers.get("cache-control")?.includes("no-store"), "Readiness response must not be cached");
  });

  await check("3. protected HTTP API rejects unauthenticated requests", async () => {
    const { response } = await jsonRequest("/api/v1/customers");
    assert(response.status === 401, `Expected unauthenticated customers request to return 401, received ${response.status}`);
  });

  await check("4. invalid credentials fail without creating a session", async () => {
    const { response } = await jsonRequest("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "stage10.ceo@example.test", password: "not-the-password" }),
    });
    assert(response.status === 401, `Expected invalid login 401, received ${response.status}`);
    assert(!response.headers.get("set-cookie")?.includes("apex_session="), "Invalid login unexpectedly created a session cookie");
  });

  await check("5. CEO login emits hardened HttpOnly browser session metadata", async () => {
    const loginResult = await login("stage10.ceo@example.test");
    ceoCookie = loginResult.cookie;
    const cookie = loginResult.setCookie.toLowerCase();
    assert(cookie.includes("httponly"), "Session cookie is not HttpOnly");
    assert(cookie.includes("secure"), "Production-built server session cookie is not Secure");
    assert(cookie.includes("samesite=lax"), "Session cookie does not enforce SameSite=Lax");
    assert(!JSON.stringify(loginResult.body).includes("apex_sec"), "Raw session token leaked into login JSON");
  });

  await check("6. authenticated session hydrates authoritative role and permission metadata", async () => {
    const { response, body } = await jsonRequest("/api/v1/auth/me", {}, ceoCookie);
    assert(response.status === 200, `Expected /auth/me 200, received ${response.status}`);
    const session = body?.data ?? body;
    assert(session?.user?.role === "CEO", `Unexpected hydrated role: ${String(session?.user?.role)}`);
    assert(session?.user?.permissions?.includes("org:admin"), "CEO session is missing org:admin");
  });

  await check("7. backend RBAC denies Relationship Manager access to audit authority", async () => {
    const loginResult = await login("stage10.rm@example.test");
    rmCookie = loginResult.cookie;
    const { response } = await jsonRequest("/api/v1/audit", {}, rmCookie);
    assert(response.status === 403, `Expected Relationship Manager audit request 403, received ${response.status}`);
  });

  await check("8. customer HTTP retrieval returns only seeded tenant-grounded data", async () => {
    const { response, body } = await jsonRequest("/api/v1/customers?limit=10", {}, ceoCookie);
    assert(response.status === 200, `Expected customers 200, received ${response.status}`);
    const items = body?.data?.items;
    assert(Array.isArray(items), "Canonical customer collection envelope is missing items");
    assert(items.length === 1, `Expected exactly one assurance customer, received ${items.length}`);
    assert(items[0].id === "customer-stage10-grounding", "Unexpected customer escaped the assurance query scope");
  });

  await check("9. AI HTTP response preserves grounded facts/provenance and leaves model prose unverified", async () => {
    const { response, body } = await jsonRequest(
      "/api/v1/ai/chat",
      {
        method: "POST",
        body: JSON.stringify({ prompt: "What is the customer ARR?", mode: "Customers" }),
      },
      ceoCookie
    );
    assert(response.status === 200, `Expected AI chat 200, received ${response.status}`);
    const data = body?.data;
    assert(Array.isArray(data?.facts) && data.facts.length > 0, "AI deterministic facts are missing");
    assert(data?.retrieval?.recordsRetrieved === 1, `Expected one grounded record, received ${String(data?.retrieval?.recordsRetrieved)}`);
    assert(data?.modelProse?.verificationState === "unverified", "Model prose was auto-verified");
    assert(data?.modelProse?.certificationState === "uncertified", "Model prose was auto-certified");
    const arrFact = data.facts.find((fact: any) => fact.id === "get_tenant_customers:retrieved-arr");
    assert(arrFact?.value === 123456, `Grounded ARR fact mismatch: ${String(arrFact?.value)}`);
    assert(arrFact?.provenance?.[0]?.entityId === "customer-stage10-grounding", "AI fact lost source provenance");
  });

  await check("10. concurrent HTTP revision commands serialize to one winning next revision", async () => {
    const created = await jsonRequest(
      "/api/v1/knowledge",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Stage 10 concurrency policy",
          category: "Policy",
          content: "Published revision one",
          tags: ["stage10"],
        }),
      },
      ceoCookie
    );
    assert(created.response.status === 201, `Knowledge create failed: HTTP ${created.response.status}`);
    knowledgeId = created.body?.data?.id;
    assert(typeof knowledgeId === "string" && knowledgeId.length > 0, "Knowledge ID missing");

    const validated = await jsonRequest(
      `/api/v1/knowledge/${knowledgeId}/revisions/1/validate`,
      { method: "POST" },
      ceoCookie
    );
    assert(validated.response.status === 200, `Revision validation failed: HTTP ${validated.response.status}`);

    const published = await jsonRequest(
      `/api/v1/knowledge/${knowledgeId}/revisions/1/publish`,
      { method: "POST", body: JSON.stringify({ scope: "tenant" }) },
      ceoCookie
    );
    assert(published.response.status === 200, `Revision publication failed: HTTP ${published.response.status}`);

    const calls = ["Candidate A", "Candidate B"].map((content) =>
      jsonRequest(
        `/api/v1/knowledge/${knowledgeId}/revisions`,
        { method: "POST", body: JSON.stringify({ content }) },
        ceoCookie
      )
    );
    const settled = await Promise.all(calls);
    const statuses = settled.map((item) => item.response.status).sort((a, b) => a - b);
    assert(statuses.filter((status) => status === 201).length === 1, `Expected exactly one revision winner, received statuses ${statuses.join(",")}`);
    assert(statuses.some((status) => status === 409), `Expected concurrent loser to fail with 409, received statuses ${statuses.join(",")}`);
  });

  const failed = results.filter((result) => !result.passed);
  console.log("================================================================================");
  console.log("APEX ONE — STAGE 10 HTTP / AI / CONCURRENCY ASSURANCE");
  console.log("================================================================================");
  for (const result of results) {
    console.log(`${result.passed ? "✅ [PASS]" : "❌ [FAIL]"} ${result.name}`);
    if (result.error) console.log(`    ↳ ${result.error}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  console.log("================================================================================");
  if (failed.length > 0) process.exit(1);
}

void main().catch((error) => {
  console.error("❌ Stage 10 HTTP assurance failed:", error);
  process.exit(1);
});
