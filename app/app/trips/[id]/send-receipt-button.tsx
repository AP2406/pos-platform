"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendBrandedReceipt } from "../invoice-actions";

export function SendReceiptButton({
  tripId,
  customerEmail,
  tripStatus,
  brandedReceiptSentAt,
}: {
  tripId: string;
  customerEmail: string | null;
  tripStatus: string;
  brandedReceiptSentAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const hasEmail = !!customerEmail;
  const isCompleted = tripStatus === "completed";
  const wasSent = !!brandedReceiptSentAt;

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendBrandedReceipt(tripId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setJustSent(true);
        router.refresh();
      }
    });
  }

  if (!hasEmail) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a customer with an email address to send a receipt.
      </p>
    );
  }

  if (!isCompleted) {
    return (
      <p className="text-xs text-muted-foreground">
        Mark trip completed before sending the receipt.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {wasSent && !justSent && (
        <p className="text-xs text-muted-foreground">
          Last sent {new Date(brandedReceiptSentAt!).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
      {justSent && (
        <p className="text-xs text-green-700">✓ Receipt sent to {customerEmail}</p>
      )}
      <Button
        variant={wasSent ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={handleSend}
      >
        {isPending ? "Sending…" : wasSent ? "Resend receipt" : "Send receipt"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}