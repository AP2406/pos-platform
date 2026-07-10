"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setConfig } from "@/lib/services/config/actions";

type Mode = "none" | "pin" | "async" | "either";
export type Rule = { mode: Mode; threshold: number };

const MODE_OPTS: { value: Mode; label: string }[] = [
  { value: "none", label: "Never — no approval" },
  { value: "pin", label: "Manager PIN" },
  { value: "async", label: "Send to manager queue" },
  { value: "either", label: "PIN or queue" },
];

// Actions whose approval can be scoped to a $ threshold (amount-based). The rest
// (open a drawer, no-sale, close day, reopen) have no amount, so a threshold is
// meaningless — approval is all-or-nothing.
const AMOUNTABLE = new Set(["void", "comp", "discount", "refund", "tax_exempt", "edit_price"]);

export function ApprovalMatrixCard({ actions, initial, orgId, canManage }: {
  actions: { key: string; label: string }[];
  initial: Record<string, Rule>;
  orgId: string;
  canManage: boolean;
}) {
  const [rules, setRules] = useState<Record<string, Rule>>(initial);
  const [pending, start] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function update(key: string, patch: Partial<Rule>) {
    setRules((r) => ({ ...r, [key]: { ...(r[key] ?? { mode: "pin", threshold: 0 }), ...patch } }));
    setSavedKey(null);
  }
  function save(action: string) {
    const rule = rules[action] ?? { mode: "pin", threshold: 0 };
    setErr(null);
    start(async () => {
      const res = await setConfig("approval." + action, "business", orgId, { mode: rule.mode, threshold: Number(rule.threshold) || 0 });
      if ("error" in res) { setErr(res.error); return; }
      setSavedKey(action);
    });
  }

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-3">
      <div className="font-medium text-sm mb-1">Manager approvals</div>
      <p className="text-xs text-muted-foreground mb-3">
        Which register actions need a manager. A threshold means require approval only <em>above</em> that amount (0 = always). Applies to all locations; a cashier with the matching permission/cap is never prompted.
      </p>
      {!orgId && <p className="text-xs text-amber-600 mb-2">Config store not initialized yet (migration 0069).</p>}
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="divide-y divide-border">
        {actions.map((a) => {
          const rule = rules[a.key] ?? { mode: "pin" as Mode, threshold: 0 };
          return (
            <div key={a.key} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-sm w-36 shrink-0">{a.label}</span>
              <select value={rule.mode} disabled={!canManage || pending} onChange={(e) => update(a.key, { mode: e.target.value as Mode })} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm">
                {MODE_OPTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {rule.mode !== "none" && AMOUNTABLE.has(a.key) && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  over $
                  <Input type="number" min="0" step="1" value={String(rule.threshold ?? 0)} disabled={!canManage || pending} onChange={(e) => update(a.key, { threshold: Number(e.target.value) || 0 })} className="h-8 w-20" />
                </label>
              )}
              {canManage && (
                <Button variant="outline" className="h-8" disabled={pending} onClick={() => save(a.key)}>
                  {savedKey === a.key ? "Saved" : "Save"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
