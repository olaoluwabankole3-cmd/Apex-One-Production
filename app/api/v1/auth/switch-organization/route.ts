import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, getSessionCookieOptions } from "@/lib/backend/core/security";
import { authService } from "@/lib/backend/domains/auth/authService";
import { BackendError, ValidationError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json().catch(() => ({}));

    if (!body.targetOrganizationId || typeof body.targetOrganizationId !== "string") {
      throw new ValidationError("Target organization ID is required");
    }

    const session = await authService.switchOrganization(body.targetOrganizationId.trim(), ctx);

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.userEmail,
        name: session.userName,
        role: session.role,
        permissions: session.permissions,
      },
      organization: {
        id: session.organizationId,
        name: session.organizationName,
      },
      expiresAt: session.expiresAt,
    });

    response.cookies.set({
      ...getSessionCookieOptions(86400),
      value: session.token,
    });

    return response;
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Failed to switch organization" }, { status: 500 });
  }
}
