import { NextResponse } from "next/server";
import { resolveTerminalContext } from "@/lib/services/finix-terminal-context";
import { getDeviceConnection } from "@/lib/services/finix-terminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/terminal/status — device connection for the "Ready" badge.
// { ready:boolean, status:string } — "open" connection = Ready.
export async function GET() {
  const ctx = await resolveTerminalContext();
  if (!ctx.ok) {
    return NextResponse.json({ ready: false, reason: ctx.reason, message: ctx.message });
  }
  const res = await getDeviceConnection(ctx.deviceId);
  if ("error" in res) {
    return NextResponse.json({ ready: false, error: res.error });
  }
  return NextResponse.json({ ready: res.ready, status: res.status });
}
