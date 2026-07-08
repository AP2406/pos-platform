"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordTerminalSale } from "./finix-pos-actions";

type OrderSnapshot = {
  items: { catalog_item_id?: string | null; name: string; unit_price: number; quantity: number }[];
  tip?: number;
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  tax_exempt?: boolean;
  tax_exempt_reason_code?: string;
  tax_exempt_reason_note?: string;
  customer_id?: string | null;
  idempotency_key: string;
};

type Card = { brand: string | null; last4: string | null } | null;

type Props = {
  amount: number;
  order: OrderSnapshot;
  onClose: () => void;
  onSuccess: (res: { id: string; sale_number: number; transferId: string; card: Card }) => void;
};

const POLL_MS = 2000;
const MAX_MS = 120000;

type Phase = "starting" | "waiting" | "recording" | "failed" | "error" | "timeout";

export function TerminalPaymentModal(props: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState<string | null>(null);
  const transferRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finalize = useCallback(
    async (card: Card) => {
      setPhase("recording");
      try {
        const res = await recordTerminalSale({
          items: props.order.items,
          tip: props.order.tip,
          discount_type: props.order.discount_type,
          discount_value: props.order.discount_value,
          discount_reason_code: props.order.discount_reason_code,
          discount_reason_note: props.order.discount_reason_note,
          tax_exempt: props.order.tax_exempt,
          tax_exempt_reason_code: props.order.tax_exempt_reason_code,
          tax_exempt_reason_note: props.order.tax_exempt_reason_note,
          customer_id: props.order.customer_id ?? null,
          idempotency_key: props.order.idempotency_key,
          expected_total: props.amount,
          transferId: transferRef.current || "",
        });
        if ("ok" in res) {
          props.onSuccess({ id: res.id, sale_number: res.sale_number, transferId: res.transferId, card });
          return;
        }
        setMessage("declined" in res ? res.message : res.error);
        setPhase("error");
      } catch (e) {
        setMessage("The sale was approved on the terminal but couldn't be saved: " + String(e));
        setPhase("error");
      }
    },
    [props]
  );

  const poll = useCallback(async () => {
    if (cancelledRef.current) return;
    const id = transferRef.current;
    if (!id) return;
    if (Date.now() - startedAtRef.current > MAX_MS) {
      setPhase("timeout");
      return;
    }
    try {
      const r = await fetch("/api/terminal/sale/" + encodeURIComponent(id), { cache: "no-store" });
      const data = await r.json();
      if (cancelledRef.current) return;
      const state = String(data?.state || "").toUpperCase();
      if (state === "SUCCEEDED") {
        clearTimer();
        await finalize((data?.card as Card) ?? null);
        return;
      }
      if (state === "FAILED" || state === "CANCELED") {
        clearTimer();
        setMessage(data?.failure_message || (state === "CANCELED" ? "The sale was canceled on the terminal." : "The card was declined."));
        setPhase("failed");
        return;
      }
      // PENDING / UNKNOWN → keep waiting.
      timerRef.current = setTimeout(poll, POLL_MS);
    } catch {
      // Network blip — keep polling until the max window elapses.
      timerRef.current = setTimeout(poll, POLL_MS);
    }
  }, [finalize]);

  const start = useCallback(async () => {
    cancelledRef.current = false;
    setMessage(null);
    setPhase("starting");
    try {
      const r = await fetch("/api/terminal/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(props.amount * 100), idempotencyKey: props.order.idempotency_key }),
      });
      const data = await r.json();
      if (!r.ok || !data?.transferId) {
        setMessage(data?.error || "Could not start the sale on the terminal.");
        setPhase("error");
        return;
      }
      transferRef.current = data.transferId;
      startedAtRef.current = Date.now();
      setPhase("waiting");
      timerRef.current = setTimeout(poll, POLL_MS);
    } catch (e) {
      setMessage("Could not reach the terminal service: " + String(e));
      setPhase("error");
    }
  }, [props.amount, props.order.idempotency_key, poll]);

  useEffect(() => {
    start();
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel() {
    cancelledRef.current = true;
    clearTimer();
    setPhase("error");
    setMessage("Canceling on the terminal…");
    try {
      await fetch("/api/terminal/cancel", { method: "POST" });
      setMessage("Canceled. You can retry or choose another payment method.");
    } catch {
      setMessage("Couldn't confirm the cancel — check the terminal before retrying.");
    }
  }

  function handleRetry() {
    transferRef.current = null;
    start();
  }

  const busy = phase === "starting" || phase === "waiting" || phase === "recording";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : props.onClose}>
      <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium">Card reader</h3>
          {!busy && (
            <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">
              Close
            </button>
          )}
        </div>
        <div className="text-sm text-muted-foreground mb-3">{"Charge $" + props.amount.toFixed(2)}</div>

        {(phase === "starting" || phase === "waiting" || phase === "recording") && (
          <div className="rounded-lg border border-border p-6 flex flex-col items-center text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-foreground/80 animate-pulse">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 7h8M8 11h8M9 16h6" />
            </svg>
            <div className="text-base font-medium mt-3">
              {phase === "starting" && "Sending to terminal…"}
              {phase === "waiting" && "Waiting for card on terminal…"}
              {phase === "recording" && "Approved — saving sale…"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {phase === "recording" ? "Don't close this screen." : "Ask the customer to tap, insert, or swipe."}
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-center">
            <div className="text-base font-medium text-red-600">Not approved</div>
            <div className="text-sm text-red-600 mt-1">{message}</div>
          </div>
        )}

        {(phase === "error" || phase === "timeout") && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 text-center">
            <div className="text-base font-medium text-amber-700">
              {phase === "timeout" ? "No response from the terminal" : "Something went wrong"}
            </div>
            <div className="text-sm text-amber-700 mt-1">
              {message || (phase === "timeout" ? "The terminal didn't report a result in time. Check it before retrying so the customer isn't charged twice." : "Please try again.")}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {phase === "waiting" && (
            <Button variant="outline" className="w-full h-11" onClick={handleCancel}>
              Cancel on terminal
            </Button>
          )}
          {(phase === "failed" || phase === "error" || phase === "timeout") && (
            <>
              <Button className="flex-1 h-11" onClick={handleRetry}>
                Retry
              </Button>
              <Button variant="outline" className="flex-1 h-11" onClick={props.onClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
