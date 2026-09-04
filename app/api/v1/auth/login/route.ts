import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/backend/domains/auth/authService";
import { buildAuthSessionMetadata } from "@/lib/backend/domains/auth/authSessionContract";
import {
  BackendError,
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
} from "@/lib/backend/core/errors";
import { generateRequestId, getSessionCookieOptions } from "@/lib/backend/core/security";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await req.json().catch(() => ({}));

    const identifier =
      typeof body.identifier === "string" && body.identifier.trim().length > 0
        ? body.identifier.trim()
        : typeof body.email === "string"
          ? body.email.trim()
          : "";

    if (!identifier) {
      return NextResponse.json({ error: "Email or username is required" }, { status: 400 });
    }

    if (
      typeof body.identifier === "string" &&
      typeof body.email === "string" &&
      body.identifier.trim().toLowerCase() !== body.email.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Provide one login identifier", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (!body.password || typeof body.password !== "string" || body.password.length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await authService.login(
      {
        identifier,
        password: body.password,
        targetOrganizationId:
          typeof body.organizationId === "string" ? body.organizationId : undefined,
      },
      requestId,
      { ipAddress, userAgent }
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
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: err.message || "Invalid email or password", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: err.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    if (err instanceof BackendError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: "Authentication failed", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
