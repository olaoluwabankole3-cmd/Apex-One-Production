import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  resolveTenantContext,
  getClearSessionCookieOptions,
} from "@/lib/backend/core/security";
import { authService } from "@/lib/backend/domains/auth/authService";
import { BackendError } from "@/lib/backend/core/errors";

function getRequestSessionToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  return req.cookies.get(AUTH_COOKIE_NAME)?.value;
}

function withClearedSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(getClearSessionCookieOptions());
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const token = getRequestSessionToken(req);

    if (token) {
      let ctx;
      try {
        ctx = await resolveTenantContext(req.headers);
      } catch {
        // Logout is idempotent. A stale/expired context must not prevent
        // the browser-held session cookie from being cleared.
      }

      await authService.logout(token, ctx);
    }

    return withClearedSessionCookie(
      NextResponse.json({
        success: true,
        authenticated: false,
        message: "Logged out successfully",
      })
    );
  } catch (err: any) {
    const response =
      err instanceof BackendError
        ? NextResponse.json(
            { error: err.message, code: err.code, authenticated: false },
            { status: err.statusCode }
          )
        : NextResponse.json(
            {
              error: "Logout failed",
              code: "INTERNAL_ERROR",
              authenticated: false,
            },
            { status: 500 }
          );

    return withClearedSessionCookie(response);
  }
}
