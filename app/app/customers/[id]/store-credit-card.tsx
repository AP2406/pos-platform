"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueStoreCredit } from "../../pos/store-credit-actions";

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

export function StoreCreditCard({
  customerId,
  initialBalance,
  canIssue,
}: {
  customerId: string;
  initialBalance: number;
  canIssue: boolean;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function grant() {
    setErr(null);
    startTransition(async () => {
      const res = await issueStoreCredit(customerId, Number(amount));
      if ("error" in res) { setErr(res.error); return; }
      setBalance(res.balance);
      setAmount("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-2xl font-semibold tabular-nums">{money(balance)}</div>
      <p className="text-xs text-muted-foreground">
        Store credit is real money this customer can spend at checkout. Issuing or redeeming is recorded in a ledger.
      </p>
      {canIssue && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount to add" inputMode="decimal" className="h-9 w-36" />
          <Button onClick={grant} disabled={pending || !amount.trim()}>Add credit</Button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      )}
    </div>
  );
}
