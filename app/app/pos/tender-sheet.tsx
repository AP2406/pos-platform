"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TMethod = "cash" | "card" | "other" | "gift_card" | "store_credit";
type Tender = { method: TMethod; amount: number; tendered: number | null; change: number | null; gift_card_code?: string | null };
type SplitLine = { id: number; method: TMethod; amount: string; cashGiven: string; giftCode: string };

type Props = {
  open: boolean;
  onClose: () => void;
  total: number;
  pending: boolean;
  cardEnabled: boolean;
  tapToPayEnabled?: boolean;
  terminalEnabled?: boolean;
  terminalReady?: boolean | null;
  storeCreditBalance?: number;
  onCash: (tenderedDollars: number) => void;
  onSplit: (tenders: Tender[]) => void;
  onCardManual: () => void;
  onTapToPay?: () => void;
  onTerminal?: () => void;
  onCardRecord: () => void;
};

function methodLabel(m: string): string {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "gift_card") return "Gift";
  if (m === "store_credit") return "Credit";
  return "Other";
}

function buildQuickAmounts(totalCents: number): number[] {
  if (totalCents <= 0) return [];
  const out: number[] = [totalCents];
  const candidates = [
    Math.ceil(totalCents / 500) * 500,
    Math.ceil(totalCents / 1000) * 1000,
    2000,
    5000,
    10000,
  ];
  for (const v of candidates) {
    if (v >= totalCents && out.indexOf(v) === -1) out.push(v);
  }
  return out.slice(0, 6);
}

