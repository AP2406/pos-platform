"use client";

import { useState, useTransition } from "react";
import { setGuestOrdering } from "./guest-ordering-actions";

export function GuestOrderingCard({
  businessId,
  initialEnabled,
  tables,
}: {
  businessId: string;
  initialEnabled: boolean;
  tables: { id: string; label: string }[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await setGuestOrdering(next);
      if ("error" in res) setEnabled(!next);
    });
  }

  function linkFor(elementId: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin + "/order/" + businessId + "/" + elementId;
  }

  async function copy(elementId: string) {
    try {
      await navigator.clipboard.writeText(linkFor(elementId));
      setCopied(elementId);
      setTimeout(() => setCopied((c) => (c === elementId ? null : c)), 1500);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Let guests scan a code at their table to add items to their check. Orders arrive unfired for staff to review and fire — there&apos;s no online payment; guests pay with their server.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={pending} className="h-4 w-4" />
        Enable guest ordering
      </label>

      {enabled && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per-table links</div>
          <p className="text-xs text-muted-foreground">Turn each link into a QR code (any QR tool) and place it on the table. Ordering only works once a server has opened the table.</p>
          <div className="space-y-1.5">
            {tables.length === 0 && <p className="text-xs text-muted-foreground">No tables on the floor yet.</p>}
            {tables.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="text-sm font-medium">{t.label}</span>
                <button type="button" onClick={() => copy(t.id)} className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
                  {copied === t.id ? "Copied!" : "Copy link"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
