import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  resolveTenantContext,
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

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const sessionData = await authService.getCurrentSession(
      ctx,
      getRequestSessionToken(req)
    );

    return NextResponse.json({
      success: true,
      ...sessionData,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
