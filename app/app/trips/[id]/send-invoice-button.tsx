"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendBrandedInvoice } from "../invoice-actions";

export function SendInvoiceButton({
  tripId,
  customerEmail,
  squareInvoiceUrl,
  brandedInvoiceSentAt,
}: {
  tripId: string;
  customerEmail: string | null;
  squareInvoiceUrl: string | null;
  brandedInvoiceSentAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const hasEmail = !!customerEmail;
  const hasInvoice = !!squareInvoiceUrl;
  const canSend = hasEmail && hasInvoice;
  const wasSent = !!brandedInvoiceSentAt;

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendBrandedInvoice(tripId);
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
        Add a customer with an email address to send a branded invoice.
      </p>
    );
  }

  if (!hasInvoice) {
    return (
      <p className="text-xs text-muted-foreground">
        Square invoice not yet created. Book the trip first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {wasSent && !justSent && (
        <p className="text-xs text-muted-foreground">
          Last sent {new Date(brandedInvoiceSentAt!).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
      {justSent && (
        <p className="text-xs text-green-700">✓ Invoice email sent to {customerEmail}</p>
      )}
      <Button
        variant={wasSent ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={handleSend}
      >
        {isPending ? "Sending…" : wasSent ? "Resend invoice" : "Send branded invoice"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}