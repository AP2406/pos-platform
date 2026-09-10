"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  qzConnect,
  qzListPrinters,
  qzPrintHtml,
  subscribePrinterStatus,
  recheckStatus,
  getPrinterConfig,
  savePrinterConfig,
  clearPrinterConfig,
  type PrinterStatus,
  type StatusLevel,
} from "./qz-print";

const WIDTHS: { mm: number; label: string }[] = [
  { mm: 48, label: "58mm paper" },
  { mm: 54, label: "60mm paper" },
  { mm: 72, label: "80mm paper" },
];

function sampleHtml(businessName: string, widthMm: number): string {
  const safe = businessName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    "<html><head><title>Test</title>" +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<style>" +
    "*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}" +
    "body{font-family:'Courier New',monospace;font-size:11px;line-height:1.3;color:#000;width:" +
    widthMm +
    "mm;margin:0 auto;padding:4px 2mm 12mm}" +
    "h2{text-align:center;font-size:15px;margin:2px 0 4px}.center{text-align:center}" +
    ".line{border-top:1px dashed #000;margin:5px 0}" +
    "@media print{@page{margin:0}html,body{width:" +
    widthMm +
    "mm}}" +
    "</style></head><body>" +
    "<h2>" +
    safe +
    "</h2>" +
    '<div class="center">Printer test</div>' +
    '<div class="line"></div>' +
    '<div class="center">If you can read this, your<br/>receipt printer is working.</div>' +
    '<div class="line"></div>' +
    '<div class="center">' +
    new Date().toLocaleString() +
    "</div>" +
    "</body></html>"
  );
}

const LEVEL_STYLES: Record<StatusLevel, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  error: "bg-red-500/15 text-red-600 border-red-500/30",
  offline: "bg-red-500/15 text-red-600 border-red-500/30",
  checking: "bg-muted text-muted-foreground border-border",
};

