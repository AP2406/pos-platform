"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateTripStatus,
  togglePaymentCollected,
  toggleCookieCollected,
  deleteTrip,
} from "../actions";
import { RefundDialog } from "./refund-dialog";

type TripStatus =
  | "booked"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

const statusOptions: { value: TripStatus; label: string }[] = [
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

export function TripControls({
  tripId,
  tripPrice,
  tripStatus,
  handledBy,
  paymentCollected,
  cookieCollected,
  cookieAmount,
  refundStatus,
  refundAmount,
  refundReason,
  refundedAt,
}: {
  tripId: string;
  tripPrice: number;
  tripStatus: string;
  handledBy: "self" | "partner";
  paymentCollected: boolean;
  cookieCollected: boolean;
  cookieAmount: number | null;
  refundStatus: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  refundedAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isRefunded = refundStatus === "completed";
  const canRefund = paymentCollected && !isRefunded;

  function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  async function handleDelete() {
    if (!confirm("Delete this trip? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTrip(tripId);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push("/app/trips");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Status switcher */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
          Status
        </div>
        <div className="grid grid-cols-3 gap-2">
          {statusOptions.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={isPending}
              onClick={() => run(() => updateTripStatus(tripId, s.value))}
              className={`px-3 py-2 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                tripStatus === s.value
                  ? "border-foreground bg-accent font-medium"
                  : "border-border hover:border-foreground/40 hover:bg-accent/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Money tracking */}
      <div className="space-y-2 pt-4 border-t border-border">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2">
          Money
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium">
              {paymentCollected ? "✓ Customer paid" : "Customer payment"}
            </div>
            <div className="text-xs text-muted-foreground">
              {paymentCollected ? "Marked as collected" : "Not collected yet"}
            </div>
          </div>
          <Button
            variant={paymentCollected ? "outline" : "default"}
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => togglePaymentCollected(tripId, !paymentCollected))
            }
          >
            {paymentCollected ? "Mark unpaid" : "Mark paid"}
          </Button>
        </div>

        {handledBy === "partner" && cookieAmount != null && (
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <div className="text-sm font-medium tabular-nums">
                {cookieCollected ? "✓ " : ""}🍪 Cookie ${cookieAmount.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {cookieCollected
                  ? "Partner paid you"
                  : "Partner still owes you this"}
              </div>
            </div>
            <Button
              variant={cookieCollected ? "outline" : "default"}
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() => toggleCookieCollected(tripId, !cookieCollected))
              }
            >
              {cookieCollected ? "Unmark" : "Mark collected"}
            </Button>
          </div>
        )}
      </div>

      {/* Refund */}
      {(canRefund || isRefunded) && (
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2">
            Refund
          </div>

          {isRefunded ? (
            <div className="py-2 space-y-1">
              <div className="text-sm font-medium tabular-nums text-red-600">
                − ${(refundAmount ?? 0).toFixed(2)} refunded
              </div>
              {refundReason && (
                <div className="text-xs text-muted-foreground">
                  Reason: {refundReason}
                </div>
              )}
              {refundedAt && (
                <div className="text-xs text-muted-foreground">
                  {new Date(refundedAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · Remember to process the actual refund in your processor's dashboard."}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">Issue refund</div>
                <div className="text-xs text-muted-foreground">
                  Record a refund for this trip
                </div>
              </div>
              <RefundDialog
                tripId={tripId}
                tripPrice={tripPrice}
                trigger={
                  <Button variant="outline" size="sm" disabled={isPending}>
                    Refund…
                  </Button>
                }
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="pt-4 border-t border-border">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
        >
          Delete trip
        </button>
      </div>
    </div>
  );
}