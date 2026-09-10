"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeTabCard } from "./finix-preauth-actions";
import { useFinixCardForm, type FinixConfig } from "./use-finix-card";

// Bar-tab card hold: tokenize a card (hosted Finix fields) and place a pre-auth
// hold on it via authorizeTabCard. At tab close the register captures the hold for
// the final total (tip included); a walked tab releases it. No PAN touches Surge.
type Props = {
  ticketId: string;
  tabName: string | null;
  suggestedHold?: number; // dollars — prefill (e.g. current tab subtotal, or a house default)
  config: FinixConfig;
  onClose: () => void;
  onHeld: (holdCents: number) => void;
};

const CARD_FORM_ID = "surge-tab-hold-form";

export function TabHoldModal(props: Props) {
  const [holdAmount, setHoldAmount] = useState<string>(props.suggestedHold && props.suggestedHold >= 1 ? props.suggestedHold.toFixed(2) : "");
  const [cardholder, setCardholder] = useState<string>(props.tabName || "");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const { sdkReady, initError, tokenize } = useFinixCardForm(props.config, CARD_FORM_ID);

  async function placeHold() {
    const amt = Number(holdAmount);
    if (!(amt >= 1)) {
      setMessage("Enter a hold amount of at least $1.00.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const tok = await tokenize();
    if ("error" in tok) {
      setMessage(tok.error);
      setLoading(false);
      return;
    }
    try {
      const res = await authorizeTabCard({
        ticket_id: props.ticketId,
        hold_amount: amt,
        card: { token: tok.token, fraudSessionId: tok.fraudSessionId, cardholderName: cardholder, buyerEmail: email || undefined },
      });
      if ("ok" in res) {
        props.onHeld(Math.round(amt * 100));
        return;
      }
      if ("declined" in res) {
        setMessage(res.message);
        setLoading(false);
        return;
      }
      setMessage(res.error);
      setLoading(false);
    } catch (e) {
      setMessage("Something went wrong: " + String(e));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={props.onClose}>
      <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium">Hold a card on this tab</h3>
          <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">
            Cancel
          </button>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          Pre-authorize a card now; charge the final total (tip included) at close.
        </div>

        {initError && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">{initError}</div>
        )}

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Hold amount</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={holdAmount}
              onChange={(e) => setHoldAmount(e.target.value)}
              placeholder="e.g. 100.00"
              className="h-9 mt-1"
            />
            <p className="text-[12px] text-muted-foreground mt-1">The hold must cover the whole tab at close — set it high enough for the expected total plus tip.</p>
          </div>
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
            <div id={CARD_FORM_ID} className="mt-1 rounded-md border border-border p-3 min-h-[90px]" />
            {!sdkReady && !initError && <p className="text-xs text-muted-foreground mt-1">Loading secure card fields...</p>}
          </div>
        </div>

        {message && <p className="text-sm text-red-600 mt-3">{message}</p>}

        <Button className="w-full mt-3" onClick={placeHold} disabled={loading || !sdkReady}>
          {loading ? "Placing hold..." : "Place hold"}
        </Button>

        {props.config.environment === "sandbox" && (
          <p className="text-[12px] text-muted-foreground mt-2">Sandbox cards: 4111 1111 1111 1111 approves, 4000 0000 0000 0002 declines.</p>
        )}
        <p className="text-[12px] text-muted-foreground mt-2">
          Card details are entered in a secure field hosted by the payment processor and never touch Surge&rsquo;s servers.
        </p>
      </div>
    </div>
  );
}