export function PrinterSettings({ businessName, stations = [] }: { businessName: string; stations?: { id: string; name: string }[] }) {
  const [conn, setConn] = useState<"checking" | "offline" | "online">("checking");
  const [printers, setPrinters] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [widthMm, setWidthMm] = useState<number>(54);
  const [autoPrint, setAutoPrint] = useState<boolean>(true);
  // Per-station chit printers (opt-in). Empty ⇒ station printing OFF (screen-only).
  const [stationPrinters, setStationPrinters] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<boolean>(false);
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const cfg = getPrinterConfig();
    if (cfg) {
      setSelected(cfg.printerName);
      setWidthMm(cfg.widthMm || 54);
      setAutoPrint(cfg.autoPrint);
      if (cfg.stationPrinters) setStationPrinters(cfg.stationPrinters);
      setSaved(true);
    }
    checkConn(cfg ? cfg.printerName : "");
  }, []);

  async function checkConn(preferred: string) {
    setConn("checking");
    const ok = await qzConnect();
    if (!ok) {
      setConn("offline");
      return;
    }
    setConn("online");
    const list = await qzListPrinters();
    setPrinters(list);
    if (!preferred) {
      const star = list.find(function (p) {
        return /star|tsp/i.test(p);
      });
      if (star) setSelected(star);
      else if (list.length > 0) setSelected((s) => (s ? s : list[0]));
    }
  }

  useEffect(() => {
    if (conn !== "online" || !selected || !saved) {
      setStatus(null);
      return;
    }
    let active = true;
    let unsub: (() => void) | null = null;
    setStatus({ level: "checking", code: "CHECKING", message: "Checking printer\u2026" });
    subscribePrinterStatus(selected, function (s) {
      if (active) setStatus(s);
    }).then(function (u) {
      if (active) unsub = u;
      else u();
    });
    return function () {
      active = false;
      if (unsub) unsub();
    };
  }, [conn, selected, saved]);

  function save() {
    if (!selected) {
      setMsg("Choose a printer first.");
      return;
    }
    const cleanedStations = Object.fromEntries(Object.entries(stationPrinters).filter(([, p]) => p));
    savePrinterConfig({ printerName: selected, widthMm: widthMm, autoPrint: autoPrint, stationPrinters: Object.keys(cleanedStations).length > 0 ? cleanedStations : undefined });
    setSaved(true);
    setMsg("Saved. This printer stays connected until you disconnect it.");
  }

  function disconnect() {
    clearPrinterConfig();
    setSaved(false);
    setStatus(null);
    setMsg("Printer disconnected. Receipts will use the browser print dialog until you connect one again.");
  }

  async function test() {
    if (!selected) return;
    setTesting(true);
    setMsg(null);
    try {
      await qzPrintHtml(selected, sampleHtml(businessName, widthMm), widthMm);
      setMsg("Test sent to " + selected + ".");
    } catch (e) {
      setMsg("Couldn't print the test. Check the status below.");
    }
    setTesting(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
              (conn === "online"
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                : conn === "offline"
                ? "bg-red-500/15 text-red-600 border-red-500/30"
                : "bg-muted text-muted-foreground border-border")
            }
          >
            <span className={"w-1.5 h-1.5 rounded-full " + (conn === "online" ? "bg-emerald-500" : conn === "offline" ? "bg-red-500" : "bg-muted-foreground")} />
            {conn === "online" ? "QZ Tray connected" : conn === "offline" ? "QZ Tray not running" : "Checking\u2026"}
          </span>
        </div>
        <button type="button" onClick={() => checkConn(selected)} className="text-xs text-muted-foreground underline hover:text-foreground">
          Recheck
        </button>
      </div>

      {conn === "offline" && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
          <p className="font-medium">QZ Tray isn&apos;t running</p>
          <p className="text-muted-foreground">
            Silent receipt printing needs the free QZ Tray app running on this computer. Install it, make sure its icon is showing near the clock, then Recheck. If it&apos;s installed but still not found, turn off any VPN or shield and try again.
          </p>
          <a href="https://qz.io/download" target="_blank" rel="noreferrer" className="inline-block text-sm font-medium underline">
            Download QZ Tray
          </a>
        </div>
      )}

      {conn === "online" && (
        <>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Receipt printer</label>
            {printers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No printers found in Windows. Add your printer in Windows first, then Recheck.</p>
            ) : (
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                <option value="">Select a printer...</option>
                {printers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Paper width</label>
            <div className="flex gap-2">
              {WIDTHS.map((w) => {
                const active = widthMm === w.mm;
                return (
                  <button key={w.mm} type="button" onClick={() => setWidthMm(w.mm)} className={"flex-1 p-2.5 rounded-md border text-sm transition-colors " + (active ? "border-foreground bg-accent font-medium" : "border-border hover:border-foreground/40")}>
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="w-4 h-4" />
            Print receipt automatically after each sale
          </label>

          {stations.length > 0 && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm font-medium">Kitchen station printers <span className="text-xs font-normal text-muted-foreground">(optional)</span></div>
              <p className="text-xs text-muted-foreground">
                Route each station&rsquo;s chit to its own printer when a ticket fires. Leave a station on &ldquo;Off&rdquo; to keep it screen-only. This is per-device — set it up on the device wired to the kitchen printers.
              </p>
              {stations.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">{s.name}</span>
                  <select
                    value={stationPrinters[s.id] ?? ""}
                    onChange={(e) => setStationPrinters((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm max-w-[55%]"
                  >
                    <option value="">Off (screen only)</option>
                    {printers.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="text-[12px] text-amber-600">
                ⚠ Not verified against a physical printer yet — <strong>test-print each station</strong> and run a live fire before a kitchen relies on this. Falls back to the KDS screen if a printer is offline.
              </p>
            </div>
          )}

          {saved && status && (
            <div className={"rounded-md border p-3 " + LEVEL_STYLES[status.level]}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {status.level === "ok" ? "Printer ready" : status.level === "checking" ? "Checking\u2026" : status.level === "offline" ? "Printer offline" : status.level === "warning" ? "Heads up" : "Printer problem"}
                </div>
                <button type="button" onClick={() => recheckStatus()} className="text-xs underline opacity-80 hover:opacity-100">
                  Recheck
                </button>
              </div>
              <div className="text-sm mt-0.5">{status.message}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={save} disabled={!selected}>
              {saved ? "Update printer" : "Connect printer"}
            </Button>
            <Button variant="outline" onClick={test} disabled={!selected || testing}>
              {testing ? "Printing..." : "Test print"}
            </Button>
            {saved && (
              <Button variant="outline" onClick={disconnect} className="text-red-600">
                Disconnect
              </Button>
            )}
          </div>
        </>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Status detail depends on what your printer reports to Windows. Most thermal printers report offline and out-of-paper reliably; jams and an open cover are reported by some drivers but not all.
      </p>
    </div>
  );
}