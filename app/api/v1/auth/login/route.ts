import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/backend/domains/auth/authService";
import { BackendError, UnauthorizedError, ValidationError } from "@/lib/backend/core/errors";
import { generateRequestId } from "@/lib/backend/core/security";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.email || typeof body.email !== "string" || body.email.trim().length === 0) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!body.password || typeof body.password !== "string" || body.password.length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const result = await authService.login(
      {
        email: body.email.trim(),
        password: body.password,
        targetOrganizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
      },
      requestId
    );

    return NextResponse.json({
      success: true,
      token: result.session.token,
      user: {
        id: result.session.userId,
        email: result.session.userEmail,
        name: result.session.userName,
        role: result.session.role,
        permissions: result.session.permissions,
      },
      organization: {
        id: result.session.organizationId,
        name: result.session.organizationName,
      },
      availableOrganizations: result.availableOrganizations,
      expiresAt: result.session.expiresAt,
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Invalid email or password", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Authentication failed", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

