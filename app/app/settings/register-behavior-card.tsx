"use client";

import { useState, useTransition } from "react";
import { setRegisterPrefs, type RegisterPrefs } from "./register-prefs-actions";

// Only toggles that are actually wired into register behavior are shown — no
// dead switches. More are added here as their behaviors land (the RegisterPrefs
// type keeps the full set for forward-compat).
const TOGGLES: { key: keyof RegisterPrefs; label: string; help: string }[] = [
  { key: "default_to_seat", label: "Default to Seat 1", help: "New items default to Seat 1 when a table is open (off = start on Shared)." },
];

export function RegisterBehaviorCard({ initial }: { initial: Partial<RegisterPrefs> }) {
  const [prefs, setPrefs] = useState<Partial<RegisterPrefs>>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof RegisterPrefs) {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await setRegisterPrefs({ [key]: next } as Partial<RegisterPrefs>);
      if ("error" in res) {
        setError(res.error);
        setPrefs((p) => ({ ...p, [key]: !next })); // revert on failure
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Register behavior</h2>
        {pending ? <span className="text-xs text-muted-foreground">Saving…</span> : saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Advanced order-entry options.</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 space-y-3">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={!!prefs[t.key]} onChange={() => toggle(t.key)} disabled={pending} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.help}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
