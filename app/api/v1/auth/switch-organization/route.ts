import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  resolveTenantContext,
  getSessionCookieOptions,
} from "@/lib/backend/core/security";
import { authService } from "@/lib/backend/domains/auth/authService";
import { buildAuthSessionMetadata } from "@/lib/backend/domains/auth/authSessionContract";
import { BackendError, ValidationError } from "@/lib/backend/core/errors";

function getRequestSessionToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  return req.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json().catch(() => ({}));

    if (
      !body.targetOrganizationId ||
      typeof body.targetOrganizationId !== "string" ||
      body.targetOrganizationId.trim().length === 0
    ) {
      throw new ValidationError("Target organization ID is required");
    }

    const result = await authService.switchOrganization(
      body.targetOrganizationId.trim(),
      ctx,
      getRequestSessionToken(req)
    );

    const metadata = buildAuthSessionMetadata(
      result.session,
      result.availableOrganizations,
      result.requiresPasswordChange
    );

    const response = NextResponse.json({
      success: true,
      ...metadata,
    });

    response.cookies.set({
      ...getSessionCookieOptions(86400),
      value: result.session.token,
    });

    return response;
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to switch organization" },
      { status: 500 }
    );
  }
}
