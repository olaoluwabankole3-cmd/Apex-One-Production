/**
 * APEX ONE — Stage 3F Frontend Canonical Consumer Contract
 */

import * as fs from "fs";
import * as path from "path";
import { collectAllCollectionData } from "../../data/repositories/httpCollection";
import { ApiClientContractError } from "../../apiClient";

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

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

function collectSourceFiles(rootRelative: string): string[] {
  const root = path.join(process.cwd(), rootRelative);
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(path.relative(process.cwd(), absolute).replace(/\\/g, "/"));
      }
    }
  };

  visit(root);
  return files.sort();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function runFrontendCanonicalConsumersTestSuite(): Promise<TestSuiteSummary> {
  const suite = "Frontend Canonical HTTP Consumers";
  const results: TestResult[] = [];

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
    } catch (error: any) {
      results.push({
        suite,
        testName,
        passed: false,
        error: error?.message || String(error),
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    }
  };

  await test("1. Frontend repository adapters do not use raw API envelope helpers", () => {
    const repositoryFiles = collectSourceFiles("lib/data/repositories").filter(
      (file) => !file.endsWith("httpCollection.ts") && !file.endsWith("index.ts")
    );
    const rawCall = /apiClient\.(?:get|post|put|delete)\s*(?:<|\()/;
    const offenders = repositoryFiles.filter((file) => rawCall.test(source(file)));
    if (offenders.length > 0) {
      throw new Error(`Raw apiClient envelope consumers remain: ${offenders.join(", ")}`);
    }
  });

  await test("2. Frontend components do not bypass the canonical client for business API calls", () => {
    const frontendFiles = [...collectSourceFiles("components"), ...collectSourceFiles("app")];
    const offenders: string[] = [];

    for (const file of frontendFiles) {
      const text = source(file);
      const directFetch = /fetch\s*\(\s*["'`]\/api\/v1\/(?!auth\/)/.test(text);
      const rawApiClient = /apiClient\.(?:get|post|put|delete)\s*(?:<|\()/.test(text);
      if (directFetch || rawApiClient) offenders.push(file);
    }

    if (offenders.length > 0) {
      throw new Error(`Frontend business API bypasses canonical helpers: ${offenders.join(", ")}`);
    }
  });

  await test("3. Endpoint-backed repositories propagate failures instead of returning empty success state", () => {
    const mustPropagate = [
      "lib/data/repositories/aiRepository.ts",
      "lib/data/repositories/intelligenceRepository.ts",
      "lib/data/repositories/knowledgeRepository.ts",
      "lib/data/repositories/notificationRepository.ts",
      "lib/data/repositories/revenueRepository.ts",
      "lib/data/repositories/valueRepository.ts",
    ];

    for (const file of mustPropagate) {
      const text = source(file);
      if (/catch\s*\(/.test(text)) {
        throw new Error(`${file} still catches and can mask endpoint failures`);
      }
    }

    for (const file of [
      "lib/data/repositories/customerRepository.ts",
      "lib/data/repositories/documentRepository.ts",
      "lib/data/repositories/workflowRepository.ts",
    ]) {
      const text = source(file);
      if (!text.includes("isApiNotFound(error)") || !text.includes("throw error")) {
        throw new Error(`${file} does not restrict error translation to structured 404 lookup semantics`);
      }
    }
  });

  await test("4. Legacy AI fallback and response-envelope guessing are removed", () => {
    const ai = source("lib/data/repositories/aiRepository.ts");
    if (ai.includes("/api/gemini")) {
      throw new Error("AI frontend repository still silently falls back to the legacy Gemini route");
    }
    if (/res\?\.data|res\.data|res\?\.text/.test(ai)) {
      throw new Error("AI frontend repository still guesses raw response-envelope shapes");
    }
    if (!ai.includes("apiClient.postData<")) {
      throw new Error("AI frontend repository does not consume canonical data responses");
    }
  });

  await test("5. Frontend cursor traversal uses only canonical pagination metadata", () => {
    const helper = source("lib/data/repositories/httpCollection.ts");
    if (!helper.includes("apiClient.getCollection<T>")) {
      throw new Error("Frontend collection traversal does not use getCollection");
    }
    if (!helper.includes("page.pagination.hasMore") || !helper.includes("page.pagination.nextCursor")) {
      throw new Error("Frontend collection traversal does not read canonical pagination metadata");
    }
    if (/\bpage\.(?:hasMore|nextCursor)\b/.test(helper)) {
      throw new Error("Frontend traversal still assumes top-level pagination fields");
    }
  });

  await test("6. Complete UI projections traverse multiple cursor pages without dropping data", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const endpoint = String(input);
      calls.push(endpoint);
      if (endpoint.includes("cursor=cursor-two")) {
        return jsonResponse({
          success: true,
          data: [{ id: "three" }],
          pagination: { nextCursor: null, hasMore: false, count: 1, totalCount: 3 },
          requestId: "req-page-two",
        });
      }

      return jsonResponse({
        success: true,
        data: [{ id: "one" }, { id: "two" }],
        pagination: { nextCursor: "cursor-two", hasMore: true, count: 2, totalCount: 3 },
        requestId: "req-page-one",
      });
    }) as typeof fetch;

    try {
      const records = await collectAllCollectionData<{ id: string }>("/api/v1/customers");
      if (records.map((record) => record.id).join(",") !== "one,two,three") {
        throw new Error("Cursor traversal lost or reordered collection data");
      }
      if (calls.length !== 2 || !calls[1].includes("cursor=cursor-two")) {
        throw new Error("Cursor traversal did not request the canonical second page");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("7. Contradictory hasMore metadata fails closed instead of truncating", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse({
        success: true,
        data: [{ id: "one" }],
        pagination: { nextCursor: null, hasMore: true, count: 1 },
        requestId: "req-bad-pagination",
      })) as typeof fetch;

    try {
      let rejected = false;
      try {
        await collectAllCollectionData<{ id: string }>("/api/v1/customers");
      } catch (error) {
        rejected = error instanceof ApiClientContractError;
      }
      if (!rejected) {
        throw new Error("Contradictory collection metadata was silently treated as a complete dataset");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test("8. API failures remain visible even when a workspace catches for local cleanup", () => {
    const client = source("lib/apiClient.ts");
    const signal = source("lib/frontendApiFailure.ts");
    const banner = source("components/layout/ApiFailureBanner.tsx");
    const layout = source("app/layout.tsx");
    const shell = source("components/layout/AppShell.tsx");

    if (!client.includes("publishFrontendApiFailure")) {
      throw new Error("Canonical API client does not publish nonfatal frontend failures");
    }
    if (!signal.includes('"apex:api-failure"')) {
      throw new Error("Frontend failure channel is missing its stable event contract");
    }
    if (!banner.includes("FRONTEND_API_FAILURE_EVENT") || !banner.includes('role="alert"')) {
      throw new Error("Frontend does not expose a visible nonfatal API failure surface");
    }
    if (!layout.includes("<AppShell>{children}</AppShell>")) {
      throw new Error("Root layout does not route product UI through the global application shell");
    }
    if (!shell.includes("<ApiFailureBanner />")) {
      throw new Error("Global authenticated application shell does not render the API failure surface");
    }
  });

  await test("9. Customer list distinguishes failed loading from a genuine empty collection", () => {
    const customerList = source("components/customers/CustomerList.tsx");
    if (!customerList.includes("loadError") || !customerList.includes("Customer data unavailable")) {
      throw new Error("Customer list still renders backend failure as an ordinary empty result");
    }
  });

  await test("10. Frontend repository layer has no legacy top-level cursor/result assumptions", () => {
    const repositoryFiles = collectSourceFiles("lib/data/repositories");
    const offenders: string[] = [];
    for (const file of repositoryFiles) {
      const text = source(file);
      if (/\bres\??\.(?:cursor|nextCursor|hasMore|items)\b/.test(text)) {
        offenders.push(file);
      }
    }
    if (offenders.length > 0) {
      throw new Error(`Legacy collection response assumptions remain: ${offenders.join(", ")}`);
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
