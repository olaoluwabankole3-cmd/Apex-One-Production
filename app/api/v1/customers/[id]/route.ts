import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { customerService } from "@/lib/backend/domains/customers/customerService";
import { BackendError } from "@/lib/backend/core/errors";
import { Validator } from "@/lib/backend/core/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    Validator.requireId(id, "customerId");
    const customer = await customerService.getCustomerById(id, ctx);
    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    Validator.requireId(id, "customerId");
    const body = await req.json().catch(() => ({}));
    const customer = await customerService.updateCustomer(id, body, ctx);
    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const { id } = await params;
    Validator.requireId(id, "customerId");
    await customerService.deleteCustomer(id, ctx);
    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

