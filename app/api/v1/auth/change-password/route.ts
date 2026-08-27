import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, getClearSessionCookieOptions } from "@/lib/backend/core/security";
import { authService } from "@/lib/backend/domains/auth/authService";
import { BackendError, ValidationError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json().catch(() => ({}));

    if (!body.currentPassword || typeof body.currentPassword !== "string") {
      throw new ValidationError("Current password is required");
    }

    if (!body.newPassword || typeof body.newPassword !== "string") {
      throw new ValidationError("New password is required");
    }

    await authService.changePassword(
      {
        userId: body.userId || ctx.userId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      },
      ctx
    );

    const response = NextResponse.json({
      success: true,
      message: "Password changed successfully. Please log in with your new credentials.",
    });

    // Clear session cookie since user sessions were invalidated
    response.cookies.set(getClearSessionCookieOptions());

    return response;
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Failed to change password" }, { status: 500 });
  }
}
