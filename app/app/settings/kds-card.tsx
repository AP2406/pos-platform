"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setKdsThresholds } from "./kds-actions";

export function KdsCard({ warnMin, lateMin, autoCourse: initAuto = false, lang: initLang = "en", printerFallback: initFallback = false }: { warnMin: number; lateMin: number; autoCourse?: boolean; lang?: string; printerFallback?: boolean }) {
  const [warn, setWarn] = useState(String(warnMin));
  const [late, setLate] = useState(String(lateMin));
  const [autoCourse, setAutoCourse] = useState(initAuto);
  const [lang, setLang] = useState(initLang);
  const [printerFallback, setPrinterFallback] = useState(initFallback);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await setKdsThresholds({ warnMin: parseInt(warn) || 0, lateMin: parseInt(late) || 0, autoCourse, lang, printerFallback });
      if ("error" in res) { setErr(res.error); return; }
      setMsg("Saved.");
    });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        How long before a kitchen ticket turns amber, then red. An item&apos;s prep-time target (set in the Catalog) still overrides these per ticket.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Amber after (min)</Label>
          <Input value={warn} onChange={(e) => setWarn(e.target.value)} inputMode="numeric" className="h-9 w-28" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Red after (min)</Label>
          <Input value={late} onChange={(e) => setLate(e.target.value)} inputMode="numeric" className="h-9 w-28" />
        </div>
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm select-none">
        <input type="checkbox" checked={autoCourse} onChange={(e) => setAutoCourse(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span>
          <span className="font-medium">Auto-fire the next course</span>
          <span className="block text-xs text-muted-foreground">
            When a table&apos;s current course is fully bumped, automatically fire the next course to the kitchen. Off by default — manual fire still works.
          </span>
        </span>
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ticket language</Label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-9 w-36 rounded-md border border-border bg-transparent px-2 text-sm">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm select-none">
        <input type="checkbox" checked={printerFallback} onChange={(e) => setPrinterFallback(e.target.checked)} className="h-4 w-4 mt-0.5" />
        <span>
          <span className="font-medium">Printer failover</span>
          <span className="block text-xs text-muted-foreground">
            If a KDS screen loses its live connection, new tickets auto-print to the kitchen printer (requires a configured QZ printer).
          </span>
        </span>
      </label>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </div>
  );
}
