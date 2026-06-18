"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDayClose } from "./day-close-actions";

export function DayCloseCard({
  cutoff: initCutoff,
  emails: initEmails,
}: {
  cutoff: string;
  emails: string[];
}) {
  const [cutoff, setCutoff] = useState(initCutoff || "00:00");
  const [emails, setEmails] = useState((initEmails || []).join(", "));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await setDayClose({ cutoff, emails });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        The business-day cutoff attributes late-night sales to the correct day
        (e.g. 04:00 means a 2am sale counts for the night before). The Z-report is
        emailed to these addresses when you end the day.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Business-day cutoff</Label>
          <Input
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            placeholder="04:00"
            className="h-9 w-28"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[14rem]">
          <Label className="text-xs">Z-report emails (comma-separated)</Label>
          <Input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="owner@example.com, books@example.com"
            className="h-9"
          />
        </div>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
