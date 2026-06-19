"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCoa } from "./coa-actions";

type Row = { key: string; name: string; code: string };

export function CoaCard({ rows: initRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initRows);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function update(key: string, field: "name" | "code", value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await setCoa(rows);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Map each journal line to your accounting software&apos;s account. Used by the
        <span className="font-medium"> Journal (QBO/Xero)</span> export on the Accounting page.
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <Input
              value={r.name}
              onChange={(e) => update(r.key, "name", e.target.value)}
              className="h-8 flex-1 text-sm"
              placeholder="Account name"
            />
            <Input
              value={r.code}
              onChange={(e) => update(r.key, "code", e.target.value)}
              className="h-8 w-28 text-sm"
              placeholder="Code"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save mapping"}</Button>
        {err && <span className="text-sm text-red-600">{err}</span>}
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>
    </div>
  );
}
