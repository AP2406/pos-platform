import { NextResponse } from "next/server";
import { resolveTerminalContext } from "@/lib/services/finix-terminal-context";
import { cancelTerminalDevice } from "@/lib/services/finix-terminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/terminal/cancel — cancel whatever prompt is active on the device.
export async function POST() {
  const ctx = await resolveTerminalContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.message, reason: ctx.reason }, { status: 409 });
  }
  const res = await cancelTerminalDevice(ctx.deviceId);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
