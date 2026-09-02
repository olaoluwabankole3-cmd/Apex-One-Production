/**
 * APEX ONE — Stage 3 Canonical HTTP Contract Foundation
 */

import * as fs from "fs";
import * as path from "path";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  toCollectionResponse,
  type PaginatedResult,
} from "../../contracts/http";
import {
  DEFAULT_PAGE_SIZE as DATABASE_DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE as DATABASE_MAX_PAGE_SIZE,
  applyQuerySpecificationPaginated,
} from "../database/querySpecification";
import { serializeApiError } from "../core/httpContract";
import { ValidationError } from "../core/errors";
import {
  assertAllowedKeys,
  assertAllowedQueryKeys,
  parseCursorPagination,
  requireJsonObject,
} from "../core/requestValidation";
import { parseCreateWorkflowRequest } from "../domains/workflows/workflowRequestValidation";

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

interface TestRecord {
  id: string;
  organizationId: string;
  name: string;
  score: number;
}

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

export async function runHttpContractFoundationTestSuite(): Promise<TestSuiteSummary> {
  const suite = "Canonical HTTP Contract Foundation";
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

  await test("1. Shared pagination constants are the single database contract source", () => {
    if (DEFAULT_PAGE_SIZE !== 50 || MAX_PAGE_SIZE !== 100) {
      throw new Error("Canonical page limits changed unexpectedly");
    }
    if (
      DATABASE_DEFAULT_PAGE_SIZE !== DEFAULT_PAGE_SIZE ||
      DATABASE_MAX_PAGE_SIZE !== MAX_PAGE_SIZE
    ) {
      throw new Error("Database pagination engine diverged from shared contract constants");
    }

    const paginationSource = source("lib/backend/database/pagination.ts");
    if (!paginationSource.includes('from "../../contracts/http"')) {
      throw new Error("Database pagination engine does not import the shared HTTP contract");
    }
  });

  await test("2. Public pagination contract contains cursor and no offset authority", () => {
    const contractSource = source("lib/contracts/http.ts");
    const querySource = source("lib/backend/database/querySpecification.ts");

    const cursorRequest = contractSource.match(
      /export interface CursorPaginationRequest\s*\{([\s\S]*?)\n\}/
    )?.[1];
    if (!cursorRequest) throw new Error("CursorPaginationRequest contract is missing");
    if (!/\bcursor\?\s*:/.test(cursorRequest) || !/\blimit\?\s*:/.test(cursorRequest)) {
      throw new Error("Cursor pagination request is missing limit/cursor fields");
    }
    if (/\boffset\b/.test(cursorRequest)) {
      throw new Error("Shared public pagination request still exposes offset");
    }

    const querySpec = querySource.match(
      /export interface QuerySpecification[\s\S]*?\{([\s\S]*?)\n\}/
    )?.[1];
    if (!querySpec) throw new Error("QuerySpecification contract is missing");
    if (/\boffset\b/.test(querySpec)) {
      throw new Error("Repository query specification still exposes offset pagination");
    }
  });

  await test("3. Collection responses preserve one explicit pagination metadata shape", () => {
    const page: PaginatedResult<{ id: string }> = {
      items: [{ id: "one" }],
      nextCursor: "cursor-next",
      hasMore: true,
      count: 1,
      totalCount: 3,
    };

    const response = toCollectionResponse(page, "req-stage3-contract");
    if (response.success !== true || response.data.length !== 1) {
      throw new Error("Collection response did not preserve data items");
    }
    if (
      response.pagination.nextCursor !== "cursor-next" ||
      response.pagination.hasMore !== true ||
      response.pagination.count !== 1 ||
      response.pagination.totalCount !== 3
    ) {
      throw new Error("Collection response pagination metadata diverged from canonical page result");
    }
    if (response.requestId !== "req-stage3-contract") {
      throw new Error("Collection response lost request correlation metadata");
    }
  });

  await test("4. Structured errors preserve backend code, status, details, and requestId", () => {
    const serialized = serializeApiError(
      new ValidationError("Invalid request", { field: "limit" }),
      "req-stage3-error"
    );

    if (serialized.status !== 400) throw new Error("HTTP status was not preserved");
    if (serialized.body.success !== false) throw new Error("Error envelope success flag is incorrect");
    if (serialized.body.error.code !== "VALIDATION_ERROR") {
      throw new Error("Backend error code was lost");
    }
    if (serialized.body.error.status !== 400) throw new Error("Error body status was lost");
    if ((serialized.body.error.details as any)?.field !== "limit") {
      throw new Error("Structured error details were lost");
    }
    if (serialized.body.error.requestId !== "req-stage3-error") {
      throw new Error("Structured error requestId was lost");
    }
  });

  await test("5. Unknown server errors are sanitized rather than leaking exception text", () => {
    const serialized = serializeApiError(
      new Error("database-password-or-stack-detail-must-not-leak"),
      "req-stage3-unknown"
    );

    if (serialized.status !== 500) throw new Error("Unknown error did not map to HTTP 500");
    if (serialized.body.error.code !== "INTERNAL_SERVER_ERROR") {
      throw new Error("Unknown error did not receive canonical internal error code");
    }
    if (serialized.body.error.message.includes("password-or-stack")) {
      throw new Error("Unknown error message leaked internal exception details");
    }
  });

  await test("6. Cursors are tenant-bound and sort-bound", () => {
    const records: TestRecord[] = [
      { id: "a", organizationId: "org-a", name: "A", score: 10 },
      { id: "b", organizationId: "org-a", name: "B", score: 20 },
      { id: "c", organizationId: "org-a", name: "C", score: 30 },
    ];

    const firstPage = applyQuerySpecificationPaginated(
      records,
      { limit: 1, orderBy: { field: "score", direction: "asc" } },
      "org-a"
    );
    if (!firstPage.nextCursor) throw new Error("Expected cursor for multi-page collection");

    let tenantRejected = false;
    try {
      applyQuerySpecificationPaginated(
        records.map((record) => ({ ...record, organizationId: "org-b" })),
        {
          limit: 1,
          cursor: firstPage.nextCursor,
          orderBy: { field: "score", direction: "asc" },
        },
        "org-b"
      );
    } catch (error) {
      tenantRejected = error instanceof ValidationError;
    }
    if (!tenantRejected) throw new Error("Tenant B accepted a cursor issued for Tenant A");

    let sortRejected = false;
    try {
      applyQuerySpecificationPaginated(
        records,
        {
          limit: 1,
          cursor: firstPage.nextCursor,
          orderBy: { field: "name", direction: "asc" },
        },
        "org-a"
      );
    } catch (error) {
      sortRejected = error instanceof ValidationError;
    }
    if (!sortRejected) throw new Error("Cursor was reusable under a different sort order");
  });

  await test("7. HTTP query parser rejects legacy, duplicate, and malformed pagination inputs", () => {
    const valid = new URLSearchParams("limit=25&cursor=cursor-token");
    assertAllowedQueryKeys(valid, ["limit", "cursor"]);
    const parsed = parseCursorPagination(valid);
    if (parsed.limit !== 25 || parsed.cursor !== "cursor-token") {
      throw new Error("Canonical cursor query did not parse deterministically");
    }

    const invalidCases = [
      new URLSearchParams("offset=20"),
      new URLSearchParams("page=2"),
      new URLSearchParams("limit=10&limit=20"),
    ];

    for (const params of invalidCases) {
      let rejected = false;
      try {
        assertAllowedQueryKeys(params, ["limit", "cursor"]);
      } catch (error) {
        rejected = error instanceof ValidationError;
      }
      if (!rejected) {
        throw new Error(`Ambiguous/legacy query was accepted: ${params.toString()}`);
      }
    }

    let malformedLimitRejected = false;
    try {
      parseCursorPagination(new URLSearchParams("limit=not-a-number"));
    } catch (error) {
      malformedLimitRejected = error instanceof ValidationError;
    }
    if (!malformedLimitRejected) {
      throw new Error("Malformed query limit was silently coerced");
    }
  });

  await test("8. Runtime body boundary rejects primitives, arrays, and unsupported fields", () => {
    for (const invalidBody of [null, "text", 42, [], true]) {
      let rejected = false;
      try {
        requireJsonObject(invalidBody);
      } catch (error) {
        rejected = error instanceof ValidationError;
      }
      if (!rejected) throw new Error("Non-object JSON body crossed the HTTP boundary");
    }

    let unsupportedFieldRejected = false;
    try {
      assertAllowedKeys(
        { name: "Allowed", organizationId: "client-controlled-org" },
        ["name"]
      );
    } catch (error) {
      unsupportedFieldRejected = error instanceof ValidationError;
    }
    if (!unsupportedFieldRejected) {
      throw new Error("Client-controlled persistence/tenant field was silently accepted");
    }
  });

  await test("9. Business collection routes serialize the canonical collection envelope", () => {
    const collectionRoutes = [
      "app/api/v1/customers/route.ts",
      "app/api/v1/documents/route.ts",
      "app/api/v1/knowledge/route.ts",
      "app/api/v1/memory/route.ts",
      "app/api/v1/actions/route.ts",
      "app/api/v1/audit/route.ts",
      "app/api/v1/workflows/route.ts",
      "app/api/v1/workflows/[id]/run/route.ts",
      "app/api/v1/value/opportunities/route.ts",
      "app/api/v1/value/captured/route.ts",
    ];

    for (const route of collectionRoutes) {
      const routeSource = source(route);
      if (!routeSource.includes("toCollectionResponse")) {
        throw new Error(`${route} does not use the canonical collection serializer`);
      }
      if (/parseInt\s*\(|Number\s*\(\s*searchParams/.test(routeSource)) {
        throw new Error(`${route} still performs ad-hoc pagination coercion`);
      }
      if (/\boffset\b/.test(routeSource)) {
        throw new Error(`${route} still exposes offset pagination`);
      }
    }
  });

  await test("10. Business API routes preserve structured canonical error serialization", () => {
    const routes = [
      "app/api/v1/customers/route.ts",
      "app/api/v1/customers/[id]/route.ts",
      "app/api/v1/documents/route.ts",
      "app/api/v1/documents/[id]/route.ts",
      "app/api/v1/knowledge/route.ts",
      "app/api/v1/knowledge/[id]/route.ts",
      "app/api/v1/memory/route.ts",
      "app/api/v1/actions/route.ts",
      "app/api/v1/actions/[id]/advance/route.ts",
      "app/api/v1/audit/route.ts",
      "app/api/v1/workflows/route.ts",
      "app/api/v1/workflows/[id]/route.ts",
      "app/api/v1/workflows/[id]/run/route.ts",
      "app/api/v1/value/opportunities/route.ts",
      "app/api/v1/value/captured/route.ts",
      "app/api/v1/value/simulate/route.ts",
      "app/api/v1/value/summary/route.ts",
      "app/api/v1/ai/chat/route.ts",
    ];

    for (const route of routes) {
      const routeSource = source(route);
      if (!routeSource.includes("serializeApiError")) {
        throw new Error(`${route} still manufactures an incompatible error shape`);
      }
      if (/err\.message\s*\|\|\s*["']Internal server error/.test(routeSource)) {
        throw new Error(`${route} can leak arbitrary internal error messages`);
      }
    }
  });

  await test("11. Workflow runtime schema validates nested graph payload shape", () => {
    const valid = parseCreateWorkflowRequest({
      name: "Validated workflow",
      description: "HTTP boundary graph validation",
      subsidiary: "Operations",
      nodes: [
        {
          id: "node-trigger",
          type: "trigger",
          title: "Start",
          configuration: { event: "manual", enabled: true, retries: 1 },
        },
      ],
      connections: [],
      status: "active",
    });

    if (valid.nodes.length !== 1 || valid.nodes[0].type !== "trigger") {
      throw new Error("Valid workflow request did not preserve typed graph data");
    }

    let nestedConfigurationRejected = false;
    try {
      parseCreateWorkflowRequest({
        name: "Invalid workflow",
        description: "Invalid nested config",
        subsidiary: "Operations",
        nodes: [
          {
            id: "node-trigger",
            type: "trigger",
            title: "Start",
            configuration: { nested: { arbitrary: "object" } },
          },
        ],
        connections: [],
      });
    } catch (error) {
      nestedConfigurationRejected = error instanceof ValidationError;
    }

    if (!nestedConfigurationRejected) {
      throw new Error("Unsupported nested workflow configuration crossed the HTTP boundary");
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
