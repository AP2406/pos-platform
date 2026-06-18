"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openDrawerSession, closeDrawerSession, recordCashMovement, getXReport, type DayTotals } from "./actions";
import { CASH_MOVEMENT_REASONS } from "../reason-codes";

function money(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
}

type Closeout = {
  starting_cash: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  refunds: number;
  pay_ins?: number;
  pay_outs?: number;
  sale_count: number;
  expected_cash: number;
  counted_cash: number;
  over_short: number;
};

type Movement = { id: string; kind: string; amount: number; reason_code: string | null; created_at: string };

type OpenSession = {
  id: string;
  opened_at: string;
  starting_cash: number;
  cash: number;
  card: number;
  other: number;
  refunds: number;
  pay_ins: number;
  pay_outs: number;
  drops: number;
  expected: number;
  count: number;
  movements: Movement[];
};

type ClosedSession = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  starting_cash: number;
  counted_cash: number;
  expected_cash: number;
  over_short: number;
  closeout: Closeout | null;
};

type CloseResult = {
  expected: number;
  counted: number;
  over_short: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  refunds: number;
  pay_ins: number;
  pay_outs: number;
  sale_count: number;
};

const MOVE_LABEL: Record<string, string> = { pay_in: "Pay in", pay_out: "Pay out", no_sale: "No sale", drop: "Safe drop" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function DrawerClient({
  open,
  closed,
  blindDefault = false,
}: {
  open: OpenSession | null;
  closed: ClosedSession[];
  blindDefault?: boolean;
}) {
  const router = useRouter();
  const [startingCash, setStartingCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [blind, setBlind] = useState(blindDefault);
  const [openChecks, setOpenChecks] = useState<{ id: string; label: string | null }[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [closePin, setClosePin] = useState("");
  const [closeNeedsPin, setCloseNeedsPin] = useState(false);
  const [xReport, setXReport] = useState<DayTotals | null>(null);
  const [xOpenChecks, setXOpenChecks] = useState(0);

  // Cash movement modal.
  const [cashKind, setCashKind] = useState<"pay_in" | "pay_out" | "no_sale" | "drop" | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cashPin, setCashPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [cashErr, setCashErr] = useState<string | null>(null);
  const [cashBusy, setCashBusy] = useState(false);

  function openCash(kind: "pay_in" | "pay_out" | "no_sale" | "drop") {
    setCashKind(kind);
    setCashAmount("");
    setCashReason("");
    setCashNote("");
    setCashPin("");
    setNeedsPin(false);
    setCashErr(null);
  }

  function submitCash() {
    if (!cashKind) return;
    setCashErr(null);
    setCashBusy(true);
    startTransition(async () => {
      const res = await recordCashMovement({
        kind: cashKind,
        amount: cashKind === "no_sale" ? 0 : parseFloat(cashAmount) || 0,
        reason_code: cashKind === "pay_out" ? cashReason : undefined,
        reason_note: cashKind === "pay_out" && cashReason === "other" ? cashNote : undefined,
        approver_pin: needsPin ? cashPin : undefined,
      });
      setCashBusy(false);
      if ("needs_approval" in res) {
        setNeedsPin(true);
        setCashErr("A manager PIN is needed to move cash.");
        return;
      }
      if ("error" in res) {
        setCashErr(res.error);
        return;
      }
      setCashKind(null);
      router.refresh();
    });
  }

  function fmt(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
  }

  function overShortClass(n: number): string {
    if (n === 0) return "";
    return n > 0 ? "text-green-600" : "text-red-600";
  }

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      const res = await openDrawerSession(parseFloat(startingCash) || 0);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setStartingCash("");
    });
  }

  function runXReport() {
    setError(null);
    startTransition(async () => {
      const res = await getXReport();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setXReport(res.totals);
      setXOpenChecks(res.open_check_count);
    });
  }

  function handleClose(confirmOpenChecks = false) {
    setError(null);
    startTransition(async () => {
      const res = await closeDrawerSession({
        counted_cash: parseFloat(countedCash) || 0,
        note,
        blind,
        confirm_open_checks: confirmOpenChecks,
        override_reason: confirmOpenChecks ? overrideReason : undefined,
        approver_pin: closeNeedsPin ? closePin : undefined,
      });
      if ("needs_approval" in res) {
        setCloseNeedsPin(true);
        setError("A manager PIN with “Close the day” permission is needed to end the day.");
        return;
      }
      if ("needs_open_check_confirm" in res) {
        setOpenChecks(res.open_checks);
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpenChecks(null);
      setOverrideReason("");
      setClosePin("");
      setCloseNeedsPin(false);
      setResult({
        expected: res.expected_cash,
        counted: res.counted,
        over_short: res.over_short,
        cash_sales: res.cash_sales,
        card_sales: res.card_sales,
        other_sales: res.other_sales,
        refunds: res.refunds,
        pay_ins: res.pay_ins,
        pay_outs: res.pay_outs,
        sale_count: res.sale_count,
      });
      setCountedCash("");
      setNote("");
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {result && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-medium mb-1">Day ended</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {result.sale_count + (result.sale_count === 1 ? " sale" : " sales")}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash sales</span>
              <span className="tabular-nums">{money(result.cash_sales)}</span>
            </div>
            {result.card_sales > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card sales</span>
                <span className="tabular-nums">{money(result.card_sales)}</span>
              </div>
            )}
            {result.other_sales > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Other</span>
                <span className="tabular-nums">{money(result.other_sales)}</span>
              </div>
            )}
            {result.refunds > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refunds (cash out)</span>
                <span className="tabular-nums text-red-600">{"-" + money(result.refunds)}</span>
              </div>
            )}
            {result.pay_ins > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid in</span>
                <span className="tabular-nums">{"+" + money(result.pay_ins)}</span>
              </div>
            )}
            {result.pay_outs > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid out</span>
                <span className="tabular-nums text-red-600">{"-" + money(result.pay_outs)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Expected in till</span>
              <span className="tabular-nums">{money(result.expected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Counted</span>
              <span className="tabular-nums">{money(result.counted)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-border">
              <span>Over / short</span>
              <span className={"tabular-nums " + overShortClass(result.over_short)}>
                {(result.over_short > 0 ? "+" : "") + money(result.over_short)}
              </span>
            </div>
          </div>
        </div>
      )}

      {open ? (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Day in progress</h2>
            <span className="text-xs text-muted-foreground">
              {"Started " + fmt(open.opened_at)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Starting cash</div>
              <div className="tabular-nums">{money(open.starting_cash)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Cash sales</div>
              <div className="tabular-nums">{money(open.cash)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Card sales</div>
              <div className="tabular-nums">{money(open.card)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Other</div>
              <div className="tabular-nums">{money(open.other)}</div>
            </div>
          </div>

          {open.refunds > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Refunds (cash out)</span>
              <span className="tabular-nums text-red-600">{"-" + money(open.refunds)}</span>
            </div>
          )}

          {(open.pay_ins > 0 || open.pay_outs > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid in / out</span>
              <span className="tabular-nums">{"+" + money(open.pay_ins) + " / -" + money(open.pay_outs)}</span>
            </div>
          )}

          {open.drops > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Safe drops</span>
              <span className="tabular-nums text-red-600">{"-" + money(open.drops)}</span>
            </div>
          )}

          {!blind && (
            <div className="flex justify-between text-sm pt-3 border-t border-border">
              <span className="text-muted-foreground">
                {"Expected cash in till (" +
                  open.count +
                  (open.count === 1 ? " sale)" : " sales)")}
              </span>
              <span className="tabular-nums font-semibold">
                {money(open.expected)}
              </span>
            </div>
          )}

          {/* Cash management */}
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openCash("pay_in")}>Pay in</Button>
              <Button variant="outline" size="sm" onClick={() => openCash("pay_out")}>Pay out</Button>
              <Button variant="outline" size="sm" onClick={() => openCash("drop")}>Safe drop</Button>
              <Button variant="outline" size="sm" onClick={() => openCash("no_sale")}>No sale</Button>
              <Button variant="outline" size="sm" onClick={runXReport} disabled={pending}>X-report</Button>
            </div>
            {open.movements.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {open.movements.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span>{MOVE_LABEL[m.kind] || m.kind}{m.reason_code ? " · " + m.reason_code : ""}</span>
                    <span className="tabular-nums">{m.kind === "no_sale" ? "—" : (m.kind === "pay_out" ? "-" : "+") + money(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {xReport && (
            <div className="pt-3 border-t border-border text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">X-report · read only</span>
                <button type="button" onClick={() => setXReport(null)} className="text-xs text-muted-foreground underline">Hide</button>
              </div>
              <Row label="Gross sales" value={money(xReport.gross_sales)} />
              <Row label="Net (pre-tax)" value={money(xReport.net_sales)} />
              <Row label="Tax (GST/HST)" value={money(xReport.tax)} />
              {xReport.service_charge > 0 && <Row label="Service charge" value={money(xReport.service_charge)} />}
              <Row label="Tips" value={money(xReport.tips)} />
              <Row label="Discounts" value={money(xReport.discounts)} />
              <Row label="Comps" value={money(xReport.comps)} />
              <Row label="Voids" value={xReport.void_count + " · " + money(xReport.void_amount)} />
              <Row label="Cash" value={money(xReport.cash_sales)} />
              <Row label="Card" value={money(xReport.card_sales)} />
              {xReport.gift_sales > 0 && <Row label="Gift card" value={money(xReport.gift_sales)} />}
              {xReport.store_credit_sales > 0 && <Row label="Store credit" value={money(xReport.store_credit_sales)} />}
              {xReport.other_sales > 0 && <Row label="Other tender" value={money(xReport.other_sales)} />}
              {xReport.refunds > 0 && <Row label="Refunds" value={money(xReport.refunds)} />}
              {xReport.drops > 0 && <Row label="Safe drops" value={money(xReport.drops)} />}
              {xReport.per_server.length > 0 && (
                <div className="pt-2 mt-1 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Sales by server</div>
                  {xReport.per_server.map((s) => (
                    <Row key={s.staff_id} label={s.name + " · " + s.count} value={money(s.sales)} />
                  ))}
                </div>
              )}
              {xOpenChecks > 0 && <Row label="Open checks" value={String(xOpenChecks)} />}
            </div>
          )}

          {openChecks && openChecks.length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-400/10 p-3 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  {openChecks.length} open check{openChecks.length === 1 ? "" : "s"} still unpaid
                </p>
                <ul className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80 list-disc pl-4">
                  {openChecks.slice(0, 8).map((c) => (
                    <li key={c.id}>{c.label || "Untitled check"}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/80">
                  Ending the day over open checks requires a reason — it&apos;s recorded to the audit log.
                </p>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason (e.g. checks moved to tomorrow / comped)"
                  className="mt-1 h-9 bg-background"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClose(true)}
                    disabled={pending || !overrideReason.trim()}
                  >
                    Close day anyway
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setOpenChecks(null); setOverrideReason(""); }}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
              <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="h-4 w-4" />
              Blind count (hide expected until counted)
            </label>
            <Label htmlFor="counted" className="text-xs">
              Count the till
            </Label>
            <Input
              id="counted"
              type="number"
              min="0"
              step="0.01"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
            />
            {closeNeedsPin && (
              <div className="space-y-1">
                <Label htmlFor="close-pin" className="text-xs">Manager PIN (Close the day)</Label>
                <Input
                  id="close-pin"
                  type="password"
                  inputMode="numeric"
                  value={closePin}
                  onChange={(e) => setClosePin(e.target.value)}
                  placeholder="4-6 digits"
                />
              </div>
            )}
            <Button onClick={() => handleClose(false)} disabled={pending}>
              {pending ? "Ending..." : "End day"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h2 className="font-medium">Start the day</h2>
          <p className="text-sm text-muted-foreground">
            Enter the cash you&apos;re starting the till with.
          </p>
          <div className="space-y-2">
            <Label htmlFor="starting" className="text-xs">
              Starting cash
            </Label>
            <Input
              id="starting"
              type="number"
              min="0"
              step="0.01"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              placeholder="0.00"
            />
            <Button onClick={handleOpen} disabled={pending}>
              {pending ? "Starting..." : "Start day"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Recent days
        </h2>
        {closed.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground">No days recorded yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {closed.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {"Counted " + money(s.counted_cash)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(s.closed_at)}
                  </div>
                  {s.closeout && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.closeout.sale_count +
                        (s.closeout.sale_count === 1 ? " sale" : " sales") +
                        " \u00b7 cash " +
                        money(s.closeout.cash_sales) +
                        (s.closeout.card_sales > 0 ? " \u00b7 card " + money(s.closeout.card_sales) : "") +
                        (s.closeout.refunds > 0 ? " \u00b7 refunds " + money(s.closeout.refunds) : "")}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">
                    {"Expected " + money(s.expected_cash)}
                  </div>
                  <div className={"text-sm tabular-nums " + overShortClass(s.over_short)}>
                    {(s.over_short > 0 ? "+" : "") + money(s.over_short)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cash movement modal */}
      {cashKind && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setCashKind(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{MOVE_LABEL[cashKind]}</h3>
              <button type="button" onClick={() => setCashKind(null)} className="text-xs text-muted-foreground underline">Cancel</button>
            </div>
            <div className="space-y-2">
              {cashKind === "no_sale" ? (
                <p className="text-sm text-muted-foreground">Opens the drawer and records a no-sale. No cash changes hands.</p>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" className="h-11 text-right" />
                  {cashKind === "drop" && (
                    <p className="text-xs text-muted-foreground">Moves cash from the till to the safe. Lowers expected cash at close.</p>
                  )}
                </div>
              )}
              {cashKind === "pay_out" && (
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <select value={cashReason} onChange={(e) => setCashReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                    <option value="">Select a reason...</option>
                    {CASH_MOVEMENT_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                  {cashReason === "other" && (
                    <Input value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder="Note" className="h-10" />
                  )}
                </div>
              )}
              {needsPin && (
                <div className="space-y-1">
                  <Label className="text-xs">Manager PIN</Label>
                  <Input type="password" inputMode="numeric" value={cashPin} onChange={(e) => setCashPin(e.target.value)} placeholder="4-6 digits" className="h-11" />
                </div>
              )}
              <Button className="w-full h-11 mt-1" onClick={submitCash} disabled={cashBusy}>
                {cashBusy ? "Saving..." : MOVE_LABEL[cashKind]}
              </Button>
              {cashErr && <p className="text-sm text-red-600">{cashErr}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}