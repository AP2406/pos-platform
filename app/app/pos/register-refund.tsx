"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrderForRefund, refundItems } from "./sales/refund-actions";
import { emailRefundReceipt } from "./sales/receipt-actions";
import { listRefundableSales, type RefundableSale } from "./register-refund-actions";

const REASONS = [
  { value: "customer_request", label: "Customer request" },
  { value: "defective", label: "Defective / damaged" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "overcharge", label: "Overcharge" },
  { value: "duplicate", label: "Duplicate charge" },
  { value: "other", label: "Other" },
];

type Line = { order_item_id: string; name: string; unit_price: number; sold: number; returned: number; returnable: number };
type OrderInfo = { id: string; sale_number: number | null; status: string; subtotal: number; discount: number; tax: number; tip: number; total: number; refunded_amount: number; has_customer: boolean };
type DoneInfo = { refund_id: string | null; amount: number; fully: boolean; discount_portion: number; tax_portion: number; returned_subtotal: number; items: { name: string; quantity: number; line_subtotal: number }[]; reason: string; at: string };

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function cad(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printRefundReceipt(r: { businessName: string; saleNumber: number; info: DoneInfo }) {
  const win = window.open("", "_blank", "width=340,height=640");
  if (!win) return;
  const match = REASONS.find((x) => x.value === r.info.reason);
  const reasonLabel = match ? match.label : r.info.reason;
  const rows = r.info.items
    .map(function (l) {
      return "<tr><td>" + escapeHtml(l.name) + " x" + l.quantity + '</td><td style="text-align:right">$' + l.line_subtotal.toFixed(2) + "</td></tr>";
    })
    .join("");
  const discountRow = r.info.discount_portion > 0 ? '<tr><td>Less discount</td><td style="text-align:right">-$' + r.info.discount_portion.toFixed(2) + "</td></tr>" : "";
  const taxRow = r.info.tax_portion > 0 ? '<tr><td>Tax</td><td style="text-align:right">+$' + r.info.tax_portion.toFixed(2) + "</td></tr>" : "";
  const html =
    "<html><head><title>Refund</title><style>" +
    "body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px;color:#000}" +
    "h2{text-align:center;font-size:14px;margin:4px 0}" +
    "table{width:100%;border-collapse:collapse}" +
    "td{padding:2px 0;vertical-align:top}" +
    ".line{border-top:1px dashed #000;margin:6px 0}" +
    ".big{font-size:16px;font-weight:bold;text-align:center;margin:6px 0}" +
    ".center{text-align:center}" +
    "@media print{@page{margin:4mm}}" +
    "</style></head><body>" +
    "<h2>" + escapeHtml(r.businessName) + "</h2>" +
    '<div class="center" style="font-weight:bold">REFUND</div>' +
    '<div class="center">For sale #' + r.saleNumber + "</div>" +
    '<div class="center" style="font-size:10px">' + (r.info.fully ? "Full refund" : "Partial refund") + "</div>" +
    '<div class="center">' + escapeHtml(r.info.at) + "</div>" +
    '<div class="line"></div>' +
    "<table>" + rows + "</table>" +
    '<div class="line"></div>' +
    "<table>" +
    '<tr><td>Items</td><td style="text-align:right">$' + r.info.returned_subtotal.toFixed(2) + "</td></tr>" +
    discountRow +
    taxRow +
    "</table>" +
    '<div class="big">-$' + r.info.amount.toFixed(2) + "</div>" +
    '<div class="center">Reason: ' + escapeHtml(reasonLabel) + "</div>" +
    '<div class="line"></div>' +
    '<div class="center" style="margin-top:8px">Thank you!</div>' +
    "</body></html>";
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function RegisterRefund({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "refund">("pick");

  const [sales, setSales] = useState<RefundableSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesErr, setSalesErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [toStoreCredit, setToStoreCredit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [pending, startTransition] = useTransition();
  const [saleNumber, setSaleNumber] = useState(0);
  const [emailTo, setEmailTo] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailDone, setEmailDone] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [mgrPin, setMgrPin] = useState("");

  function resetRefundState() {
    setOrder(null);
    setLines([]);
    setQty({});
    setReason("");
    setNote("");
    setRestock(true);
    setToStoreCredit(false);
    setErr(null);
    setDone(null);
    setEmailTo("");
    setEmailErr(null);
    setEmailDone(false);
    setEmailBusy(false);
    setNeedsApproval(false);
    setMgrPin("");
    setSaleNumber(0);
  }

  async function loadSales(q: string) {
    setSalesLoading(true);
    setSalesErr(null);
    const res = await listRefundableSales(q);
    setSalesLoading(false);
    if ("error" in res) {
      setSalesErr(res.error);
      setSales([]);
      return;
    }
    setSales(res.sales);
  }

  function openModal() {
    setOpen(true);
    setStep("pick");
    setQuery("");
    resetRefundState();
    loadSales("");
  }

  function backToPick() {
    setStep("pick");
    resetRefundState();
    loadSales(query);
  }

  async function pickSale(s: RefundableSale) {
    resetRefundState();
    setSaleNumber(s.sale_number ?? 0);
    setStep("refund");
    setLoading(true);
    const res = await getOrderForRefund(s.id);
    setLoading(false);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    setOrder(res.order);
    setLines(res.lines);
  }

  function setQtyFor(line: Line, val: number) {
    let v = Math.floor(val);
    if (isNaN(v) || v < 0) v = 0;
    if (v > line.returnable) v = line.returnable;
    setQty((prev) => ({ ...prev, [line.order_item_id]: v }));
  }

  function refundAll() {
    const next: Record<string, number> = {};
    for (const l of lines) next[l.order_item_id] = l.returnable;
    setQty(next);
  }

  const returnedSubtotal = round2(lines.reduce((a, l) => a + (qty[l.order_item_id] || 0) * l.unit_price, 0));
  const f = order && order.subtotal > 0 ? returnedSubtotal / order.subtotal : 0;
  const discountPortion = order ? round2(order.discount * f) : 0;
  const taxPortion = order ? round2(order.tax * f) : 0;
  const previewAmount = round2(returnedSubtotal - discountPortion + taxPortion);
  const anySelected = lines.some((l) => (qty[l.order_item_id] || 0) > 0);

  function runRefund(approverPin?: string) {
    if (!order) return;
    setErr(null);
    const oid = order.id;
    const selected = lines.filter((l) => (qty[l.order_item_id] || 0) > 0).map((l) => ({ order_item_id: l.order_item_id, quantity: qty[l.order_item_id] || 0 }));
    const selectedForReceipt = lines.filter((l) => (qty[l.order_item_id] || 0) > 0).map((l) => ({ name: l.name, quantity: qty[l.order_item_id] || 0, line_subtotal: round2((qty[l.order_item_id] || 0) * l.unit_price) }));
    startTransition(async () => {
      try {
        const res = await refundItems({ order_id: oid, lines: selected, reason, note, restock, approver_pin: approverPin, to_store_credit: toStoreCredit });
        if ("needs_approval" in res) {
          setNeedsApproval(true);
          return;
        }
        if ("error" in res) {
          setErr(res.error);
          return;
        }
        setNeedsApproval(false);
        setDone({ refund_id: res.refund_id, amount: res.amount, fully: res.fully, discount_portion: res.discount_portion, tax_portion: res.tax_portion, returned_subtotal: res.returned_subtotal, items: selectedForReceipt, reason: reason, at: new Date().toLocaleString() });
      } catch (e) {
        // Never fail silently — surface any unexpected error in the modal.
        setErr("Refund failed: " + (e instanceof Error ? e.message : "unexpected error") + ". Nothing was charged; please retry.");
      }
    });
  }

  function submit() {
    setErr(null);
    if (!reason) {
      setErr("Choose a reason.");
      return;
    }
    if (!anySelected) {
      setErr("Select at least one item to return.");
      return;
    }
    runRefund(undefined);
  }

  function approveRefund() {
    if (!/^[0-9]{4,6}$/.test(mgrPin)) {
      setErr("Enter the manager's 4 to 6 digit PIN.");
      return;
    }
    runRefund(mgrPin);
  }

  function sendRefundEmail() {
    if (!order) return;
    setEmailErr(null);
    const to = emailTo.trim();
    if (!to) {
      setEmailErr("Enter an email address.");
      return;
    }
    setEmailBusy(true);
    emailRefundReceipt(order.id, to).then((res) => {
      setEmailBusy(false);
      if ("error" in res) {
        setEmailErr(res.error);
        return;
      }
      setEmailDone(true);
    });
  }

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  return (
    <>
      <button type="button" onClick={openModal} className="flex items-center gap-1.5 text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
        Refund
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md text-left max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {step === "pick" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Refund a sale</h3>
                  <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
                    Close
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by sale number"
                    inputMode="numeric"
                    className="h-9 flex-1"
                  />
                  <Button variant="outline" onClick={() => loadSales(query)} disabled={salesLoading}>
                    {salesLoading ? "..." : "Search"}
                  </Button>
                </div>

                {salesErr ? (
                  <p className="text-sm text-red-600">{salesErr}</p>
                ) : salesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading sales...</p>
                ) : sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No refundable sales found.</p>
                ) : (
                  <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                    {sales.map((s) => (
                      <button key={s.id} type="button" onClick={() => pickSale(s)} className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {s.sale_number != null ? "Sale #" + s.sale_number : "Sale"}
                            {s.status === "partially_refunded" && (
                              <span className="ml-2 text-xs text-amber-600">Partial refund</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtTime(s.created_at)}</div>
                        </div>
                        <span className="text-sm tabular-nums shrink-0">{cad(s.total)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Loading sale...</p>
            ) : done ? (
              <div className="space-y-3">
                <h3 className="font-medium">{done.fully ? "Full refund recorded" : "Partial refund recorded"}</h3>
                <div className="text-sm text-emerald-600">{"✓ Refund " + (done.refund_id ? "#" + done.refund_id.slice(0, 8) + " " : "") + "recorded · " + cad(done.amount)}</div>
                <div className="text-sm text-muted-foreground">{"Sale #" + saleNumber}</div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => printRefundReceipt({ businessName, saleNumber, info: done })}>Print receipt</Button>
                  <Button variant="outline" className="flex-1" onClick={backToPick}>Refund another</Button>
                </div>
                <div className="pt-3 border-t border-border space-y-2">
                  <Label className="text-xs">Email refund receipt (optional)</Label>
                  {emailDone ? (
                    <p className="text-sm text-emerald-500">Refund receipt sent.</p>
                  ) : (
                    <div className="flex gap-2">
                      <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@email.com" className="h-9 flex-1" />
                      <Button variant="outline" onClick={sendRefundEmail} disabled={emailBusy}>
                        {emailBusy ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  )}
                  {emailErr && <p className="text-sm text-red-600">{emailErr}</p>}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>Close</Button>
              </div>
            ) : err && !order ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600">{err}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={backToPick}>Back to sales</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Close</Button>
                </div>
              </div>
            ) : needsApproval ? (
              <div className="space-y-3">
                <h3 className="font-medium">Manager approval</h3>
                <p className="text-sm text-muted-foreground">
                  A manager must approve this refund of {cad(previewAmount)}. Ask a manager to enter their PIN.
                </p>
                <Input type="password" inputMode="numeric" value={mgrPin} onChange={(e) => setMgrPin(e.target.value)} placeholder="Manager PIN" className="h-9" />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={approveRefund} disabled={pending || !mgrPin}>
                    {pending ? "Refunding..." : "Approve & refund"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setNeedsApproval(false); setMgrPin(""); setErr(null); }}>
                    Back
                  </Button>
                </div>
              </div>
            ) : order ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{"Refund sale #" + (order.sale_number ?? saleNumber)}</h3>
                  <button type="button" onClick={refundAll} className="text-xs text-blue-600 underline">
                    Refund everything
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items on this sale.</p>
                  ) : (
                    lines.map((l) => {
                      const cur = qty[l.order_item_id] || 0;
                      const exhausted = l.returnable === 0;
                      return (
                        <div key={l.order_item_id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{l.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {cad(l.unit_price) + " - " + l.returnable + " of " + l.sold + " returnable"}
                            </div>
                          </div>
                          {exhausted ? (
                            <span className="text-xs text-muted-foreground shrink-0">Returned</span>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <button type="button" onClick={() => setQtyFor(l, cur - 1)} className="w-7 h-7 rounded-md border border-border hover:bg-accent">-</button>
                              <span className="w-6 text-center text-sm tabular-nums">{cur}</span>
                              <button type="button" onClick={() => setQtyFor(l, cur + 1)} className="w-7 h-7 rounded-md border border-border hover:bg-accent">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-border space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="tabular-nums">{cad(returnedSubtotal)}</span>
                  </div>
                  {discountPortion > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Less discount</span>
                      <span className="tabular-nums">{"-" + cad(discountPortion)}</span>
                    </div>
                  )}
                  {taxPortion > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="tabular-nums">{"+" + cad(taxPortion)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1">
                    <span>Refund total</span>
                    <span className="tabular-nums">{cad(previewAmount)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Reason (required)</Label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm">
                    <option value="">Select a reason...</option>
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Note (optional)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details" className="h-9" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                  Return items to inventory
                </label>
                {order?.has_customer && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={toStoreCredit} onChange={(e) => setToStoreCredit(e.target.checked)} />
                    Refund to store credit
                  </label>
                )}

                {err && <p className="text-sm text-red-600">{err}</p>}

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={submit} disabled={pending || !anySelected || !reason}>
                    {pending ? "Refunding..." : "Confirm refund " + cad(previewAmount)}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={backToPick}>Back</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tips aren&apos;t refunded on item returns. Card refunds are sent back to the original card automatically.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}