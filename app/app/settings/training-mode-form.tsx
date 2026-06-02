"use client";

import { useState, useTransition } from "react";
import { setTrainingMode } from "./training-actions";

export function TrainingModeForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const res = await setTrainingMode(next);
      if ("error" in res) {
        setError(res.error);
        setEnabled(!next);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">Training mode</p>
          <p className="text-muted-foreground text-sm">
            When on, sales are marked as practice and kept out of your reports,
            cash drawer, and totals. Use it to train staff, then turn it off for
            real business.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={pending}
          className={
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 " +
            (enabled ? "bg-amber-500" : "bg-muted")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white transition-transform " +
              (enabled ? "translate-x-5" : "translate-x-1")
            }
          />
        </button>
      </div>
      {enabled && (
        <p className="text-xs text-amber-500 mt-3">
          Training mode is ON. New sales are practice and won&apos;t count toward
          your real totals.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}