import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "healthy",
    version: "v1.0.0",
    service: "APEX ONE Backend",
    timestamp: new Date().toISOString(),
  });
}
