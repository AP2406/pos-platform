"use client";

import { useState, useTransition } from "react";
import { sendTestDeliveryOrder } from "./delivery-actions";
import { DELIVERY_PLATFORMS } from "@/lib/services/delivery";

// Shown under the Delivery connector when it's enabled. Injects a sample order on
// the chosen platform so the operator can watch it land on the KDS + in reports.
export function DeliveryTestButton() {
  const [platform, setPlatform] = useState<string>(DELIVERY_PLATFORMS[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendTestDeliveryOrder(platform);
      setMsg("error" in res ? res.error : "Test order injected — check the Kitchen screen.");
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-border p-3 text-sm">
      <div className="font-medium mb-1">Send a test order</div>
      <p className="text-xs text-muted-foreground mb-2">
        Inject a sample paid order to confirm it appears on the KDS (tagged by platform) and in by-channel reports.
      </p>
      <div className="flex items-center gap-2">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm capitalize">
          {DELIVERY_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="button" onClick={send} disabled={pending} className="h-9 px-3 rounded-md border border-foreground text-sm disabled:opacity-50">
          {pending ? "Sending…" : "Send test order"}
        </button>
      </div>
      {msg && <p className="text-xs mt-2 text-muted-foreground">{msg}</p>}
    </div>
  );
}
