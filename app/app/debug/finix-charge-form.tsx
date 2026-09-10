"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { chargeTestCard } from "./finix-charge-actions";

const TEST_CARDS = [
  { label: "Visa — success", number: "4242 4242 4242 4242" },
  { label: "Mastercard — success", number: "5200 8282 8282 8210" },
  { label: "Amex — success", number: "3782 8224 6310 005" },
  { label: "Visa — declined", number: "4000 0000 0000 0002" },
];

type ChargeResult = Awaited<ReturnType<typeof chargeTestCard>>;

export function FinixChargeForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ChargeResult | null>(null);

  const [amount, setAmount] = useState("12.50");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expMonth, setExpMonth] = useState("12");
  const [expYear, setExpYear] = useState("2030");
  const [cvv, setCvv] = useState("123");
  const [name, setName] = useState("Aathis Test");
  const [email, setEmail] = useState("test@example.com");

  function handleCharge() {
    setResult(null);
    startTransition(async () => {
      const r = await chargeTestCard({
        amountDollars: parseFloat(amount) || 0,
        cardNumber,
        cardExpMonth: parseInt(expMonth, 10),
        cardExpYear: parseInt(expYear, 10),
        cardCvv: cvv,
        cardholderName: name,
        buyerEmail: email || undefined,
      });
      setResult(r);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mr-1 self-center">
          Test cards:
        </span>
        {TEST_CARDS.map((c) => (
          <button
            key={c.number}
            type="button"
            onClick={() => setCardNumber(c.number)}
            className="px-2 py-0.5 text-xs border border-border rounded hover:bg-accent transition-colors"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Amount (USD)</label>
          <input
            type="number"
            step="0.01"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cardholder</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">Card number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Exp month</label>
          <input
            type="number"
            min="1"
            max="12"
            value={expMonth}
            onChange={(e) => setExpMonth(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Exp year</label>
          <input
            type="number"
            min="2025"
            max="2040"
            value={expYear}
            onChange={(e) => setExpYear(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">CVV</label>
          <input
            type="text"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Buyer email (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
        </div>
      </div>

      <Button onClick={handleCharge} disabled={isPending}>
        {isPending ? "Processing…" : "Charge test card"}
      </Button>

      {result && "ok" in result && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2">
          <div className="text-sm font-medium text-green-900">
            ✓ Charge {result.state}
          </div>
          <div className="text-xs text-green-800 space-y-1">
            <div>
              Amount: ${(result.amountCents / 100).toFixed(2)} USD
            </div>
            <div>Finix Transfer: {result.transferId}</div>
            <div>Payment Instrument: {result.paymentInstrumentId}</div>
            <div>Buyer Identity: {result.buyerIdentityId}</div>
            <div>Surge DB row: {result.dbPaymentId}</div>
          </div>
        </div>
      )}

      {result && "error" in result && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-2">
          <div className="text-sm font-medium text-red-900">✗ Failed</div>
          <div className="text-xs text-red-800">{result.error}</div>
          {result.details ? (
            <pre className="text-[12px] bg-white border border-red-200 rounded p-2 overflow-x-auto text-gray-700 mt-2">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}