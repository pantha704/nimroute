import { NextResponse } from "next/server";

/** Uptime + dependency health probe. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "nimroute-console",
    time: new Date().toISOString(),
  });
}
