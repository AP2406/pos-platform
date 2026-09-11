"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button variant="subtle" size="lg" onClick={copy}>
      {copied ? "Copied!" : "Copy menu link"}
    </Button>
  );
}
