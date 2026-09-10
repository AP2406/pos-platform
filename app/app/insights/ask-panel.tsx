"use client";

import { useState, useTransition } from "react";
import { askInsights, type AskAnswer } from "./ask-actions";

const EXAMPLES = [
  "Top items last Friday dinner",
  "Net sales this month",
  "Busiest hour last week",
  "Sales by channel last 30 days",
];

function fmt(v: number, money: boolean): string {
  return money ? "$" + (Math.round(v * 100) / 100).toFixed(2) : String(Math.round(v * 100) / 100);
}

export function AskPanel({ aiConfigured }: { aiConfigured: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AskAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setErr(null);
    startTransition(async () => {
      const r = await askInsights(text);
      if ("error" in r) { setErr(r.error); setRes(null); return; }
      setRes(r);
    });
  }

  function downloadCsv() {
    if (!res) return;
    const blob = new Blob([res.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "insights.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const max = res && res.rows.length > 0 ? Math.max(...res.rows.map((r) => Math.abs(r.value)), 1) : 1;

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="font-semibold text-sm">Ask your data</h2>
        <span className="text-[12px] text-muted-foreground">Plain-English questions about your sales</span>
      </div>

      {!aiConfigured ? (
        <p className="text-sm text-muted-foreground">AI isn&apos;t configured for this workspace. Add a <span className="font-mono text-xs">GEMINI_API_KEY</span> to enable Ask.</p>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. What were my top items last Friday dinner?"
              className="flex-1 h-10 rounded-md border border-border bg-transparent px-3 text-sm"
            />
            <button type="submit" disabled={pending || q.trim().length < 3} className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50">
              {pending ? "Asking…" : "Ask"}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => { setQ(ex); ask(ex); }} className="text-[12px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:bg-accent">
                {ex}
              </button>
            ))}
          </div>

          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

          {res && (
            <div className="mt-4">
              <p className="text-sm font-medium">{res.answer}</p>

              {res.dimension !== "none" && res.rows.length > 0 && (
                <div className="mt-3 space-y-1">
                  {res.rows.map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate capitalize">{row.label}</span>
                      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-foreground/70" style={{ width: Math.round((Math.abs(row.value) / max) * 100) + "%" }} />
                      </div>
                      <span className="w-20 shrink-0 text-right tabular-nums">{fmt(row.value, res.isMoney)}</span>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={downloadCsv} className="text-xs underline text-muted-foreground mt-3">Download CSV</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
