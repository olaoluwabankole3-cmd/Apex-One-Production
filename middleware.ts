import { NextRequest, NextResponse } from "next/server";
import {
  getInfrastructureReadiness,
  isProductionInfrastructureEnvironment,
} from "./lib/backend/infrastructure/runtime";

/**
 * Stage 4 fail-closed production boundary.
 *
 * Until all durable infrastructure adapters are both configured and wired in
 * code, production requests are rejected before they can reach in-memory
 * authoritative state.
 *
 * Stage 10 health probes are deliberately observable even while production is
 * not ready. Liveness proves the process can answer; the readiness route owns
 * active dependency checks and returns 503 when durable authorities are down.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/api/v1/health" || pathname.startsWith("/api/v1/health/")) {
    return NextResponse.next();
  }

  if (!isProductionInfrastructureEnvironment()) {
    return NextResponse.next();
  }

  const readiness = getInfrastructureReadiness();
  if (readiness.ready) {
    return NextResponse.next();
  }

  const requestId = crypto.randomUUID();
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
