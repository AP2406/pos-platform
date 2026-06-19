"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMergeCandidates, mergeCustomers } from "../actions";

type Candidate = { id: string; name: string; phone: string | null; email: string | null };

// Merge a duplicate customer INTO this one (the keeper). Owner/manager only.
export function MergeCustomer({ keepId, keepName }: { keepId: string; keepName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [merging, startMerge] = useTransition();

  function load(q: string) {
    setQuery(q);
    startSearch(async () => setCandidates(await listMergeCandidates(keepId, q)));
  }
  function openPanel() {
    setOpen(true);
    setError(null);
    setPicked(null);
    load("");
  }
  function doMerge() {
    if (!picked) return;
    setError(null);
    startMerge(async () => {
      const res = await mergeCustomers(keepId, picked.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setPicked(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={openPanel} className="text-xs text-muted-foreground underline hover:text-foreground">
        Merge a duplicate…
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">
      {picked ? (
        <div className="space-y-2">
          <p>
            Merge <span className="font-medium">{picked.name}</span> into <span className="font-medium">{keepName}</span>?
          </p>
          <p className="text-xs text-muted-foreground">
            Their orders, loyalty points, store-credit balance and notes move to {keepName}, and the duplicate record is deleted. This can&apos;t be undone.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={doMerge} disabled={merging}>
              {merging ? "Merging…" : "Merge & delete duplicate"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPicked(null)} disabled={merging}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Merge a duplicate into {keepName}</span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
          </div>
          <Input value={query} onChange={(e) => load(e.target.value)} placeholder="Search the duplicate by name, phone or email" className="h-9" autoFocus />
          <div className="max-h-56 overflow-y-auto divide-y divide-border rounded-md border border-border">
            {searching && candidates.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Searching…</p>
            ) : candidates.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No other customers found.</p>
            ) : (
              candidates.map((c) => (
                <button key={c.id} type="button" onClick={() => { setPicked(c); setError(null); }} className="w-full text-left p-2.5 hover:bg-accent transition-colors">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join("  ·  ") || "No contact info"}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
