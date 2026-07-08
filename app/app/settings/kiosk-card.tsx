"use client";

import { useState, useTransition } from "react";
import { setKioskOrdering } from "./kiosk-actions";

export function KioskCard({
  businessId,
  initialEnabled,
}: {
  businessId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await setKioskOrdering(next);
      if ("error" in res) setEnabled(!next);
    });
  }

  const url = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")) + "/kiosk/" + businessId;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Run a self-ordering kiosk on a tablet. Customers build an order that fires straight to the
        kitchen and lands as a togo check — there&apos;s no online payment; they pay at the counter.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          disabled={pending}
          className="h-4 w-4"
        />
        Enable self-ordering kiosk
      </label>

      {enabled && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-muted-foreground">Kiosk link</div>
          <p className="text-xs text-muted-foreground">
            Open this on a tablet in kiosk/guided-access mode. Bookmark it for one-tap launch.
          </p>
          <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <span className="text-sm font-mono truncate">{url}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
              >
                Open
              </a>
              <button
                type="button"
                onClick={copy}
                className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
