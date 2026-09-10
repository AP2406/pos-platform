"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDeviceProfiles } from "./device-profiles-actions";
import type { DeviceProfile } from "@/lib/services/device-profiles";

const DINING: DeviceProfile["default_dining_option"][] = ["dine_in", "takeout", "pickup", "delivery"];
const diningLabel = (d: string) => d.replace("_", " ");

export function DeviceProfilesCard({ initial, canManage }: { initial: DeviceProfile[]; canManage: boolean }) {
  const [profiles, setProfiles] = useState<DeviceProfile[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function patch(id: string, fields: Partial<DeviceProfile>) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }
  function add() {
    setProfiles((prev) => [...prev, { id: crypto.randomUUID(), name: "New profile", default_to_seat: true, default_dining_option: "dine_in" }]);
  }
  function remove(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }
  function save() {
    setMsg(null); setErr(null);
    start(async () => {
      const res = await saveDeviceProfiles(profiles);
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        A profile is a set of register behaviors a device starts with. Each iPad picks a profile at the register (stored on that device), so a dining-room, bar, or takeout-counter device each behave right. Only wired behaviors are here.
      </p>

      {profiles.length > 0 && (
        <div className="space-y-2 mb-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={p.name} disabled={!canManage || pending} onChange={(e) => patch(p.id, { name: e.target.value })} placeholder="Profile name (e.g. Bar)" className="h-9 flex-1" />
                {canManage && <button type="button" onClick={() => remove(p.id)} disabled={pending} className="text-xs text-red-600 underline shrink-0">Remove</button>}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Default dining</span>
                  <select value={p.default_dining_option} disabled={!canManage || pending} onChange={(e) => patch(p.id, { default_dining_option: e.target.value as DeviceProfile["default_dining_option"] })} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm capitalize">
                    {DINING.map((d) => <option key={d} value={d}>{diningLabel(d)}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={p.default_to_seat} disabled={!canManage || pending} onChange={(e) => patch(p.id, { default_to_seat: e.target.checked })} className="h-4 w-4" />
                  Start new items on Seat 1 (table mode)
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Opens (native)</span>
                  <select value={p.home ?? "pos"} disabled={!canManage || pending} onChange={(e) => patch(p.id, { home: e.target.value as DeviceProfile["home"] })} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm">
                    <option value="pos">POS</option>
                    <option value="kds">Kitchen Display</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9" disabled={pending} onClick={add}>Add profile</Button>
          <Button className="h-9" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save profiles"}</Button>
          {msg && <span className="text-xs text-emerald-600">{msg}</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only an owner or manager can edit device profiles.</p>
      )}
    </div>
  );
}
