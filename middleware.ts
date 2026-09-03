import { NextRequest, NextResponse } from "next/server";
import {
  getInfrastructureReadiness,
  isProductionInfrastructureEnvironment,
} from "./lib/backend/infrastructure/runtime";
import {
  emitTelemetry,
  normalizeRequestId,
} from "./lib/backend/observability/telemetry";

function requestIdFor(request: NextRequest): string {
  return normalizeRequestId(request.headers.get("x-request-id")) || crypto.randomUUID();
}

function routeFamily(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "api" && segments[1] === "v1") {
    return `api/v1/${segments[2] || "root"}`;
  }
  if (segments[0] === "api") return "api/legacy";
  return `ui/${segments[0] || "root"}`;
}

function continueRequest(request: NextRequest, requestId: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

/**
 * Production fail-closed and Stage 11 telemetry boundary.
 *
 * Health probes remain observable while production is not ready. Every request
 * receives a normalized correlation ID and emits only a route-family label;
 * resource identifiers, query strings, credentials, and request bodies are not
 * included in ingress telemetry.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestId = requestIdFor(request);
  const family = routeFamily(pathname);
  const production = isProductionInfrastructureEnvironment();

  if (pathname === "/api/v1/health" || pathname.startsWith("/api/v1/health/")) {
    emitTelemetry("http.ingress", {
      requestId,
      outcome: "accepted",
      attributes: { method: request.method, routeFamily: family, production, probe: true },
    });
    return continueRequest(request, requestId);
  }

  if (!production) {
    emitTelemetry("http.ingress", {
      requestId,
      outcome: "accepted",
      attributes: { method: request.method, routeFamily: family, production: false },
    });
    return continueRequest(request, requestId);
  }

  const readiness = getInfrastructureReadiness();
  if (readiness.ready) {
    emitTelemetry("http.ingress", {
      requestId,
      outcome: "accepted",
      attributes: { method: request.method, routeFamily: family, production: true },
    });
    return continueRequest(request, requestId);
  }

  emitTelemetry("http.ingress", {
    requestId,
    level: "warn",
    outcome: "blocked",
    attributes: {
      method: request.method,
      routeFamily: family,
      production: true,
      infrastructureReady: false,
      configurationIssueCount: readiness.issues.length,
    },
  });

  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "60",
    "X-Request-Id": requestId,
  };

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INFRASTRUCTURE_NOT_READY",
          message: "Production infrastructure is not ready",
          status: 503,
          requestId,
        },
        requestId,
      },
      { status: 503, headers }
    );
  }

  return new NextResponse("Service unavailable", {
    status: 503,
    headers,
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
