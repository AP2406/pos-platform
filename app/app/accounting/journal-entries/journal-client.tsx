"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJournalEntry, deleteJournalEntry, createJournalTemplate, postTemplate, deleteJournalTemplate, type JEntry, type JTemplate, type JLine } from "./actions";

type Acct = { name: string; code: string };
type Line = { account_name: string; account_code: string; debit: string; credit: string; memo: string };
const blankLine = (): Line => ({ account_name: "", account_code: "", debit: "", credit: "", memo: "" });

export function JournalClient({ entries, templates, accounts, currency, today }: { entries: JEntry[]; templates: JTemplate[]; accounts: Acct[]; currency: string; today: string }) {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [entity, setEntity] = useState("");
  const [autoReverse, setAutoReverse] = useState(false);
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [expand, setExpand] = useState<string | null>(null);

  const totDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = lines.filter((l) => l.account_name.trim() && (Number(l.debit) || Number(l.credit))).length >= 2 && totDebit > 0 && Math.abs(totDebit - totCredit) < 0.005;

  function setLine(i: number, patch: Partial<Line>) { setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function pickAccount(i: number, name: string) {
    const a = accounts.find((x) => x.name === name);
    setLine(i, { account_name: name, account_code: a?.code ?? lines[i].account_code });
  }
  function toLines(): JLine[] {
    return lines.map((l) => ({ account_name: l.account_name.trim(), account_code: l.account_code.trim() || null, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo.trim() || null }));
  }
  function reset() { setMemo(""); setEntity(""); setAutoReverse(false); setLines([blankLine(), blankLine()]); }
  function post() {
    setErr(null);
    start(async () => {
      const res = await createJournalEntry({ entryDate: date, memo, entity: entity || null, autoReverse, lines: toLines() });
      if ("error" in res) { setErr(res.error); return; }
      reset();
    });
  }
  function saveTemplate() {
    const name = prompt("Template name?");
    if (!name) return;
    start(async () => { await createJournalTemplate({ name, memo, autoReverse, lines: toLines() }); });
  }
  function handlePostTemplate(t: JTemplate) {
    const d = prompt("Entry date (YYYY-MM-DD)?", today);
    if (!d) return;
    start(async () => { await postTemplate(t.id, d); });
  }

  const fmtDate = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T00:00:00Z"));

  return (
    <div className="space-y-8">
      {/* New entry */}
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">New journal entry</h2>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" /></div>
          <div className="space-y-1 flex-1 min-w-[160px]"><Label className="text-xs">Memo</Label><Input value={memo} onChange={(e) => setMemo(e.target.value)} className="h-9" placeholder="Monthly rent accrual" /></div>
          <div className="space-y-1"><Label className="text-xs">Entity <span className="text-muted-foreground">(opt)</span></Label><Input value={entity} onChange={(e) => setEntity(e.target.value)} className="h-9 w-32" placeholder="Location" /></div>
        </div>
        <div className="space-y-1.5">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input list="acct-list" value={l.account_name} onChange={(e) => pickAccount(i, e.target.value)} placeholder="Account" className="h-8 flex-1 min-w-[140px] rounded-md border border-border bg-transparent px-2 text-sm" />
              <Input value={l.account_code} onChange={(e) => setLine(i, { account_code: e.target.value })} placeholder="Code" className="h-8 w-20" />
              <Input value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} inputMode="decimal" placeholder="Debit" className="h-8 w-24 text-right" />
              <Input value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} inputMode="decimal" placeholder="Credit" className="h-8 w-24 text-right" />
              <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length <= 2} className="text-muted-foreground hover:text-red-600 disabled:opacity-30 text-sm px-1">×</button>
            </div>
          ))}
        </div>
        <datalist id="acct-list">{accounts.map((a) => <option key={a.name} value={a.name} />)}</datalist>
        <button type="button" onClick={() => setLines((p) => [...p, blankLine()])} className="text-xs text-muted-foreground underline mt-2">+ add line</button>

        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border">
          <label className="flex items-center gap-2 text-sm select-none"><input type="checkbox" checked={autoReverse} onChange={(e) => setAutoReverse(e.target.checked)} className="h-4 w-4" /><span>Auto-reverse next month</span></label>
          <div className="text-sm tabular-nums ml-auto">
            <span className="text-muted-foreground">Dr</span> {money(totDebit)} · <span className="text-muted-foreground">Cr</span> {money(totCredit)}
            {!balanced && (totDebit > 0 || totCredit > 0) && <span className="text-red-600 ml-2">out of balance</span>}
            {balanced && <span className="text-emerald-600 ml-2">balanced ✓</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={post} disabled={pending || !balanced}>Post entry</Button>
          <Button variant="outline" onClick={saveTemplate} disabled={pending || lines.filter((l) => l.account_name.trim()).length < 2}>Save as template</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Recurring templates</h2>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
            {templates.map((t) => (
              <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{t.name}{t.autoReverse && <span className="ml-2 text-[12px] text-sky-600">auto-reverse</span>}</div>
                  <div className="text-[12px] text-muted-foreground">{t.lines.length} lines · {money(t.lines.reduce((s, l) => s + l.debit, 0))}</div>
                </div>
                <div className="flex gap-2 text-[12px] shrink-0">
                  <button onClick={() => handlePostTemplate(t)} disabled={pending} className="underline">post</button>
                  <button onClick={() => { if (confirm("Delete template?")) start(async () => { await deleteJournalTemplate(t.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Journal entries</h2>
        {entries.length === 0 ? (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">No journal entries yet.</div>
        ) : (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
            {entries.map((e) => (
              <div key={e.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setExpand(expand === e.id ? null : e.id)} className="min-w-0 text-left">
                    <div className="font-medium text-sm">{fmtDate(e.entryDate)} <span className="text-muted-foreground font-normal">{e.memo ?? ""}</span></div>
                    <div className="text-[12px] text-muted-foreground">{money(e.debit)} · {e.source}{e.entity ? " · " + e.entity : ""}{e.reversesId ? " · reversal" : ""}{Math.abs(e.debit - e.credit) >= 0.005 ? " · ⚠ unbalanced" : ""}</div>
                  </button>
                  <button onClick={() => { if (confirm("Delete this entry?")) start(async () => { await deleteJournalEntry(e.id); }); }} disabled={pending} className="text-[12px] text-red-600 underline shrink-0">delete</button>
                </div>
                {expand === e.id && (
                  <table className="w-full text-xs mt-2 border-t border-border pt-2">
                    <tbody>
                      {e.lines.map((l, i) => (
                        <tr key={i}>
                          <td className="py-0.5">{l.account_code ? l.account_code + " · " : ""}{l.account_name}{l.memo ? <span className="text-muted-foreground"> — {l.memo}</span> : null}</td>
                          <td className="py-0.5 text-right tabular-nums w-24">{l.debit ? money(l.debit) : ""}</td>
                          <td className="py-0.5 text-right tabular-nums w-24">{l.credit ? money(l.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
