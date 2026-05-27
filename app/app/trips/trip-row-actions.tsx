"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  togglePaymentCollected,
  toggleCookieCollected,
} from "./[id]/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripData = any;

export function TripRowActions({ trip }: { trip: TripData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid(collected: boolean) {
    startTransition(async () => {
      await togglePaymentCollected(trip.id, collected);
      router.refresh();
    });
  }

  function handleMarkCookie(collected: boolean) {
    startTransition(async () => {
      await toggleCookieCollected(trip.id, collected);
      router.refresh();
    });
  }

  return (
    <div className="p-4 flex flex-col items-end justify-between gap-2 shrink-0 min-w-[140px]">
      <div className="text-right">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          {trip.pricing_type === "hourly" && trip.hours
            ? `${trip.hours}h`
            : "Flat"}
        </div>
        <div className="font-semibold text-base mt-0.5">
          ${parseFloat(trip.price_total).toFixed(2)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {/* Payment status */}
        {trip.payment_collected ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleMarkPaid(false)}
            title="Click to unmark"
            className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition"
          >
            ✓ Paid
          </button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleMarkPaid(true)}
            className="h-7 text-xs"
          >
            Mark paid
          </Button>
        )}

        {/* Cookie status (partner trips only) */}
        {trip.handled_by === "partner" &&
          trip.cookie_amount != null &&
          (trip.cookie_collected ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleMarkCookie(false)}
              title="Click to unmark"
              className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
            >
              🍪 ${parseFloat(trip.cookie_amount).toFixed(2)} ✓
            </button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleMarkCookie(true)}
              className="h-7 text-xs"
            >
              Collect 🍪 ${parseFloat(trip.cookie_amount).toFixed(2)}
            </Button>
          ))}
      </div>
    </div>
  );
}