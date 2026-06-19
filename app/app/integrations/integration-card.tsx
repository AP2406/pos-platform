"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIntegrationEnabled } from "./actions";

type Status = {
  key: string;
  label: string;
  description: string;
  configured: boolean;
  detail: string | null;
  envVars: string[];
  checklist: string[];
  enabled: boolean;
};

export function IntegrationCard({ status }: { status: Status }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(status.enabled);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setErr(null);
    setEnabled(next);
    start(async () => {
      const res = await setIntegrationEnabled(status.key, next);
      if ("error" in res) { setErr(res.error); setEnabled(!next); return; }
      router.refresh();
    });
  }

  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{status.label}</span>
            {status.configured ? (
              <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-medium">
                Configured{status.detail ? " · " + status.detail : ""}
              </span>
            ) : (
              <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-medium">Not configured</span>
            )}
            {enabled && <span className="text-[10px] rounded-full bg-foreground text-background px-2 py-0.5 font-medium">On</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{status.description}</p>
        </div>
        <label className="shrink-0 inline-flex items-center gap-1.5 text-xs select-none">
          <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={pending} className="h-4 w-4" />
          Enable
        </label>
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs text-muted-foreground underline hover:text-foreground">
        {open ? "Hide setup" : status.configured ? "Setup & test" : "What's needed"}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
          <div>
            <div className="font-medium mb-1">Checklist</div>
            <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
              {status.checklist.map((c, i) => <li key={i}>{c}</li>)}
            </ol>
          </div>
          <div>
            <div className="font-medium mb-1">Server environment variables</div>
            <div className="flex flex-wrap gap-1">
              {status.envVars.map((v) => <code key={v} className="rounded bg-background border border-border px-1.5 py-0.5">{v}</code>)}
            </div>
          </div>
          <p className="text-muted-foreground">
            {status.configured
              ? "Credentials detected. Enable above to activate for this business."
              : "Add these to the server environment (never commit secrets). The connector stays inactive until they're present."}
          </p>
        </div>
      )}
      {enabled && !status.configured && (
        <p className="text-[11px] text-amber-600 mt-2">Enabled, but credentials aren&apos;t configured yet — it stays inactive until they are.</p>
      )}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}