export function TenderSheet(props: Props) {
  const [method, setMethod] = useState<"cash" | "card" | "split">("cash");
  const [cashCents, setCashCents] = useState<number>(0);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const splitIdRef = useRef<number>(1);

  if (!props.open) return null;

  const totalCents = Math.round(props.total * 100);

  function pushDigit(d: number) {
    setCashCents(function (c) {
      const next = c * 10 + d;
      return next > 99999999 ? c : next;
    });
  }
  function pushDouble() {
    setCashCents(function (c) {
      const next = c * 100;
      return next > 99999999 ? c : next;
    });
  }
  function backspace() {
    setCashCents(function (c) {
      return Math.floor(c / 10);
    });
  }

  const changeCents = cashCents - totalCents;
  const cashReady = cashCents >= totalCents && totalCents > 0;
  const quickAmounts = buildQuickAmounts(totalCents);

  function newLine(m: TMethod): SplitLine {
    const id = splitIdRef.current;
    splitIdRef.current = id + 1;
    return { id: id, method: m, amount: "", cashGiven: "", giftCode: "" };
  }
  function ensureSplit() {
    if (splitLines.length === 0) {
      setSplitLines([newLine("cash"), newLine("card")]);
    }
  }
  function updateLine(id: number, patch: Partial<SplitLine>) {
    setSplitLines(function (prev) {
      return prev.map(function (l) {
        return l.id === id ? { ...l, ...patch } : l;
      });
    });
  }
  function removeLine(id: number) {
    setSplitLines(function (prev) {
      return prev.length <= 1 ? prev : prev.filter(function (l) { return l.id !== id; });
    });
  }
  function addLine(m: TMethod) {
    setSplitLines(function (prev) { return [...prev, newLine(m)]; });
  }
  function setRest(id: number) {
    setSplitLines(function (prev) {
      const otherCents = prev
        .filter(function (l) { return l.id !== id; })
        .reduce(function (s, l) { return s + Math.round((parseFloat(l.amount) || 0) * 100); }, 0);
      let restCents = totalCents - otherCents;
      if (restCents < 0) restCents = 0;
      const rest = (restCents / 100).toFixed(2);
      return prev.map(function (l) { return l.id === id ? { ...l, amount: rest } : l; });
    });
  }
  const splitSumCents = splitLines.reduce(function (s, l) { return s + Math.round((parseFloat(l.amount) || 0) * 100); }, 0);
  const splitRemainingCents = totalCents - splitSumCents;
  const splitCanComplete = totalCents > 0 && splitRemainingCents === 0 && splitSumCents > 0;
  function lineChange(l: SplitLine): number | null {
    if (l.method !== "cash") return null;
    const given = l.cashGiven.trim() ? Math.round((parseFloat(l.cashGiven) || 0) * 100) / 100 : null;
    if (given === null) return null;
    const amt = Math.round((parseFloat(l.amount) || 0) * 100) / 100;
    const change = Math.round((given - amt) * 100) / 100;
    return change > 0 ? change : 0;
  }
  function completeSplit() {
    setSplitError(null);
    const built = splitLines
      .map(function (l) {
        const amt = Math.round((parseFloat(l.amount) || 0) * 100) / 100;
        const givenRaw = l.cashGiven.trim() ? Math.round((parseFloat(l.cashGiven) || 0) * 100) / 100 : null;
        const tendered = l.method === "cash" ? givenRaw : null;
        const change = l.method === "cash" && tendered !== null ? Math.round((tendered - amt) * 100) / 100 : null;
        const gift_card_code = l.method === "gift_card" ? l.giftCode.trim().toUpperCase() : null;
        return { method: l.method, amount: amt, tendered: tendered, change: change, gift_card_code: gift_card_code };
      })
      .filter(function (p) { return p.amount > 0; });
    if (built.some(function (p) { return p.method === "gift_card" && !p.gift_card_code; })) {
      setSplitError("Enter the gift card code.");
      return;
    }
    const scCents = built
      .filter(function (p) { return p.method === "store_credit"; })
      .reduce(function (s, p) { return s + Math.round(p.amount * 100); }, 0);
    if (scCents > Math.round((props.storeCreditBalance ?? 0) * 100)) {
      setSplitError("Not enough store credit for that amount.");
      return;
    }
    const sumCents = built.reduce(function (s, p) { return s + Math.round(p.amount * 100); }, 0);
    if (sumCents !== totalCents) {
      setSplitError("Split amounts must add up to the total.");
      return;
    }
    props.onSplit(built);
  }

  function chooseMethod(m: "cash" | "card" | "split") {
    setMethod(m);
    if (m === "split") ensureSplit();
  }

  const tabs: { key: "cash" | "card" | "split"; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "card", label: "Card" },
    { key: "split", label: "Split" },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border">
        <button type="button" onClick={props.onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>
        <span className="text-sm font-medium">Take payment</span>
        <span className="text-base font-semibold tabular-nums">{"$" + props.total.toFixed(2)}</span>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          {tabs.map(function (t) {
            const active = method === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={function () { chooseMethod(t.key); }}
                className={"py-3 rounded-lg border text-sm font-medium transition-colors " + (active ? "border-foreground bg-accent" : "border-border text-muted-foreground hover:border-foreground/40")}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto">
          {method === "cash" && (
            <div>
              <div className="rounded-lg border border-border p-4 mb-3 text-center">
                <div className="text-xs text-muted-foreground">Cash received</div>
                <div className="text-3xl font-semibold tabular-nums mt-1">{"$" + (cashCents / 100).toFixed(2)}</div>
                <div className={"text-sm mt-1 tabular-nums " + (changeCents >= 0 ? "text-emerald-500" : "text-muted-foreground")}>
                  {changeCents >= 0 ? "Change due $" + (changeCents / 100).toFixed(2) : "Remaining $" + (Math.abs(changeCents) / 100).toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {quickAmounts.map(function (amt, i) {
                  const label = i === 0 ? "Exact" : "$" + (amt / 100).toFixed(0);
                  return (
                    <button
                      key={amt + "-" + i}
                      type="button"
                      onClick={function () { setCashCents(amt); }}
                      className="py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent tabular-nums"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(function (k) {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={function () { pushDigit(parseInt(k, 10)); }}
                      className="py-4 rounded-lg border border-border text-lg font-medium hover:bg-accent"
                    >
                      {k}
                    </button>
                  );
                })}
                <button type="button" onClick={pushDouble} className="py-4 rounded-lg border border-border text-lg font-medium hover:bg-accent">00</button>
                <button type="button" onClick={function () { pushDigit(0); }} className="py-4 rounded-lg border border-border text-lg font-medium hover:bg-accent">0</button>
                <button type="button" onClick={backspace} className="py-4 rounded-lg border border-border text-lg hover:bg-accent flex items-center justify-center" aria-label="Backspace">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M20 6H9l-7 6 7 6h11a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM16 9l-6 6M10 9l6 6" /></svg>
                </button>
              </div>

              <Button className="w-full mt-4 h-12 text-base" disabled={props.pending || !cashReady} onClick={function () { props.onCash(cashCents / 100); }}>
                {props.pending ? "Recording..." : "Complete cash sale"}
              </Button>
            </div>
          )}

          {method === "card" && (
            <div>
              {props.cardEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {props.terminalEnabled ? (
                    <button type="button" onClick={props.onTerminal} className="text-left rounded-lg border-2 border-foreground/70 p-5 hover:bg-accent transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M9 16h6" /></svg>
                      <div className="text-base font-medium mt-3">Card reader</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Tap, insert, or swipe on the terminal</div>
                      {props.terminalReady === false ? (
                        <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Terminal offline</div>
                      ) : props.terminalReady ? (
                        <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Ready</div>
                      ) : (
                        <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Checking…</div>
                      )}
                    </button>
                  ) : props.tapToPayEnabled ? (
                    <button type="button" onClick={props.onTapToPay} className="text-left rounded-lg border-2 border-foreground/70 p-5 hover:bg-accent transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M5 12h.01M9 7a5 5 0 0 1 0 10M13 4a9 9 0 0 1 0 16" /></svg>
                      <div className="text-base font-medium mt-3">Tap to Pay</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Contactless on this device</div>
                      <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Ready</div>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-border p-5 opacity-70">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-muted-foreground"><path d="M5 12h.01M9 7a5 5 0 0 1 0 10M13 4a9 9 0 0 1 0 16" /></svg>
                      <div className="text-base font-medium mt-3">Card reader</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Tap, insert, or swipe</div>
                      <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Tap to Pay in the iPhone app</div>
                    </div>
                  )}
                  <button type="button" onClick={props.onCardManual} className="text-left rounded-lg border-2 border-foreground/70 p-5 hover:bg-accent transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M6 14h8" /></svg>
                    <div className="text-base font-medium mt-3">Enter manually</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Key in the card number</div>
                    <div className="inline-block text-[11px] mt-3 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">Ready</div>
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-border p-5">
                  <div className="text-sm text-muted-foreground mb-3">
                    Live card charging isn&apos;t set up for this business yet, so this records a card payment without charging.
                  </div>
                  <Button className="w-full h-12" disabled={props.pending} onClick={props.onCardRecord}>
                    {props.pending ? "Recording..." : "Record card payment"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {method === "split" && (
            <div>
              <div className="space-y-2">
                {splitLines.map(function (l) {
                  const change = lineChange(l);
                  return (
                    <div key={l.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex rounded-md border border-border overflow-hidden text-xs">
                          {(["cash", "card", "other", "gift_card", "store_credit"] as const).map(function (m) {
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={function () { updateLine(l.id, { method: m }); }}
                                className={"px-3 py-1.5 " + (l.method === m ? "bg-accent font-medium" : "hover:bg-accent/50")}
                              >
                                {methodLabel(m)}
                              </button>
                            );
                          })}
                        </div>
                        {splitLines.length > 1 && (
                          <button type="button" onClick={function () { removeLine(l.id); }} className="text-xs text-muted-foreground underline hover:text-foreground">Remove</button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" min="0" step="0.01" value={l.amount} onChange={function (e) { updateLine(l.id, { amount: e.target.value }); }} placeholder="0.00" className="flex-1 h-9 text-right" />
                        <button type="button" onClick={function () { setRest(l.id); }} className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent whitespace-nowrap">Rest</button>
                      </div>
                      {l.method === "cash" && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Cash given</span>
                          <Input type="number" min="0" step="0.01" value={l.cashGiven} onChange={function (e) { updateLine(l.id, { cashGiven: e.target.value }); }} placeholder="optional" className="w-28 h-9 text-right" />
                        </div>
                      )}
                      {l.method === "gift_card" && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Gift card code</span>
                          <Input value={l.giftCode} onChange={function (e) { updateLine(l.id, { giftCode: e.target.value }); }} placeholder="XXXX-XXXX-XXXX" className="w-44 h-9 font-mono" />
                        </div>
                      )}
                      {change !== null && change > 0 && (
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Change</span><span className="tabular-nums">{"$" + change.toFixed(2)}</span></div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-2">
                <button type="button" onClick={function () { addLine("cash"); }} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent">+ Cash</button>
                <button type="button" onClick={function () { addLine("card"); }} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent">+ Card</button>
                <button type="button" onClick={function () { addLine("gift_card"); }} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent">+ Gift</button>
                {(props.storeCreditBalance ?? 0) > 0 && (
                  <button type="button" onClick={function () { addLine("store_credit"); }} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent">{"+ Credit ($" + (props.storeCreditBalance ?? 0).toFixed(2) + ")"}</button>
                )}
                <button type="button" onClick={function () { addLine("other"); }} className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent">+ Other</button>
              </div>

              <div className="flex justify-between text-sm mt-3 pt-2 border-t border-border">
                <span className="text-muted-foreground">Allocated</span>
                <span className="tabular-nums">{"$" + (splitSumCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>{splitRemainingCents < 0 ? "Over by" : "Remaining"}</span>
                <span className={"tabular-nums " + (splitRemainingCents === 0 ? "text-emerald-500" : "text-red-500")}>{"$" + (Math.abs(splitRemainingCents) / 100).toFixed(2)}</span>
              </div>

              {splitError && <p className="text-sm text-red-600 mt-2">{splitError}</p>}

              <Button className="w-full mt-4 h-12 text-base" disabled={props.pending || !splitCanComplete} onClick={completeSplit}>
                {props.pending ? "Recording..." : "Complete split sale"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}