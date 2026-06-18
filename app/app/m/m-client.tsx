"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { liveSnapshot, type Snapshot } from "./actions";

const REFRESH_MS = 20000;

export function MobileManagerClient({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: snap.currency }).format(n);

  async function refresh() {
    setRefreshing(true);
    try {
      const next = await liveSnapshot();
      setSnap(next);
      setUpdatedAt(Date.now());
    } catch {
      /* keep showing last good data */
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    timer.current = setInterval(refresh, REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const multi = snap.locations.length > 1;

  return (
    <div className="max-w-md mx-auto pb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className={"inline-block w-2 h-2 rounded-full " + (refreshing ? "bg-amber-400" : "bg-green-500 animate-pulse")} />
            Today {"·"} updated {timeAgo(updatedAt)}
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-accent"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Big label="Net sales" value={fmt(snap.totals.net)} />
        <Big label="Orders" value={String(snap.totals.orders)} />
        <Big label="Avg ticket" value={fmt(snap.avgTicket)} />
        <Big
          label="Open checks"
          value={String(snap.totals.openChecks)}
          hint={snap.totals.openValue > 0 ? fmt(snap.totals.openValue) + " in progress" : undefined}
        />
      </div>

      {(snap.alerts.voids.n > 0 ||
        snap.alerts.unassigned > 0 ||
        snap.alerts.staleChecks > 0 ||
        snap.alerts.openDrawers > 0) && (
        <>
          <SectionHeader>Needs attention</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            {snap.alerts.voids.n > 0 && (
              <Alert label="Voids today" value={String(snap.alerts.voids.n)} hint={fmt(snap.alerts.voids.amt)} tone="red" />
            )}
            {snap.alerts.unassigned > 0 && (
              <Alert label="Unassigned sales" value={String(snap.alerts.unassigned)} tone="amber" />
            )}
            {snap.alerts.staleChecks > 0 && (
              <Alert
                label="Stale checks (90m+)"
                value={String(snap.alerts.staleChecks)}
                hint={snap.alerts.oldestCheckMin > 0 ? "oldest " + snap.alerts.oldestCheckMin + "m" : undefined}
                tone="amber"
              />
            )}
            {snap.alerts.openDrawers > 0 && (
              <Alert label="Open drawers" value={String(snap.alerts.openDrawers)} tone="muted" />
            )}
          </div>
          <div className="mt-2">
            <Link href="/app/exceptions" className="text-xs text-muted-foreground underline hover:text-foreground">
              Exceptions by employee →
            </Link>
          </div>
        </>
      )}

      {multi && (
        <>
          <SectionHeader>By location</SectionHeader>
          <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
            {snap.locations.map((l) => (
              <div key={l.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.orders} {l.orders === 1 ? "order" : "orders"}
                    {l.openChecks > 0 ? ` · ${l.openChecks} open` : ""}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">{fmt(l.net)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHeader>Recent sales</SectionHeader>
      {snap.recent.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No sales yet.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {snap.recent.map((r) => (
            <div key={r.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {timeOf(r.at)}{multi && r.location ? ` · ${r.location}` : ""}
                </div>
              </div>
              <div className="font-semibold tabular-nums">{fmt(r.total)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Link href="/app" className="flex-1 text-center text-sm rounded-md border border-border px-3 py-2 hover:bg-accent">
          Dashboard
        </Link>
        <Link href="/app/reports" className="flex-1 text-center text-sm rounded-md border border-border px-3 py-2 hover:bg-accent">
          Reports
        </Link>
      </div>
    </div>
  );
}

function Alert({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "red" | "amber" | "muted" }) {
  const ring = tone === "red" ? "border-red-500/40 bg-red-500/5" : tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border";
  const txt = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className={"rounded-lg border p-3 " + ring}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-2xl font-semibold tabular-nums mt-0.5 " + txt}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-2 mt-6">
      {children}
    </h2>
  );
}

function timeOf(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}
function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  return Math.round(s / 60) + "m ago";
}
