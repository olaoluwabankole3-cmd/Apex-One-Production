import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { authService } from "@/lib/backend/domains/auth/authService";
import { BackendError } from "@/lib/backend/core/errors";

export async function POST(req: NextRequest) {
  try {
    // Extract token from Bearer header or cookie
    let token: string | undefined;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else {
      token = req.cookies.get("apex_session")?.value;
    }

    if (token) {
      let ctx;
      try {
        ctx = await resolveTenantContext(req.headers);
      } catch {
        // Continue even if context resolution failed to guarantee session is revoked
      }
      await authService.logout(token, ctx);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    
    // Clear HttpOnly session cookie
    response.cookies.set({
      name: "apex_session",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Logout failed", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
