"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveKitchenTicketConfig } from "./kitchen-ticket-actions";
import { type KitchenTicketConfig } from "@/lib/services/kitchen-ticket-config";

const FIELDS: { key: keyof KitchenTicketConfig; label: string; hint: string }[] = [
  { key: "show_station_header", label: "Station name header", hint: "Print the station name at the top of each chit" },
  { key: "show_seat", label: "Seat number", hint: "Show the seat each item belongs to (e.g. S2)" },
  { key: "show_note", label: "Item notes", hint: "Print kitchen notes (“no onions”)" },
  { key: "show_allergens", label: "Allergens", hint: "Print allergen warnings in bold red" },
  { key: "show_prep_time", label: "Prep time", hint: "Print each item’s prep minutes" },
  { key: "show_fire_time", label: "Fire time", hint: "Print the time the ticket fired" },
];

export function KitchenTicketCard({ initial }: { initial: KitchenTicketConfig }) {
  const [cfg, setCfg] = useState<KitchenTicketConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(key: keyof KitchenTicketConfig) {
    setSaved(false);
    setCfg((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await saveKitchenTicketConfig(cfg);
      if ("error" in res) { setErr(res.error); return; }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose what prints on a fired kitchen ticket / station chit. Applies to both the KDS printer fallback and per-station chit printing. Allergens are on by default for safety.
      </p>
      <div className="space-y-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={cfg[f.key]} onChange={() => toggle(f.key)} className="h-4 w-4 mt-0.5" />
            <span>
              <span className="font-medium">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {saved && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </div>
  );
}
