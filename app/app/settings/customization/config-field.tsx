"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setConfig, resetConfig, setUserPref, resetUserPref, type ConfigOverview } from "@/lib/services/config/actions";

// Serializable subset of a ConfigKeyDef (no functions) passed from the server.
export type ClientConfigDef = {
  key: string;
  type: "boolean" | "number" | "string" | "string[]" | "number[]" | "json";
  label: string;
  description?: string;
  options?: { value: string | number | boolean; label: string }[];
  scopes: ("business" | "location" | "user")[];
};

const SOURCE_LABEL: Record<string, string> = {
  user: "your preference", role: "role", location: "this location", business: "all locations", legacy: "current setting", default: "default",
};

function ScopeRow({ def, label, current, onSave, onReset, pending }: {
  def: ClientConfigDef; label: string; current: unknown;
  onSave: (v: unknown) => void; onReset: () => void; pending: boolean;
}) {
  const overridden = current !== undefined && current !== null;
  const [val, setVal] = useState<string>(overridden ? String(current) : "");
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      {def.options ? (
        <select value={val} onChange={(e) => setVal(e.target.value)} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm">
          <option value="">— inherited —</option>
          {def.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      ) : (
        <Input value={val} onChange={(e) => setVal(e.target.value)} inputMode={def.type === "number" ? "decimal" : undefined} placeholder="inherited" className="h-8 w-40" />
      )}
      <Button variant="outline" className="h-8" disabled={pending || val === ""} onClick={() => onSave(def.type === "number" ? Number(val) : val)}>Set</Button>
      {overridden && <button onClick={onReset} disabled={pending} className="text-[11px] underline text-muted-foreground">reset</button>}
      {overridden && <span className="text-[11px] text-emerald-600">overridden</span>}
    </div>
  );
}

export function ConfigField({ def, overview, canManage, orgId, locationId }: { def: ClientConfigDef; overview: ConfigOverview; canManage: boolean; orgId: string; locationId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setErr(null);
    start(async () => { const r = await fn(); if ("error" in r) setErr(r.error); });
  };
  const fmt = (v: unknown) => (v === null || v === undefined ? "—" : def.options ? (def.options.find((o) => String(o.value) === String(v))?.label ?? String(v)) : String(v));

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="font-medium text-sm">{def.label}</div>
        <div className="text-[11px] text-muted-foreground">{overview.overridden ? "Overridden" : "Inherited"} · from {SOURCE_LABEL[overview.source] ?? overview.source}</div>
      </div>
      {def.description && <p className="text-xs text-muted-foreground mb-2">{def.description}</p>}
      <div className="text-sm mb-2">Effective: <span className="font-medium">{fmt(overview.resolved)}</span></div>

      <div className="border-t border-border pt-2">
        {def.scopes.includes("user") && (
          <ScopeRow def={def} label="Your preference" current={overview.atUser} pending={pending}
            onSave={(v) => run(() => setUserPref(def.key, v))} onReset={() => run(() => resetUserPref(def.key))} />
        )}
        {canManage && def.scopes.includes("location") && (
          <ScopeRow def={def} label="This location" current={overview.atLocation} pending={pending}
            onSave={(v) => run(() => setConfig(def.key, "location", locationId, v))} onReset={() => run(() => resetConfig(def.key, "location", locationId))} />
        )}
        {canManage && def.scopes.includes("business") && (
          <ScopeRow def={def} label="All locations" current={overview.atBusiness} pending={pending}
            onSave={(v) => run(() => setConfig(def.key, "business", orgId, v))} onReset={() => run(() => resetConfig(def.key, "business", orgId))} />
        )}
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}
