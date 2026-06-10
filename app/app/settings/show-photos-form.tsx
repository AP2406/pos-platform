"use client";

import { useState, useTransition } from "react";
import { setShowItemPhotos } from "./show-photos-actions";

export function ShowPhotosForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const res = await setShowItemPhotos(next);
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
          <p className="font-medium text-sm">Show item photos on the register</p>
          <p className="text-muted-foreground text-sm">
            When on, items with a photo show it on their register tile. Turn it
            off to force the color-coded tiles for every item, even ones that
            have a photo.
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
            (enabled ? "bg-emerald-500" : "bg-muted")
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
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
