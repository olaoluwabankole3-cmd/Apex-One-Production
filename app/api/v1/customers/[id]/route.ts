import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/backend/core/security";
import { customerService } from "@/lib/backend/domains/customers/customerService";
import { BackendError } from "@/lib/backend/core/errors";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const customer = await customerService.getCustomerById(params.id, ctx);
    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    const body = await req.json();
    const customer = await customerService.updateCustomer(params.id, body, ctx);
    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolveTenantContext(req.headers);
    await customerService.deleteCustomer(params.id, ctx);
    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (err: any) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
