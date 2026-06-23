"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postIntercompanyTransfer } from "./actions";

export function IntercompanyForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [to, setTo] = useState(locations[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [offset, setOffset] = useState("Cash");
  const [code, setCode] = useState("1000");
  const [memo, setMemo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (locations.length === 0) {
    return <p className="text-sm text-muted-foreground">Inter-location transfers need a second location you manage.</p>;
  }

  function post() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await postIntercompanyTransfer({ toBusinessId: to, amount: Number(amount) || 0, offsetName: offset, offsetCode: code, memo });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Posted balanced due-to / due-from entries in both locations."); setAmount(""); setMemo("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">To location</Label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-44 rounded-md border border-border bg-transparent px-2 text-sm">
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Amount</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-28" /></div>
        <div className="space-y-1"><Label className="text-xs">Offset account</Label><Input value={offset} onChange={(e) => setOffset(e.target.value)} className="h-9 w-36" /></div>
        <div className="space-y-1"><Label className="text-xs">Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9 w-20" /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Memo</Label><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Cash sweep / shared purchase" className="h-9 max-w-md" /></div>
      <div className="flex items-center gap-3">
        <Button onClick={post} disabled={pending || !amount}>Post transfer</Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
