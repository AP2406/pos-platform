"use client";

import { useState, useTransition } from "react";
import { setOnlineBooking } from "../reservations/reservation-actions";

export function OnlineBookingCard({ enabled: initEnabled, bookingUrl }: { enabled: boolean; bookingUrl: string }) {
  const [enabled, setEnabled] = useState(initEnabled);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setErr(null);
    setEnabled(next);
    start(async () => {
      const res = await setOnlineBooking(next);
      if ("error" in res) { setErr(res.error); setEnabled(!next); }
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        A public page where guests can request a table. Bookings land in Reservations and send a confirmation email.
      </p>
      <label className="flex items-center gap-2 text-sm select-none">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={pending} className="h-4 w-4" />
        <span className="font-medium">Enable online booking</span>
      </label>
      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">{bookingUrl}</code>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}
