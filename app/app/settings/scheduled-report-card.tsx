"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setScheduledReport } from "./scheduled-report-actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduledReportCard({
  enabled: initEnabled = false,
  frequency: initFreq = "daily",
  weekday: initWeekday = 1,
  recipients: initRecipients = "",
}: {
  enabled?: boolean;
  frequency?: "daily" | "weekly";
  weekday?: number;
  recipients?: string;
}) {
  const [enabled, setEnabled] = useState(initEnabled);
  const [frequency, setFrequency] = useState<"daily" | "weekly">(initFreq);
  const [weekday, setWeekday] = useState(initWeekday);
  const [recipients, setRecipients] = useState(initRecipients);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setScheduledReport({ enabled, frequency, weekday, recipients });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Email a sales, labor and prime-cost digest automatically. Daily covers the prior day; weekly covers the last 7 days and sends on the chosen day.
      </p>
      <label className="flex items-start gap-2 text-sm select-none mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span className="font-medium">Send a scheduled report</span>
      </label>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Frequency</Label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")} className="h-9 w-32 rounded-md border border-border bg-transparent px-2 text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        {frequency === "weekly" && (
          <div className="space-y-1">
            <Label className="text-xs">Send on</Label>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="h-9 w-36 rounded-md border border-border bg-transparent px-2 text-sm">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1 mb-3">
        <Label className="text-xs">Recipients</Label>
        <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="owner@restaurant.com, accountant@…" className="h-9 max-w-md" />
        <p className="text-[12px] text-muted-foreground">Comma-separated. Leave blank to use your Z-report email list.</p>
      </div>

      <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
      <p className="text-[12px] text-muted-foreground mt-3">
        Sent once a day by a scheduled job (around 9–10am ET). Requires email to be configured for the workspace.
      </p>
    </div>
  );
}
