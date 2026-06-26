"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCardOrder } from "./finix-pos-actions";
import { collectTapToPay } from "@/lib/services/tap-to-pay";

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

type Props = {
  amount: number;
  order: OrderSnapshot;
  config: { applicationId: string; environment: string; merchantId: string };
  defaultName?: string;
  tapToPay?: boolean; // GAP-1 (5/5): collect the card via the native Tap to Pay SDK instead of hosted fields
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
  const attemptRef = useRef<number>(Math.floor(Math.random() * 1000000000) + 1);

  useEffect(function () {
    if (props.tapToPay) return; // Tap to Pay uses the native SDK, not Finix.js hosted fields
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

  useEffect(
    function () {
      if (props.tapToPay) return;
      const w = window as any;
      if (!sdkReady || !w.Finix) return;
      if (formRef.current) return;
      try {
        // Finix requires the fraud-detection Auth to initialize BEFORE the payment
        // form so it can instrument the page; the session key it produces must ride
        // on the first charge (fraud_session_id) for certification.
        try {
          if (typeof w.Finix.Auth === "function") {
            fraudRef.current = w.Finix.Auth(props.config.environment, props.config.merchantId);
          }
        } catch (e2) {
          fraudRef.current = null;
        }
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
        if (!fraudSessionId) console.warn("Finix: fraud_session_id missing at charge time — fraud Auth may not have initialized.");
        chargeWithToken(token, fraudSessionId);
      });
    } catch (e) {
      setMessage("Could not submit the card: " + String(e));
      setLoading(false);
    }
  }

  // Shared charge path for both manual entry and Tap to Pay — both produce a Finix
  // token, then run the identical createCardOrder (charge + record + reverse-on-fail).
  function chargeWithToken(token: string, fraudSessionId?: string) {
    createCardOrder({
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
          attemptRef.current = attemptRef.current + 1;
          setMessage(res.message);
          setLoading(false);
          return;
        }
        setMessage(res.error);
        setLoading(false);
      })
      .catch(function (e) {
        setMessage("Something went wrong: " + String(e));
        setLoading(false);
      });
  }

  // Tap to Pay: ask the native SDK to read the contactless card, then charge.
  async function handleTap() {
    setLoading(true);
    setMessage(null);
    const collected = await collectTapToPay({
      amountCents: Math.round(props.amount * 100),
      currency: "CAD",
      merchantId: props.config.merchantId,
      applicationId: props.config.applicationId,
      environment: props.config.environment,
    });
    if ("error" in collected) {
      setMessage(collected.error);
      setLoading(false);
      return;
    }
    chargeWithToken(collected.token);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={props.onClose}>
      <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium">{props.tapToPay ? "Tap to Pay" : "Card payment"}</h3>
          <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">
            Cancel
          </button>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          {"Charge $" + props.amount.toFixed(2)}
        </div>

        {props.tapToPay ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-6 flex flex-col items-center text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-foreground/80">
                <path d="M5 12h.01M9 7a5 5 0 0 1 0 10M13 4a9 9 0 0 1 0 16" />
              </svg>
              <div className="text-base font-medium mt-3">Hold the card or phone near the top of the device</div>
              <div className="text-xs text-muted-foreground mt-1">Contactless — encrypted by the payment processor.</div>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <Button className="w-full h-12" onClick={handleTap} disabled={loading}>
              {loading ? "Waiting for tap…" : "Start tap · $" + props.amount.toFixed(2)}
            </Button>
          </div>
        ) : (
        <>
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
        </>
        )}
      </div>
    </div>
  );
}