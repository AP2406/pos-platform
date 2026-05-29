"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refundTrip } from "../actions";

export function RefundDialog({
  tripId,
  tripPrice,
  trigger,
}: {
  tripId: string;
  tripPrice: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(tripPrice.toFixed(2));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAmount(tripPrice.toFixed(2));
    setReason("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await refundTrip({
      id: tripId,
      amount: parseFloat(amount),
      reason,
    });
    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
    } else {
      setOpen(false);
      reset();
      router.refresh();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
          <DialogDescription>
            This records the refund in Surge. You&apos;ll still need to process
            the actual payment refund in your processor&apos;s dashboard
            (Square / Finix).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund_amount">Refund amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="refund_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={tripPrice}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="pl-7 tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Max ${tripPrice.toFixed(2)} (trip total)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund_reason">Reason</Label>
            <Input
              id="refund_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Customer canceled / no-show / service issue / etc."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording..." : "Record refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}