"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  qzConnect,
  qzListPrinters,
  qzPrintHtml,
  getPrinterConfig,
  savePrinterConfig,
  clearPrinterConfig,
} from "./qz-print";

type Props = {
  open: boolean;
  onClose: () => void;
  businessName: string;
};

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
    "*{box-sizing:border-box}" +
    "html,body{margin:0;padding:0;background:#fff}" +
    "body{font-family:'Courier New',monospace;font-size:11px;line-height:1.3;color:#000;width:" +
    widthMm +
    "mm;margin:0 auto;padding:4px 2mm 12mm}" +
    "h2{text-align:center;font-size:15px;margin:2px 0 4px}" +
    ".center{text-align:center}" +
    ".line{border-top:1px dashed #000;margin:5px 0}" +
    "table{width:100%;border-collapse:collapse}td{padding:1px 0}" +
    "@media print{@page{margin:0}html,body{width:" +
    widthMm +
    "mm}}" +
    "</style></head><body>" +
    "<h2>" +
    safe +
    "</h2>" +
    '<div class="center">Printer test</div>' +
    '<div class="line"></div>' +
    "<table>" +
    '<tr><td>Test item</td><td style="text-align:right">$1.00</td></tr>' +
    '<tr><td>Another item</td><td style="text-align:right">$2.50</td></tr>' +
    "</table>" +
    '<div class="line"></div>' +
    '<table><tr><td><b>Total</b></td><td style="text-align:right"><b>$3.50</b></td></tr></table>' +
    '<div class="center" style="margin-top:8px">If you can read this, you are all set!</div>' +
    "</body></html>"
  );
}

export function PrinterSetup(props: Props) {
  const [status, setStatus] = useState<"checking" | "offline" | "online">("checking");
  const [printers, setPrinters] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [widthMm, setWidthMm] = useState<number>(54);
  const [autoPrint, setAutoPrint] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(
    function () {
      if (!props.open) return;
      const cfg = getPrinterConfig();
      if (cfg) {
        setSelected(cfg.printerName);
        setWidthMm(cfg.widthMm || 54);
        setAutoPrint(cfg.autoPrint);
      }
      check();
    },
    [props.open]
  );

  async function check() {
    setStatus("checking");
    setMsg(null);
    const ok = await qzConnect();
    if (!ok) {
      setStatus("offline");
      return;
    }
    const list = await qzListPrinters();
    setPrinters(list);
    setStatus("online");
    const cfg = getPrinterConfig();
    if (cfg && list.indexOf(cfg.printerName) !== -1) {
      setSelected(cfg.printerName);
    } else if (!selected) {
      const star = list.find(function (n) {
        return n.toLowerCase().indexOf("star") !== -1 || n.toLowerCase().indexOf("tsp") !== -1;
      });
      if (star) setSelected(star);
    }
  }

  async function testPrint() {
    if (!selected) {
      setMsg("Choose a printer first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await qzPrintHtml(selected, sampleHtml(props.businessName, widthMm), widthMm);
      setMsg("Test sent. Check the printer.");
    } catch (e) {
      setMsg("Could not print: " + String(e));
    }
    setBusy(false);
  }

  function save() {
    if (!selected) {
      setMsg("Choose a printer first.");
      return;
    }
    savePrinterConfig({ printerName: selected, widthMm: widthMm, autoPrint: autoPrint });
    setSaved(true);
    setMsg("Saved. Receipts will print to " + selected + ".");
  }

  function disconnect() {
    clearPrinterConfig();
    setSelected("");
    setAutoPrint(false);
    setSaved(false);
    setMsg("Cleared. Receipts will use the browser print dialog.");
  }

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={props.onClose}>
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Receipt printer setup</h3>
          <button type="button" onClick={props.onClose} className="text-xs text-muted-foreground underline">
            Close
          </button>
        </div>

        {status === "checking" && (
          <p className="text-sm text-muted-foreground py-6 text-center">Looking for QZ Tray...</p>
        )}

        {status === "offline" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              QZ Tray isn&apos;t running on this computer. It&apos;s a small free app that lets the
              browser print straight to your receipt printer with no pop-up.
            </div>
            <ol className="text-sm space-y-2 list-decimal pl-5">
              <li>
                Install your <span className="font-medium">Star TSP100 driver</span> so the printer shows up in Windows
                (skip if it&apos;s already installed).
              </li>
              <li>
                Download and install QZ Tray from{" "}
                <a href="https://qz.io/download" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  qz.io/download
                </a>
                , then make sure it&apos;s running (look for its icon near the clock).
              </li>
              <li>Come back here and click Check again. The first time you print, QZ Tray asks you to Allow this site &mdash; tick &quot;remember&quot; and Allow.</li>
            </ol>
            <Button className="w-full" onClick={check}>
              Check again
            </Button>
          </div>
        )}

        {status === "online" && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
              QZ Tray is connected.
            </div>

            <div>
              <label className="text-xs font-medium">Printer</label>
              {printers.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  No printers found. Make sure the Star driver is installed and the printer is on, then{" "}
                  <button type="button" onClick={check} className="text-blue-600 underline">
                    refresh
                  </button>
                  .
                </p>
              ) : (
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm mt-1"
                >
                  <option value="">Select a printer...</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium">Paper width</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {WIDTHS.map((w) => {
                  const active = widthMm === w.mm;
                  return (
                    <button
                      key={w.mm}
                      type="button"
                      onClick={() => setWidthMm(w.mm)}
                      className={"py-2 rounded-md border text-sm transition-colors " + (active ? "border-foreground bg-accent font-medium" : "border-border hover:border-foreground/40")}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="w-4 h-4" />
              Print receipts automatically when a sale completes
            </label>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={testPrint} disabled={busy || !selected}>
                {busy ? "Sending..." : "Test print"}
              </Button>
              <Button className="flex-1" onClick={save} disabled={!selected}>
                Save
              </Button>
            </div>

            {getPrinterConfig() && (
              <button type="button" onClick={disconnect} className="w-full text-xs text-muted-foreground underline hover:text-foreground">
                Stop using this printer
              </button>
            )}
          </div>
        )}

        {msg && <p className={"text-sm mt-3 " + (saved ? "text-emerald-600" : "text-muted-foreground")}>{msg}</p>}
      </div>
    </div>
  );
}