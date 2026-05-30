"use client";

import { useEffect, useState } from "react";
import { getInboundAddress } from "./inbound-lead-actions";

export function LeadInboxCard() {
  const [address, setAddress] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getInboundAddress()
      .then((res) => {
        setAddress(res.address);
        if (res.verificationCode && res.verificationAt) {
          const ageMs = Date.now() - new Date(res.verificationAt).getTime();
          if (ageMs < 30 * 60 * 1000) setCode(res.verificationCode);
        }
      })
      .catch(() => setAddress(null));
  }, []);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-4">
      <h2 className="text-sm font-semibold mb-1">Lead inbox (auto-import)</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Forward your booking emails to this address and they appear
        automatically in your Leads tab. Set it up once in Gmail and it runs
        hands-off.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <code className="flex-1 text-sm bg-muted rounded px-3 py-2 break-all">
          {address ?? "Loading..."}
        </code>
        <button
          onClick={copy}
          disabled={!address}
          className="text-sm border border-border rounded px-3 py-2 hover:bg-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {code ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <p className="text-sm text-amber-900">
            Gmail sent a confirmation code: <strong>{code}</strong>. Paste it
            into Gmail&apos;s forwarding settings to finish verifying.
          </p>
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">
          Set up auto-forwarding in Gmail:
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Open Settings, then Forwarding and POP/IMAP, then Add a forwarding
            address, and paste the address above.
          </li>
          <li>
            Gmail sends a code to this address; it shows up on this card (or
            verifies automatically). Enter it in Gmail if asked.
          </li>
          <li>
            Then create a filter (Settings, then Filters) for your booking
            emails and choose Forward it to this address.
          </li>
        </ol>
      </div>
    </div>
  );
}