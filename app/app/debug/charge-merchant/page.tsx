"use client";

import { useState } from "react";
import { chargeIntoSubMerchant } from "../finix-submerchant-charge-actions";

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

export default function ChargeMerchantPage() {
  const [amount, setAmount] = useState<string>("12.50");
  const [cardholder, setCardholder] = useState<string>("Test Customer");
  const [cardNumber, setCardNumber] = useState<string>("4111 1111 1111 1111");
  const [expMonth, setExpMonth] = useState<string>("12");
  const [expYear, setExpYear] = useState<string>("2030");
  const [cvv, setCvv] = useState<string>("123");
  const [email, setEmail] = useState<string>("customer@example.com");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ChargeResult | null>(null);

  const inputStyle = {
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 8,
    fontSize: 14,
  };

  async function handleCharge() {
    setLoading(true);
    setResult(null);
    try {
      const res = await chargeIntoSubMerchant({
        amountDollars: Number(amount),
        cardNumber: cardNumber,
        cardExpMonth: Number(expMonth),
        cardExpYear: Number(expYear),
        cardCvv: cvv,
        cardholderName: cardholder,
        buyerEmail: email || undefined,
      });
      setResult(res);
    } catch (e) {
      setResult({ error: "Request threw: " + String(e) });
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Charge into sub-merchant</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
        Charges a sandbox card into the current business&rsquo;s own Finix merchant
        (its stored MU id), in CAD, and records it in finix_payments.
      </p>

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
          <span style={{ color: "#555" }}>Card number</span>
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Exp month</span>
          <input value={expMonth} onChange={(e) => setExpMonth(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Exp year</span>
          <input value={expYear} onChange={(e) => setExpYear(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>CVV</span>
          <input value={cvv} onChange={(e) => setCvv(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "#555" }}>Buyer email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <button
        onClick={handleCharge}
        disabled={loading}
        style={{
          marginTop: 20,
          padding: "10px 18px",
          background: loading ? "#94a3b8" : "#2563EB",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Charging..." : "Charge into this merchant"}
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