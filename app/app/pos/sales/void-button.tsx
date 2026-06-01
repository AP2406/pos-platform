"use client";

import { useState, useTransition } from "react";
import { voidOrder } from "../actions";

export function VoidButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleVoid() {
    setError(null);
    startTransition(async () => {
      const res = await voidOrder(orderId);
      if ("error" in res) {
        setError(res.error);
        setConfirming(false);
      }
      // On success, revalidatePath refreshes the server list automatically.
    });
  }

  if (error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted-foreground underline hover:text-foreground"
      >
        Void
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleVoid}
        disabled={pending}
        className="text-xs text-red-600 underline hover:text-red-700"
      >
        {pending ? "Voiding..." : "Confirm void"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-muted-foreground underline"
      >
        Cancel
      </button>
    </span>
  );
}