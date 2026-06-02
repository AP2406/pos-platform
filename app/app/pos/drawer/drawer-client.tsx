"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openDrawerSession, closeDrawerSession } from "./actions";

function money(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
}

type OpenSession = {
  id: string;
  opened_at: string;
  starting_cash: number;
  cash: number;
  card: number;
  other: number;
  expected: number;
  count: number;
};

type ClosedSession = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  starting_cash: number;
  counted_cash: number;
  expected_cash: number;
  over_short: number;
};

export function DrawerClient({
  open,
  closed,
}: {
  open: OpenSession | null;
  closed: ClosedSession[];
}) {
  const [startingCash, setStartingCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    expected: number;
    counted: number;
    over_short: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

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

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const res = await closeDrawerSession({
        counted_cash: parseFloat(countedCash) || 0,
        note,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult({
        expected: res.expected,
        counted: res.counted,
        over_short: res.over_short,
      });
      setCountedCash("");
      setNote("");
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {result && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-medium mb-3">Register closed</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected in drawer</span>
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
            <h2 className="font-medium">Register open</h2>
            <span className="text-xs text-muted-foreground">
              {"Opened " + fmt(open.opened_at)}
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

          <div className="flex justify-between text-sm pt-3 border-t border-border">
            <span className="text-muted-foreground">
              {"Expected cash in drawer (" +
                open.count +
                (open.count === 1 ? " sale)" : " sales)")}
            </span>
            <span className="tabular-nums font-semibold">
              {money(open.expected)}
            </span>
          </div>

          <div className="pt-2 space-y-2">
            <Label htmlFor="counted" className="text-xs">
              Count the cash drawer
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
            <Button onClick={handleClose} disabled={pending}>
              {pending ? "Closing..." : "Close register"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h2 className="font-medium">Open register</h2>
          <p className="text-sm text-muted-foreground">
            Enter the cash you are starting the drawer with.
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
              {pending ? "Opening..." : "Open register"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Recent closeouts
        </h2>
        {closed.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground">No closeouts yet.</p>
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
    </div>
  );
}