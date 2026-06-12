"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueGiftCard, reloadGiftCard, lookupGiftCard, type GiftCardInfo } from "../pos/gift-card-actions";

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

export function GiftCardsCard() {
  const [issueAmount, setIssueAmount] = useState("");
  const [issued, setIssued] = useState<GiftCardInfo | null>(null);
  const [issueErr, setIssueErr] = useState<string | null>(null);

  const [lookupCode, setLookupCode] = useState("");
  const [found, setFound] = useState<GiftCardInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadAmount, setReloadAmount] = useState("");
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  function doIssue() {
    setIssueErr(null);
    setIssued(null);
    startTransition(async () => {
      const res = await issueGiftCard(Number(issueAmount));
      if ("error" in res) { setIssueErr(res.error); return; }
      setIssued(res.card);
      setIssueAmount("");
    });
  }

  function doLookup() {
    setLookupErr(null);
    setNotFound(false);
    setFound(null);
    startTransition(async () => {
      const res = await lookupGiftCard(lookupCode);
      if (!res) { setNotFound(true); return; }
      setFound(res);
    });
  }

  function doReload() {
    if (!found) return;
    setLookupErr(null);
    startTransition(async () => {
      const res = await reloadGiftCard(found.code, Number(reloadAmount));
      if ("error" in res) { setLookupErr(res.error); return; }
      setFound(res.card);
      setReloadAmount("");
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Sell and reload gift cards. Balances are real money and every change is recorded in a ledger.
      </p>

      {/* Issue */}
      <div className="space-y-2">
        <Label className="text-xs">Issue a new gift card</Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} placeholder="Amount (e.g. 25)" inputMode="decimal" className="h-9 w-40" />
          <Button onClick={doIssue} disabled={pending || !issueAmount.trim()}>Issue</Button>
        </div>
        {issued && (
          <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
            New card <span className="font-mono font-semibold">{issued.code}</span> &mdash; balance {money(issued.balance)}
          </div>
        )}
        {issueErr && <p className="text-sm text-red-600">{issueErr}</p>}
      </div>

      {/* Lookup / reload */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs">Check a balance</Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input value={lookupCode} onChange={(e) => setLookupCode(e.target.value)} placeholder="Gift card code" className="h-9 w-48 font-mono" onKeyDown={(e) => { if (e.key === "Enter") doLookup(); }} />
          <Button variant="outline" onClick={doLookup} disabled={pending || !lookupCode.trim()}>Check</Button>
        </div>
        {notFound && <p className="text-sm text-muted-foreground">No gift card with that code.</p>}
        {found && (
          <div className="rounded-md border border-border px-3 py-2 space-y-2">
            <div className="text-sm">
              <span className="font-mono font-semibold">{found.code}</span> &mdash; balance{" "}
              <span className="font-semibold tabular-nums">{money(found.balance)}</span>
              {!found.active && <span className="text-red-600"> (inactive)</span>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input value={reloadAmount} onChange={(e) => setReloadAmount(e.target.value)} placeholder="Add amount" inputMode="decimal" className="h-9 w-32" />
              <Button variant="outline" onClick={doReload} disabled={pending || !reloadAmount.trim()}>Reload</Button>
            </div>
          </div>
        )}
        {lookupErr && <p className="text-sm text-red-600">{lookupErr}</p>}
      </div>
    </div>
  );
}
