"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSquareInvoiceForTrip } from "../actions";

export function CreateInvoiceButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await createSquareInvoiceForTrip(tripId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={loading} size="sm">
        {loading ? "Creating..." : "Create invoice on Square"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600 text-right max-w-xs">{error}</p>
      ) : null}
    </div>
  );
}