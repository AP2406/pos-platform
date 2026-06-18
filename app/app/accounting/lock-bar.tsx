"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPeriodLock } from "./lock-actions";

export function LockBar({
  currentLock,
  throughDate,
  isOwner,
}: {
  currentLock: string | null;
  throughDate: string;
  isOwner: boolean;
}) {
  const [lock, setLock] = useState<string | null>(currentLock);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doLock() {
    setErr(null);
    start(async () => {
      const res = await setPeriodLock(throughDate);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setLock(throughDate);
    });
  }

  const canLock = isOwner && (lock == null || lock < throughDate);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">
        {lock ? (
          <>
            Books locked through <span className="font-medium text-foreground">{lock}</span> — sales
            on/before are read-only.
          </>
        ) : (
          "This period is open — its sales can still be voided/reopened/adjusted."
        )}
      </span>
      <div className="flex items-center gap-2">
        {err && <span className="text-red-600">{err}</span>}
        {canLock && (
          <Button size="sm" variant="outline" onClick={doLock} disabled={pending}>
            {pending ? "Locking..." : "Lock through " + throughDate}
          </Button>
        )}
      </div>
    </div>
  );
}
