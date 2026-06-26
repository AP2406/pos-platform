"use client";

import { useEffect, useRef, useState } from "react";
import { chargeTokenizedCard } from "./actions";

type ChargeResult =
  | {
      ok: true;
      transferId: string;
      state: string;
      amountCents: number;
      merchantId: string;
      paymentInstrumentId: string;
      buyerIdentityId: string;
      dbPaymentId: string;
    }
  | { error: string; details?: unknown };

type Props = {
  applicationId: string;
  environment: string;
  merchantId: string | null;
};

export default function TokenizedChargeForm(props: Props) {
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("12.50");
  const [cardholder, setCardholder] = useState<string>("Test Customer");
  const [email, setEmail] = useState<string>("customer@example.com");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ChargeResult | null>(null);

  const formRef = useRef<any>(null);
  const fraudRef = useRef<any>(null);

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
      setInitError("Could not load finix.js from js.finix.com. A VPN, Brave Shields, or an ad/tracker blocker is likely blocking it. Try disabling shields for this site or testing in a plain Chrome window.");
    };
    document.body.appendChild(script);
  }, []);

  useEffect(
    function () {
      const w = window as any;
      if (!sdkReady || !w.Finix || !props.merchantId) return;
      if (formRef.current) return;

      try {
        // Finix requires the fraud-detection Auth to initialize BEFORE the form.
        try {
          if (typeof w.Finix.Auth === "function") {
            fraudRef.current = w.Finix.Auth(props.environment, props.merchantId);
          }
        } catch (e2) {
          fraudRef.current = null;
        }

        if (typeof w.Finix.PaymentForm !== "function") {
          setInitError("The Finix SDK loaded but PaymentForm is not available on it.");
          return;
        }

        formRef.current = w.Finix.PaymentForm(
          "finix-card-form",
          props.environment,
          props.applicationId,
          { onUpdate: function () {} }
        );
      } catch (e) {
        setInitError("Card field setup failed: " + String(e));
      }
    },
    [sdkReady, props.merchantId, props.environment, props.applicationId]
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
      setResult({ error: "Card form not ready yet." });
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      formRef.current.submit(function (error: any, response: any) {
        if (error) {
          setResult({ error: "Card tokenization failed in the browser.", details: error });
          setLoading(false);
          return;
        }

        const tokenData = (response && response.data) || {};
        const token = tokenData.id;
        if (!token) {
          setResult({ error: "No token returned from the browser form." });
          setLoading(false);
          return;
        }

        const fraudSessionId = readFraudSession();

        chargeTokenizedCard({
          amountDollars: Number(amount),
          token: token,
          fraudSessionId: fraudSessionId,
          cardholderName: cardholder,
          buyerEmail: email || undefined,
        })
          .then(function (res) {
            setResult(res);
            setLoading(false);
          })
          .catch(function (e) {
            setResult({ error: "Request threw: " + String(e) });
            setLoading(false);
          });
      });
    } catch (e) {
      setResult({ error: "Submit threw: " + String(e) });
      setLoading(false);
    }
  }

  const inputStyle = {
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 14,
  };

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Tokenized card charge</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
        The card fields below are hosted by Finix in an iframe - the raw card
        number never reaches the Surge server. Only a one-time token does.
      </p>

      {initError ? (
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#991b1b" }}>
          {initError}
        </div>
      ) : null}

      {!props.merchantId ? (
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13 }}>
          This business has no Finix merchant yet. Onboard it first at /app/debug/onboard.
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Amount (CAD)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Cardholder</span>
          <input value={cardholder} onChange={(e) => setCardholder(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, gridColumn: "1 / span 2" }}>
          <span style={{ color: "#555" }}>Buyer email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <span style={{ color: "#555", fontSize: 13 }}>Card details (hosted by Finix)</span>
        <div
          id="finix-card-form"
          style={{ marginTop: 6, padding: 12, border: "1px solid #ccc", borderRadius: 8, minHeight: 90 }}
        />
        {!sdkReady && !initError ? (
          <p style={{ color: "#888", fontSize: 12, marginTop: 6 }}>Loading secure card fields...</p>
        ) : null}
      </div>

      <button
        onClick={handleCharge}
        disabled={loading || !sdkReady || !props.merchantId}
        style={{
          marginTop: 16,
          padding: "10px 18px",
          background: loading || !sdkReady || !props.merchantId ? "#94a3b8" : "#2563EB",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Charging..." : "Tokenize and charge"}
      </button>

      <p style={{ color: "#888", fontSize: 12, marginTop: 10 }}>
        Finix sandbox cards: 4111 1111 1111 1111 succeeds, 4000 0000 0000 0002 declines.
      </p>

      {result ? (
        <pre
          style={{
            marginTop: 16,
            whiteSpace: "pre-wrap",
            background: "ok" in result ? "#ecfdf5" : "#fef2f2",
            border: "1px solid " + ("ok" in result ? "#a7f3d0" : "#fecaca"),
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}