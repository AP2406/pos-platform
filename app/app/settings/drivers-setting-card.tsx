"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setDriversEnabled } from "../drivers/actions";

export function DriversSettingCard({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    setEnabled(next);
    const res = await setDriversEnabled(next);
    setSaving(false);
    if ("error" in res) {
      setEnabled(!next);
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-sm">Drivers</p>
        <p className="text-muted-foreground text-sm">
          Turn on if you have chauffeurs to manage and assign to trips. Leave
          off if you drive everything yourself.
        </p>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={saving}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 " +
          (enabled ? "bg-primary" : "bg-secondary")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
            (enabled ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}