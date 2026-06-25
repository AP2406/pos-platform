"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGuestCheck, payGuestCheck, type GuestCheckView } from "./pay-actions";

const money = (n: number) => "$" + (Number(n) || 0).toFixed(2);

// Finix.js (hosted card fields) injected at runtime. The card data is tokenized in
// the browser — a raw PAN never reaches our server. Types are loose because the SDK
// is loaded from a <script>, not bundled.
type FinixForm = { submit: (env: string, appId: string, cb: (err: unknown, res: { data?: { id?: string } }) => void) => void };
type FinixGlobal = {
  CardTokenForm: (containerId: string, opts: Record<string, unknown>) => FinixForm;
  Auth?: (env: string, appId: string) => { getSessionKey?: () => string };
};
declare global {
  interface Window { Finix?: FinixGlobal }
}

const FINIX_SRC = "https://js.finix.com/v/1/finix.js";

function loadFinix(): Promise<FinixGlobal | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.Finix) return resolve(window.Finix);
    const existing = document.querySelector<HTMLScriptElement>("script[data-finix]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Finix ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const s = document.createElement("script");
    s.src = FINIX_SRC;
    s.async = true;
    s.dataset.finix = "1";
    s.onload = () => resolve(window.Finix ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

const TIP_PCTS = [0, 0.15, 0.18, 0.2];

export function PayPanel({
  businessId,
  elementId,
  finixAppId,
  finixEnv,
  onClose,
}: {
  businessId: string;
  elementId: string;
  finixAppId: string;
  finixEnv: string; // "sandbox" | "live"
  onClose: () => void;
}) {
  const [check, setCheck] = useState<GuestCheckView | null>(null);
  const [tipPct, setTipPct] = useState(0.18);
  const [name, setName] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<{ total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<FinixForm | null>(null);
  const fraudRef = useRef<string | undefined>(undefined);

  const open = check && "open" in check && check.open === true ? check : null;
  const cardLive = open?.cardLive === true && !!finixAppId;
  const subtotal = open?.subtotal ?? 0;
  const tax = open?.tax ?? 0;
  const tip = Math.round(subtotal * tipPct * 100) / 100;
  const total = Math.round((subtotal + tax + tip) * 100) / 100;

  // Load the live check.
  useEffect(() => {
    let active = true;
    getGuestCheck(businessId, elementId).then((c) => { if (active) setCheck(c); }).catch(() => { if (active) setErr("Could not load your check."); });
    return () => { active = false; };
  }, [businessId, elementId]);

  // Mount the Finix card fields once we know the check is payable by card.
  useEffect(() => {
    if (!cardLive) return;
    let active = true;
    loadFinix().then((Finix) => {
      if (!active || !Finix) { if (active) setErr(null); return; }
      try {
        if (Finix.Auth) { const a = Finix.Auth(finixEnv, finixAppId); fraudRef.current = a.getSessionKey?.(); }
        formRef.current = Finix.CardTokenForm("finix-card-form", {
          showAddress: false,
          onLoad: () => { if (active) setFormReady(true); },
        });
      } catch {
        if (active) setErr(null); // fall back to pay-at-counter messaging
      }
    });
    return () => { active = false; };
  }, [cardLive, finixEnv, finixAppId]);

  const pay = useCallback(() => {
    setErr(null);
    const form = formRef.current;
    if (!form) { setErr("The card form isn't ready yet."); return; }
    setPaying(true);
    form.submit(finixEnv, finixAppId, async (sErr, res) => {
      const token = res?.data?.id;
      if (sErr || !token) { setPaying(false); setErr("Please check your card details and try again."); return; }
      const r = await payGuestCheck({
        businessId,
        elementId,
        tipCents: Math.round(tip * 100),
        card: { token, fraudSessionId: fraudRef.current, cardholderName: name.trim() || undefined },
      });
      setPaying(false);
      if ("ok" in r) { setPaid({ total: r.total }); return; }
      if ("declined" in r) { setErr(r.message); return; }
      setErr(r.error);
    });
  }, [finixEnv, finixAppId, businessId, elementId, tip, name]);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Pay your check</h1>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>

        {paid ? (
          <div className="text-center py-16 space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 className="text-xl font-semibold">Paid — {money(paid.total)}</h2>
            <p className="text-sm text-muted-foreground">Thanks! Your table is settled. Show this screen to your server if asked.</p>
          </div>
        ) : !check ? (
          <p className="text-sm text-muted-foreground">Loading your check…</p>
        ) : "error" in check ? (
          <p className="text-sm text-red-600">{check.error}</p>
        ) : !open ? (
          <p className="text-sm text-muted-foreground">There&apos;s no open check for your table yet. Please ask your server.</p>
        ) : (
          <>
            <div className="rounded-lg border border-border divide-y divide-border mb-4">
              {open.lines.map((l, i) => (
                <div key={i} className="flex justify-between px-3 py-2 text-sm">
                  <span>{l.qty > 1 ? l.qty + "× " : ""}{l.name}</span>
                  <span className="tabular-nums">{money(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{money(tax)}</span></div>
            </div>

            {!cardLive ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-500">
                Paying by phone isn&apos;t available here yet — please pay at the counter or with your server. Your check total is{" "}
                <span className="font-semibold">{money(total)}</span>.
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Add a tip</div>
                  <div className="grid grid-cols-4 gap-2">
                    {TIP_PCTS.map((p) => (
                      <button key={p} type="button" onClick={() => setTipPct(p)} className={"h-12 rounded-lg border text-sm " + (tipPct === p ? "border-foreground bg-accent font-medium" : "border-border")}>
                        {p === 0 ? "No tip" : Math.round(p * 100) + "%"}
                        {p > 0 && <div className="text-[11px] text-muted-foreground tabular-nums">{money(Math.round(subtotal * p * 100) / 100)}</div>}
                      </button>
                    ))}
                  </div>
                </div>

                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on card (optional)" className="w-full h-11 rounded-lg border border-border bg-transparent px-3 text-sm mb-3" />
                <div id="finix-card-form" className="rounded-lg border border-border p-3 mb-2 min-h-[120px]" />
                {!formReady && <p className="text-xs text-muted-foreground mb-2">Loading secure card fields…</p>}

                <div className="flex justify-between text-lg font-bold mb-3"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
                {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
                <button type="button" onClick={pay} disabled={paying || !formReady} className="w-full h-12 rounded-lg bg-foreground text-background font-medium disabled:opacity-50">
                  {paying ? "Processing…" : "Pay " + money(total)}
                </button>
                <p className="text-[11px] text-center text-muted-foreground mt-2">Card is encrypted by our payment processor. We never see your card number.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
