"use client";

import { useState } from "react";

// P3-46 surface the public menu-board URL so the owner can put it on a TV/web.
export function MenuBoardLink({ businessId }: { businessId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")) + "/menu/" + businessId;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <button type="button" onClick={copy} className="text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
      {copied ? "Copied!" : "Menu board link"}
    </button>
  );
}
