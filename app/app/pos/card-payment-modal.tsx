"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCardOrder } from "./finix-pos-actions";

type OrderSnapshot = {
  items: { catalog_item_id?: string | null; name: string; unit_price: number; quantity: number }[];
  tip?: number;
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  customer_id?: string | null;
  idempotency_key: string;
};

type Props = {
  amount: number;
  order: OrderSnapshot;
  config: { applicationId: string; environment: string; merchantId: string };
  defaultName?: string;
  onClose: () => void;
  onSuccess: (res: { id: string; sale_number: number; transferId: string }) => void;
};

export function CardPaymentModal(props: Props) {
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [cardholder, setCardholder] = useState<string>(props.defaultName || "");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const formRef = useRef<any>(null);
  const fraudRef = useRef<any>(null);
  const attemptRef = useRef<number>(1);

  // Load the Finix SDK once.
  useEffect(function () {
    const w = window as any;
    if (w.Finix) {
      setSdkReady(true);
      return;
    }
    const existing = document.getElementById("finix-sdk");
    if (existing) {
      existing.addEventListener("load", function () {
        setSdkReady(true);
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "finix-sdk";
    script.src = "https://js.finix.com/v/2/finix.js";
    script.async = true;
    script.onload = function () {
      setSdkReady(true);
    };
    script.onerror = function () {
      setInitError("Could not load the secure card library. A VPN, ad blocker, or browser shield may be blocking js.finix.com. Disable it for this site and reopen.");
    };
    document.body.appendChild(script);
  }, []);

  // Build the hosted card fields once the SDK is ready.
  useEffect(
    function () {
      const w = window as any;
      if (!sdkReady || !w.Finix) return;
      if (formRef.current) return;
      try {
        if (typeof w.Finix.PaymentForm !== "function") {
          setInitError("The card library loaded but is missing the payment form.");
          return;
        }
        formRef.current = w.Finix.PaymentForm(
          "surge-pos-card-form",
          props.config.environment,
          props.config.applicationId,
          { onUpdate: function () {} }
        );
        try {
          if (typeof w.Finix.Auth === "function") {
            fraudRef.current = w.Finix.Auth(props.config.environment, props.config.merchantId);
          }
        } catch (e2) {
          fraudRef.current = null;
        }
      } catch (e) {
        setInitError("Could not set up the card fields: " + String(e));
      }
    },
    [sdkReady, props.config.environment, props.config.applicationId, props.config.merchantId]
  );

  function readFraudSession(): string | undefined {
    try {
      const a = fraudRef.current;
      if (a && typeof a.getSessionKey === "function") return a.getSessionKey();
      if (a && typeof a.getSession === "function") return a.getSession();
    } catch (e) {}
    return undefined;
  }

  function handleCharge() {
    if (!formRef.current) {
      setMessage("The card fields aren't ready yet.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      formRef.current.submit(function (error: any, response: any) {
        if (error) {
          setMessage("The card details couldn't be read. Check them and try again.");
          setLoading(false);
          return;
        }
        const tokenData = (response && response.data) || {};
        const token = tokenData.id;
        if (!token) {
          setMessage("The card couldn't be processed. Please try again.");
          setLoading(false);
          return;
        }
        const fraudSessionId = readFraudSession();
        createCardOrder({
          items: props.order.items,
          tip: props.order.tip,
          discount_type: props.order.discount_type,
          discount_value: props.order.discount_value,
          discount_reason_code: props.order.discount_reason_code,
          discount_reason_note: props.order.discount_reason_note,
          customer_id: props.order.customer_id ?? null,
          idempotency_key: props.order.idempotency_key,
          expected_total: props.amount,
          attempt: attemptRef.current,
          card: {
            token: token,
            fraudSessionId: fraudSessionId,
            cardholderName: cardholder,
            buyerEmail: email || undefined,
          },
        })
          .then(function (res) {
            if ("ok" in res) {
              props.onSuccess({ id: res.id, sale_number: res.sale_number, transferId: res.transferId });
              return;
            }
            if ("declined" in res) {
              // Definitive decline - money did not move. Bump the attempt so a
              // retry starts a fresh charge instead of replaying the decline.
              attemptRef.current = attemptRef.current + 1;
              setMessage(res.message);
              setLoading(false);
              return;
            }
            // Ambiguous error - keep the same attempt id so a retry de-dupes.
            setMessage(res.error);
            setLoading(false);
          })
          .catch(function (e) {
            setMessage("Something went wrong: " + String(e));
            setLoading(false);
          });
      });
    } catch (e) {
      setMessage("Could not submit the card: " + String(e));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={props.onClose}>
      <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium">Card payment</h3>
          <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">
            Cancel
          </button>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          {"Charge $" + props.amount.toFixed(2)}
        </div>

        {initError && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {initError}
          </div>
        )}

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Cardholder name</Label>
            <Input value={cardholder} onChange={(e) => setCardholder(e.target.value)} placeholder="Name on card" className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email for receipt (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Card details</Label>
            <div id="surge-pos-card-form" className="mt-1 rounded-md border border-border p-3 min-h-[90px]" />
            {!sdkReady && !initError && (
              <p className="text-xs text-muted-foreground mt-1">Loading secure card fields...</p>
            )}
          </div>
        </div>

        {message && <p className="text-sm text-red-600 mt-3">{message}</p>}

        <Button className="w-full mt-3" onClick={handleCharge} disabled={loading || !sdkReady}>
          {loading ? "Charging..." : "Charge $" + props.amount.toFixed(2)}
        </Button>

        {props.config.environment === "sandbox" && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Sandbox cards: 4111 1111 1111 1111 approves, 4000 0000 0000 0002 declines.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          Card details are entered in a secure field hosted by the payment processor and never touch Surge's servers.
        </p>
      </div>
    </div>
  );
}