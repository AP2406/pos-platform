"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVendorInvoice, setInvoiceStatus, deleteVendorInvoice, setInvoiceItc } from "./actions";

export type Invoice = {
  id: string;
  vendorName: string | null;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  gl_account: string | null;
  attachment_url: string | null;
  status: string;
  notes: string | null;
  itc_eligible: boolean;
};
type Vendor = { id: string; name: string };
type Aging = { current: number; b30: number; b60: number; b90: number; over: number; total: number };

export function InvoicesClient({
  invoices,
  vendors,
  currency,
  canManage,
  aging,
}: {
  invoices: Invoice[];
  vendors: Vendor[];
  currency: string;
  canManage: boolean;
  aging: Aging;
}) {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState("");
  const [num, setNum] = useState("");
  const [invDate, setInvDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [gl, setGl] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [itc, setItc] = useState(true);
  const [category, setCategory] = useState("");
  const [meals, setMeals] = useState(false);

  const total = (Number(subtotal) || 0) + (Number(tax) || 0);

  function reset() {
    setVendorId(""); setNum(""); setInvDate(""); setDueDate(""); setSubtotal(""); setTax(""); setGl(""); setUrl(""); setNotes(""); setItc(true); setCategory(""); setMeals(false);
  }
  function save() {
    setErr(null);
    start(async () => {
      const res = await createVendorInvoice({
        vendorId: vendorId || null, invoiceNumber: num, invoiceDate: invDate || null, dueDate: dueDate || null,
        subtotal: Number(subtotal) || 0, tax: Number(tax) || 0, glAccount: gl || null, attachmentUrl: url || null, notes: notes || null,
        itcEligible: itc, expenseCategory: category || null, mealsEntertainment: meals,
      });
      if ("error" in res) { setErr(res.error); return; }
      reset(); setAdding(false);
    });
  }
  function mark(id: string, status: "open" | "paid" | "void") {
    start(async () => { await setInvoiceStatus(id, status); });
  }
  function remove(id: string) {
    if (!confirm("Delete this invoice?")) return;
    start(async () => { await deleteVendorInvoice(id); });
  }

  const open = invoices.filter((i) => i.status === "open");
  const outstanding = open.reduce((s, i) => s + i.total, 0);
  const overdue = open.filter((i) => i.due_date && new Date(i.due_date) < new Date());
  const overdueTotal = overdue.reduce((s, i) => s + i.total, 0);

  const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso + "T00:00:00")) : "—");

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Outstanding" value={money(outstanding)} hint={open.length + " open"} />
        <Stat label="Overdue" value={money(overdueTotal)} hint={overdue.length + " past due"} tone={overdue.length > 0 ? "warn" : undefined} />
        <Stat label="Invoices" value={String(invoices.length)} />
      </div>

      {/* F3: AP aging */}
      {aging.total > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">AP aging — open bills by age</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
            {[
              { k: "Current", v: aging.current },
              { k: "1–30", v: aging.b30 },
              { k: "31–60", v: aging.b60 },
              { k: "61–90", v: aging.b90, warn: true },
              { k: "90+", v: aging.over, warn: true },
              { k: "Total", v: aging.total, strong: true },
            ].map((c) => (
              <div key={c.k}>
                <div className="text-[11px] text-muted-foreground">{c.k}</div>
                <div className={"tabular-nums " + (c.strong ? "font-semibold" : "") + (c.warn && c.v > 0 ? " text-amber-600" : "")}>{money(c.v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <div className="mb-5">
          {!adding ? (
            <Button onClick={() => { setErr(null); setAdding(true); }}>Record invoice</Button>
          ) : (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vendor</Label>
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm">
                    <option value="">— none —</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice #</Label>
                  <Input value={num} onChange={(e) => setNum(e.target.value)} className="h-9" placeholder="INV-1234" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice date</Label>
                  <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subtotal</Label>
                  <Input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} inputMode="decimal" className="h-9" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tax</Label>
                  <Input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" className="h-9" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GL / expense account</Label>
                  <Input value={gl} onChange={(e) => setGl(e.target.value)} className="h-9" placeholder="Food cost / 5000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Attachment link <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} className="h-9" placeholder="https://…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expense category <span className="text-muted-foreground">(P&amp;L)</span></Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-9" placeholder="Rent / Supplies / Utilities" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm select-none">
                  <input type="checkbox" checked={itc} onChange={(e) => setItc(e.target.checked)} className="h-4 w-4" />
                  <span>GST/HST is a recoverable ITC</span>
                </label>
                <label className="flex items-center gap-2 text-sm select-none">
                  <input type="checkbox" checked={meals} onChange={(e) => setMeals(e.target.checked)} className="h-4 w-4" />
                  <span>Meals &amp; entertainment (50%)</span>
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save invoice"}</Button>
                <Button variant="outline" onClick={() => { setAdding(false); reset(); }} disabled={pending}>Cancel</Button>
                <span className="text-sm text-muted-foreground ml-auto">Total <span className="font-semibold tabular-nums">{money(total)}</span></span>
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
          )}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No invoices yet. Record a supplier invoice to track what you owe and code it to an account.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Invoice</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">GL</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-right">Due</th>
                  <th className="px-3 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const isOverdue = i.status === "open" && i.due_date && new Date(i.due_date) < new Date();
                  return (
                    <tr key={i.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{i.invoice_number || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDate(i.invoice_date)}</div>
                        {i.attachment_url && <a href={i.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-muted-foreground hover:text-foreground">attachment ↗</a>}
                      </td>
                      <td className="px-3 py-2">{i.vendorName ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{i.gl_account ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {money(i.total)}
                        {i.tax > 0 && (
                          <span className="block text-[11px] text-muted-foreground font-normal">
                            incl {money(i.tax)} tax{" "}
                            {canManage ? (
                              <button onClick={() => start(async () => { await setInvoiceItc(i.id, !i.itc_eligible); })} disabled={pending} className={"underline " + (i.itc_eligible ? "text-emerald-600" : "text-muted-foreground")}>
                                {i.itc_eligible ? "ITC" : "no ITC"}
                              </button>
                            ) : (i.itc_eligible ? "· ITC" : "· no ITC")}
                          </span>
                        )}
                      </td>
                      <td className={"px-3 py-2 text-right tabular-nums " + (isOverdue ? "text-amber-600 font-medium" : "text-muted-foreground")}>{fmtDate(i.due_date)}</td>
                      <td className="px-3 py-2 text-right">
                        <StatusPill status={i.status} overdue={!!isOverdue} />
                        {canManage && (
                          <div className="mt-1 flex justify-end gap-1.5 text-[11px]">
                            {i.status !== "paid" && <button onClick={() => mark(i.id, "paid")} disabled={pending} className="underline text-emerald-600">paid</button>}
                            {i.status !== "open" && <button onClick={() => mark(i.id, "open")} disabled={pending} className="underline text-muted-foreground">reopen</button>}
                            {i.status !== "void" && <button onClick={() => mark(i.id, "void")} disabled={pending} className="underline text-muted-foreground">void</button>}
                            <button onClick={() => remove(i.id)} disabled={pending} className="underline text-red-600">delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        Attach the scanned invoice by pasting a link (binary upload &amp; OCR are a later add). Marked-paid invoices drop out of Outstanding.
      </p>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums mt-0.5 " + (tone === "warn" ? "text-amber-600" : "")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
function StatusPill({ status, overdue }: { status: string; overdue: boolean }) {
  const map: Record<string, string> = {
    open: overdue ? "bg-amber-500/15 text-amber-700 dark:text-amber-500" : "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-500",
    void: "bg-muted text-muted-foreground",
  };
  const label = status === "open" && overdue ? "overdue" : status;
  return <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + (map[status] ?? map.open)}>{label}</span>;
}
