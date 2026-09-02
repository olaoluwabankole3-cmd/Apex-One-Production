import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { customerService } from "@/lib/backend/domains/customers/customerService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offsetParam = searchParams.get("offset");
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const items = await customerService.getCustomers(ctx, { tier, status, search, limit, offset });
    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
      organizationId: ctx.organizationId,
    });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json();
    const newCustomer = await customerService.createCustomer(body, ctx);
    return NextResponse.json({ success: true, data: newCustomer }, { status: 201 });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
