/**
 * APEX ONE — Stage 3E Frontend API Client Contract
 */

import {
  ApiClient,
  ApiClientContractError,
  ApiClientError,
} from "../../apiClient";

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

export interface TestSuiteSummary {
  total: number;
  passedCount: number;
  failedCount: number;
  passed: boolean;
  results: TestResult[];
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function runApiClientContractTestSuite(): Promise<TestSuiteSummary> {
  const suite = "Frontend API Client Canonical Contract";
  const results: TestResult[] = [];
  const originalFetch = globalThis.fetch;

  const test = async (testName: string, fn: () => void | Promise<void>) => {
    const startedAt = performance.now();
    try {
      await fn();
      results.push({
        suite,
        testName,
        passed: true,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    } catch (error: unknown) {
      results.push({
        suite,
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  };

  await test("1. Canonical entity helper unwraps only the data payload", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        success: true,
        data: { id: "cust-client-1", name: "Canonical Customer" },
        requestId: "req-client-data",
      });

    const client = new ApiClient();
    const data = await client.getData<{ id: string; name: string }>("/api/v1/customers/cust-client-1");

    if (data.id !== "cust-client-1" || data.name !== "Canonical Customer") {
      throw new Error("Canonical entity helper did not return the response data payload");
    }
  });

  await test("2. Canonical collection helper preserves pagination and request correlation", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        success: true,
        data: [{ id: "cust-client-1" }],
        pagination: {
          nextCursor: "next-client-cursor",
          hasMore: true,
          count: 1,
          totalCount: 3,
        },
        requestId: "req-client-collection",
      });

    const client = new ApiClient();
    const collection = await client.getCollection<{ id: string }>("/api/v1/customers?limit=1");

    if (collection.data.length !== 1 || collection.data[0].id !== "cust-client-1") {
      throw new Error("Collection data was not preserved");
    }
    if (
      collection.pagination.nextCursor !== "next-client-cursor" ||
      collection.pagination.hasMore !== true ||
      collection.pagination.count !== 1 ||
      collection.pagination.totalCount !== 3
    ) {
      throw new Error("Canonical pagination metadata was lost or rewritten");
    }
    if (collection.requestId !== "req-client-collection") {
      throw new Error("Collection requestId was not preserved");
    }
  });

  await test("3. Structured backend errors retain code, status, details, and requestId", async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid limit",
            status: 400,
            details: { field: "limit", reason: "out_of_range" },
            requestId: "req-client-error",
          },
        },
        400
      );

    const client = new ApiClient();

    try {
      await client.getData("/api/v1/customers?limit=1000");
      throw new Error("Expected structured backend error to be thrown");
    } catch (error: unknown) {
      if (!(error instanceof ApiClientError)) {
        throw new Error("Backend failure was flattened into a generic Error");
      }
      if (error.code !== "VALIDATION_ERROR" || error.status !== 400) {
        throw new Error("Backend error code/status were not preserved");
      }
      if ((error.details as { field?: string })?.field !== "limit") {
        throw new Error("Backend structured error details were not preserved");
      }
      if (error.requestId !== "req-client-error") {
        throw new Error("Backend requestId was not preserved");
      }
      if (error.endpoint !== "/api/v1/customers?limit=1000" || error.method !== "GET") {
        throw new Error("Client error lost request context");
      }
    }
  });

  await test("4. 401 notifies session listeners once and never retries authentication", async () => {
    let fetchCount = 0;
    let unauthorizedCount = 0;

    globalThis.fetch = async () => {
      fetchCount += 1;
      return jsonResponse(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session expired",
            status: 401,
            requestId: "req-client-401",
          },
        },
        401
      );
    };

    const client = new ApiClient();
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    try {
      await client.getData("/api/v1/customers");
      throw new Error("Expected unauthorized request to fail");
    } catch (error: unknown) {
      if (!(error instanceof ApiClientError) || error.code !== "UNAUTHORIZED") {
        throw new Error("401 response did not preserve the canonical unauthorized error");
      }
    }

    if (fetchCount !== 1) {
      throw new Error("API client retried a 401 request or attempted hidden authentication");
    }
    if (unauthorizedCount !== 1) {
      throw new Error("401 did not trigger exactly one unauthenticated transition notification");
    }
  });

  await test("5. Malformed success envelopes fail closed with an explicit contract error", async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        success: true,
        items: [{ id: "legacy-shape" }],
        cursor: "legacy-cursor",
      });

    const client = new ApiClient();

    try {
      await client.getCollection("/api/v1/customers");
      throw new Error("Legacy collection response shape was accepted");
    } catch (error: unknown) {
      if (!(error instanceof ApiClientContractError)) {
        throw new Error("Malformed canonical response did not fail with ApiClientContractError");
      }
      if (error.code !== "INVALID_RESPONSE_CONTRACT") {
        throw new Error("Contract failure did not preserve its machine-readable client code");
      }
    }
  });

  await test("6. Raw compatibility helpers keep success envelopes and enforce same-origin cookies", async () => {
    let observedCredentials: RequestCredentials | undefined;
    let observedAccept: string | null = null;
    let observedContentType: string | null = null;

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      observedCredentials = init?.credentials;
      const headers = new Headers(init?.headers);
      observedAccept = headers.get("Accept");
      observedContentType = headers.get("Content-Type");

      return jsonResponse({
        success: true,
        data: { id: "created-client" },
        requestId: "req-client-raw",
      }, 201);
    };

    const client = new ApiClient();
    const raw = await client.post<{
      success: true;
      data: { id: string };
      requestId: string;
    }>("/api/v1/customers", { name: "Created", contactEmail: "owner@example.com" });

    if (raw.data.id !== "created-client" || raw.requestId !== "req-client-raw") {
      throw new Error("Raw compatibility request altered the canonical success envelope");
    }
    if (observedCredentials !== "same-origin") {
      throw new Error("API client stopped using browser-managed same-origin session cookies");
    }
    if (observedAccept !== "application/json" || observedContentType !== "application/json") {
      throw new Error("API client did not apply canonical JSON request headers");
    }
  });

  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passedCount,
    failedCount,
    passed: failedCount === 0,
    results,
  };
}
