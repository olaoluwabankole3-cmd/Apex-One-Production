export {};

const baseUrl = (process.env.ASSURANCE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = "Stage10Enterprise!2026";
const CORRELATION_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174111";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  const text = await response.text();
  let body: any = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

async function main(): Promise<void> {
  const login = await jsonRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "stage10.ceo@example.test",
      password: PASSWORD,
    }),
  });
  assert(login.response.status === 200, `CEO login failed: HTTP ${login.response.status}`);

  const setCookie = login.response.headers.get("set-cookie") || "";
  assert(setCookie.includes("apex_session="), "CEO login did not establish an apex_session cookie");
  const cookie = setCookie.split(";", 1)[0];

  const created = await jsonRequest(
    "/api/v1/customers",
    {
      method: "POST",
      headers: { "x-request-id": CORRELATION_REQUEST_ID },
      body: JSON.stringify({
        name: "Stage 11 Correlation Customer",
        contactEmail: "stage11.correlation@example.test",
        tier: "Enterprise",
        status: "active",
        arr: 111000,
        tags: ["stage11", "correlation"],
      }),
    },
    cookie
  );

  assert(created.response.status === 201, `Customer correlation mutation failed: HTTP ${created.response.status}`);
  assert(
    created.response.headers.get("x-request-id") === CORRELATION_REQUEST_ID,
    "Middleware did not echo the canonical request correlation ID"
  );
  assert(
    created.body?.requestId === CORRELATION_REQUEST_ID,
    "API success envelope lost the canonical request correlation ID"
  );

  const customerId = created.body?.data?.id;
  assert(typeof customerId === "string" && customerId.length > 0, "Created customer ID is missing");

  const audit = await jsonRequest("/api/v1/audit?limit=100", {}, cookie);
  assert(audit.response.status === 200, `Audit retrieval failed: HTTP ${audit.response.status}`);
  assert(Array.isArray(audit.body?.data), "Audit collection response is missing its data array");

  const correlated = audit.body.data.find(
    (item: any) => item?.action === "customer:create" && item?.resourceId === customerId
  );
  assert(correlated, "Customer creation audit record was not found");
  assert(
    correlated.requestId === CORRELATION_REQUEST_ID,
    `Durable audit request ID mismatch: expected ${CORRELATION_REQUEST_ID}, received ${String(correlated.requestId)}`
  );

  console.log("================================================================================");
  console.log("APEX ONE — REQUEST CORRELATION HTTP REGRESSION");
  console.log("================================================================================");
  console.log("✅ Middleware preserved the canonical X-Request-Id");
  console.log("✅ Authenticated tenant context retained the same request ID");
  console.log("✅ Customer mutation response retained the same request ID");
  console.log("✅ PostgreSQL durable audit retained the same request ID");
  console.log("================================================================================");
}

void main().catch((error) => {
  console.error("❌ Request correlation HTTP regression failed:", error);
  process.exit(1);
});
