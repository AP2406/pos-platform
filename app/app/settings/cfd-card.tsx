"use client";

import { useState } from "react";

export function CfdCard({ businessId }: { businessId: string }) {
  const [copied, setCopied] = useState(false);
  const url = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")) + "/cfd/" + businessId;

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
        Show the order on a second screen facing the customer. It mirrors the register&apos;s
        cart and total live, then shows a thank-you when the sale is paid. Open it on the
        customer-facing display; no setup needed.
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
  );
}
