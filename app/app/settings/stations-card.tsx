"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createKitchenStation,
  renameKitchenStation,
  deleteKitchenStation,
  type KitchenStation,
} from "../kitchen/stations-actions";

export function StationsCard({ initial }: { initial: KitchenStation[] }) {
  const [stations, setStations] = useState<KitchenStation[]>(initial);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const name = newName.trim();
    if (!name) return;
    setErr(null);
    startTransition(async () => {
      const res = await createKitchenStation(name);
      if ("error" in res) { setErr(res.error); return; }
      setStations((prev) => [...prev, res.station]);
      setNewName("");
    });
  }

  function rename(id: string, name: string) {
    setStations((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    startTransition(async () => { await renameKitchenStation(id, name); });
  }

  function remove(id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteKitchenStation(id);
      if ("error" in res) { setErr(res.error); return; }
      setStations((prev) => prev.filter((s) => s.id !== id));
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Prep stations split a fired ticket across kitchen screens — assign menu items to a station in Catalog, and when a table fires, each station sees only its own work. With no stations, the kitchen shows one combined ticket as before.
      </p>
      <div className="space-y-2">
        {stations.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <Input value={s.name} onChange={(e) => rename(s.id, e.target.value)} className="h-9 flex-1" />
            <button type="button" onClick={() => remove(s.id)} disabled={pending} className="text-xs text-red-600 underline">Remove</button>
          </div>
        ))}
        {stations.length === 0 && <p className="text-xs text-muted-foreground">No stations yet.</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a station (e.g. Grill)" className="h-9 flex-1" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <Button onClick={add} disabled={pending || !newName.trim()}>Add</Button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
