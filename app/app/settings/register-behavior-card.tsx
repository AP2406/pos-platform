"use client";

import { useState, useTransition } from "react";
import { setRegisterPrefs, type RegisterPrefs } from "./register-prefs-actions";

const TOGGLES: { key: keyof RegisterPrefs; label: string; help: string }[] = [
  { key: "auto_proceed", label: "Auto-proceed to order entry", help: "Tapping a table or the register opens order entry immediately." },
  { key: "send_all", label: "Show “Send all” button", help: "Adds a one-tap button to fire every unsent item to the kitchen." },
  { key: "email_receipt_prompt", label: "Offer email receipt at checkout", help: "Prompt to email the receipt once a sale completes." },
  { key: "auto_close_forced_modifiers", label: "Auto-close forced modifiers", help: "Close the modifier sheet automatically once required groups are satisfied." },
  { key: "allow_discounts_on_alcohol", label: "Allow discounts on alcohol", help: "Permit line discounts on items whose sales category is alcohol." },
  { key: "show_modifier_category", label: "Show modifier category on line", help: "Display the modifier group name alongside each choice." },
  { key: "default_to_seat", label: "Default to Seat 1", help: "New items default to Seat 1 when a table is open." },
  { key: "lock_menu_view", label: "Lock menu view", help: "Hide the grid/list menu-view toggle in the register." },
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
