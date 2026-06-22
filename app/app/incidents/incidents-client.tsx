"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addIncident, resolveIncident, reopenIncident, deleteIncident } from "./actions";

export type Incident = {
  id: string;
  type: string;
  severity: string;
  body: string;
  resolution: string | null;
  status: string;
  createdByName: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const TYPES = [
  { key: "complaint", label: "Complaint" },
  { key: "allergy", label: "Allergy incident" },
  { key: "injury", label: "Injury" },
  { key: "service", label: "Service issue" },
  { key: "other", label: "Other" },
];
const SEV: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  medium: { label: "Medium", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
  low: { label: "Low", cls: "bg-muted text-muted-foreground" },
};

export function IncidentsClient({ incidents }: { incidents: Incident[] }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("complaint");
  const [severity, setSeverity] = useState("medium");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resText, setResText] = useState("");

  function save() {
    setErr(null);
    start(async () => {
      const res = await addIncident({ type, severity, body });
      if ("error" in res) { setErr(res.error); return; }
      setBody(""); setAdding(false);
    });
  }
  function doResolve(id: string) {
    start(async () => { await resolveIncident(id, resText); setResolvingId(null); setResText(""); });
  }

  const typeLabel = (t: string) => TYPES.find((x) => x.key === t)?.label ?? t;
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const open = incidents.filter((i) => i.status === "open");
  const resolved = incidents.filter((i) => i.status === "resolved");

  return (
    <div>
      <div className="mb-5">
        {!adding ? (
          <Button onClick={() => { setErr(null); setAdding(true); }}>Log an incident</Button>
        ) : (
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-44 rounded-md border border-border bg-transparent px-2 text-sm">
                  {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 w-32 rounded-md border border-border bg-transparent px-2 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="What happened — guest, table, the issue, who was involved. Include allergy details if relevant."
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={pending || !body.trim()}>{pending ? "Saving…" : "Save incident"}</Button>
              <Button variant="outline" onClick={() => { setAdding(false); setBody(""); }} disabled={pending}>Cancel</Button>
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>
          </div>
        )}
      </div>

      {incidents.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No incidents logged. Use this to record complaints, allergy incidents and how they were resolved.
        </div>
      ) : (
        <div className="space-y-5">
          {open.length > 0 && (
            <Section title={`Open (${open.length})`}>
              {open.map((i) => (
                <Row key={i.id} i={i} typeLabel={typeLabel} fmt={fmt} pending={pending}>
                  {resolvingId === i.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input value={resText} onChange={(e) => setResText(e.target.value)} placeholder="How was it resolved?" className="h-8 flex-1 min-w-[180px] rounded-md border border-border bg-transparent px-2 text-sm" />
                      <Button className="h-8" onClick={() => doResolve(i.id)} disabled={pending}>Mark resolved</Button>
                      <Button variant="outline" className="h-8" onClick={() => { setResolvingId(null); setResText(""); }} disabled={pending}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-3 text-[11px]">
                      <button onClick={() => { setResolvingId(i.id); setResText(""); }} className="underline text-emerald-600">resolve</button>
                      <button onClick={() => start(async () => { await deleteIncident(i.id); })} disabled={pending} className="underline text-red-600">delete</button>
                    </div>
                  )}
                </Row>
              ))}
            </Section>
          )}
          {resolved.length > 0 && (
            <Section title={`Resolved (${resolved.length})`}>
              {resolved.map((i) => (
                <Row key={i.id} i={i} typeLabel={typeLabel} fmt={fmt} pending={pending}>
                  {i.resolution && <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Resolution:</span> {i.resolution}</p>}
                  <div className="mt-2 flex gap-3 text-[11px]">
                    <button onClick={() => start(async () => { await reopenIncident(i.id); })} disabled={pending} className="underline text-muted-foreground">reopen</button>
                    <button onClick={() => start(async () => { await deleteIncident(i.id); })} disabled={pending} className="underline text-red-600">delete</button>
                  </div>
                </Row>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">{children}</div>
      </div>
    );
  }
}

function Row({ i, typeLabel, fmt, children }: { i: Incident; typeLabel: (t: string) => string; fmt: (iso: string) => string; pending: boolean; children: React.ReactNode }) {
  const sev = SEV[i.severity] ?? SEV.medium;
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-medium text-sm">{typeLabel(i.type)}</span>
        <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + sev.cls}>{sev.label}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{fmt(i.createdAt)}{i.createdByName ? " · " + i.createdByName : ""}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{i.body}</p>
      {children}
    </div>
  );
}
