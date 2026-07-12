// Client-only helper for QZ Tray printing, saved printer config, persistent
// connection (auto-reconnect), and printer status diagnostics.
import { type KitchenTicketConfig, KITCHEN_TICKET_DEFAULTS } from "@/lib/services/kitchen-ticket-config";

// stationPrinters (optional, per-device): map a kitchen station id → the printer its chit
// should print to when a ticket fires. Absent/empty ⇒ station printing is OFF and the
// kitchen is screen-only (default). The key "default" routes the no-station chit.
export type PrinterConfig = { printerName: string; widthMm: number; autoPrint: boolean; stationPrinters?: Record<string, string> };
export type StatusLevel = "ok" | "warning" | "error" | "offline" | "checking";
export type PrinterStatus = { level: StatusLevel; code: string; message: string };

const STORAGE_KEY = "surge_printer_config_v1";
const QZ_SRC = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js";

function getQz(): any {
  if (typeof window === "undefined") return null;
  return (window as any).qz || null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise(function (resolve, reject) {
    const t = setTimeout(function () {
      reject(new Error("timeout"));
    }, ms);
    p.then(
      function (v) {
        clearTimeout(t);
        resolve(v);
      },
      function (e) {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

let loadPromise: Promise<any> | null = null;

export function loadQz(): Promise<any> {
  const existing = getQz();
  if (existing) return Promise.resolve(existing);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise(function (resolve, reject) {
    const prior = document.getElementById("qz-tray-sdk") as HTMLScriptElement | null;
    if (prior) {
      prior.addEventListener("load", function () {
        resolve(getQz());
      });
      prior.addEventListener("error", function () {
        loadPromise = null;
        reject(new Error("Could not load the QZ Tray library."));
      });
      return;
    }
    const s = document.createElement("script");
    s.id = "qz-tray-sdk";
    s.src = QZ_SRC;
    s.async = true;
    s.onload = function () {
      resolve(getQz());
    };
    s.onerror = function () {
      loadPromise = null;
      reject(new Error("Could not load the QZ Tray library. A VPN, ad blocker, or shield may be blocking jsdelivr.net."));
    };
    document.body.appendChild(s);
  });
  return loadPromise;
}

let reconnectSet = false;
function setupReconnect(qz: any): void {
  if (reconnectSet) return;
  reconnectSet = true;
  try {
    if (typeof qz.websocket.setClosedCallbacks === "function") {
      qz.websocket.setClosedCallbacks(function () {
        setTimeout(function () {
          qzConnect();
        }, 3000);
      });
    }
  } catch (e) {}
}

// Connect to the local QZ Tray instance. Guarded by timeouts so it can never
// hang. Once connected, stays connected and auto-reconnects if the link drops.
export async function qzConnect(): Promise<boolean> {
  let qz: any = null;
  try {
    qz = await withTimeout(loadQz(), 7000);
  } catch (e) {
    return false;
  }
  if (!qz || !qz.websocket) return false;
  try {
    if (typeof qz.websocket.isActive === "function" && qz.websocket.isActive()) {
      setupReconnect(qz);
      return true;
    }
    await withTimeout(qz.websocket.connect({ retries: 1, delay: 1 }), 7000);
    setupReconnect(qz);
    return true;
  } catch (e) {
    return false;
  }
}

export async function qzListPrinters(): Promise<string[]> {
  const ok = await qzConnect();
  const qz = getQz();
  if (!ok || !qz) return [];
  try {
    const found = await qz.printers.find();
    if (Array.isArray(found)) return found;
    if (typeof found === "string") return [found];
    return [];
  } catch (e) {
    return [];
  }
}

export async function qzPrintHtml(printerName: string, html: string, widthMm: number): Promise<void> {
  const ok = await qzConnect();
  const qz = getQz();
  if (!ok || !qz) throw new Error("QZ Tray is not running.");
  const opts: any = { units: "mm" };
  if (widthMm && widthMm > 0) {
    opts.size = { width: widthMm, height: null };
    opts.margins = 0;
  }
  const config = qz.configs.create(printerName, opts);
  const data = [{ type: "pixel", format: "html", flavor: "plain", data: html }];
  await qz.print(config, data);
}

function normalizeStatus(evt: any): PrinterStatus {
  const raw = String((evt && (evt.status || evt.statusText || evt.message)) || "").toUpperCase();
  const severity = String((evt && evt.severity) || "").toUpperCase();
  const has = function (s: string): boolean {
    return raw.indexOf(s) !== -1;
  };

  if (has("JAM")) return { level: "error", code: "PAPER_JAM", message: "Paper jam \u2014 clear the jammed paper, then close the cover." };
  if (has("DOOR") || has("COVER") || has("OPEN")) return { level: "error", code: "COVER_OPEN", message: "The printer cover or paper door is open \u2014 close it." };
  if (has("PAPER_OUT") || has("OUT_OF_PAPER") || has("NO_PAPER") || has("PAPER_PROBLEM") || (has("PAPER") && has("OUT"))) return { level: "error", code: "PAPER_OUT", message: "Out of paper \u2014 load a new roll." };
  if (has("OFFLINE") || has("NOT_AVAILABLE") || has("UNAVAILABLE") || has("DISCONNECT")) return { level: "offline", code: "OFFLINE", message: "Printer is offline \u2014 it may be off, unplugged, or off the network." };
  if (has("PAUSED")) return { level: "warning", code: "PAUSED", message: "Printer is paused in Windows \u2014 resume it from Devices & printers." };
  if (has("TONER") || has("INK")) return { level: "warning", code: "SUPPLY_LOW", message: "Low toner or ink." };
  if (has("ERROR") || has("FAULT") || severity === "ERROR" || severity === "FATAL") return { level: "error", code: "ERROR", message: "Printer reported an error" + (raw ? " (" + raw.toLowerCase() + ")" : "") + "." };
  if (has("PRINTING") || has("BUSY") || has("PROCESSING") || has("SPOOL")) return { level: "ok", code: "BUSY", message: "Printing\u2026" };
  if (has("OK") || has("READY") || has("IDLE") || has("ONLINE") || has("NORMAL")) return { level: "ok", code: "READY", message: "Ready." };
  if (severity === "WARN" || severity === "WARNING") return { level: "warning", code: "WARN", message: raw ? raw.toLowerCase() : "Printer warning." };
  return { level: "ok", code: "READY", message: "Ready." };
}

let dispatcherSet = false;
let statusListener: ((s: PrinterStatus) => void) | null = null;
let listenedPrinter: string | null = null;

function ensureDispatcher(qz: any): void {
  if (dispatcherSet) return;
  try {
    qz.printers.setPrinterCallbacks(function (evt: any) {
      if (!statusListener) return;
      if (listenedPrinter && evt && evt.printerName && evt.printerName !== listenedPrinter) return;
      statusListener(normalizeStatus(evt));
    });
    dispatcherSet = true;
  } catch (e) {}
}

// Subscribe to live status for a printer. Calls cb immediately with the current
// situation and again whenever it changes. Returns an unsubscribe function.
export async function subscribePrinterStatus(printerName: string, cb: (s: PrinterStatus) => void): Promise<() => void> {
  let qz: any = null;
  try {
    qz = await withTimeout(loadQz(), 7000);
  } catch (e) {
    cb({ level: "error", code: "QZ_LIBRARY", message: "Couldn't load the QZ Tray library. A VPN, ad blocker, or shield may be blocking it \u2014 turn those off and recheck." });
    return function () {};
  }
  const connected = await qzConnect();
  if (!connected || !qz) {
    cb({ level: "offline", code: "QZ_NOT_RUNNING", message: "QZ Tray isn't running on this computer. Open the QZ Tray app (its icon sits near the clock), then recheck." });
    return function () {};
  }
  let printers: string[] = [];
  try {
    printers = await qzListPrinters();
  } catch (e) {}
  if (printerName && printers.indexOf(printerName) === -1) {
    cb({ level: "offline", code: "NOT_FOUND", message: "\u201c" + printerName + "\u201d isn\u2019t available right now \u2014 it may be turned off, unplugged, or removed from Windows." });
  }
  ensureDispatcher(qz);
  statusListener = cb;
  listenedPrinter = printerName || null;
  try {
    await qz.printers.startListening(printerName);
    await qz.printers.getStatus();
  } catch (e) {}
  return function () {
    if (statusListener === cb) statusListener = null;
    try {
      qz.printers.stopListening();
    } catch (e) {}
  };
}

export async function recheckStatus(): Promise<void> {
  const qz = getQz();
  if (!qz) return;
  try {
    await qz.printers.getStatus();
  } catch (e) {}
}

export function getPrinterConfig(): PrinterConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.printerName) return null;
    return {
      printerName: String(parsed.printerName),
      widthMm: Number(parsed.widthMm) || 0,
      autoPrint: parsed.autoPrint === true,
    };
  } catch (e) {
    return null;
  }
}

export function savePrinterConfig(cfg: PrinterConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

export function clearPrinterConfig(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function browserPrint(html: string): void {
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = function () {
    win.close();
  };
  setTimeout(function () {
    win.print();
  }, 300);
}

export function printReceiptHtml(html: string): void {
  const cfg = getPrinterConfig();
  if (cfg && cfg.printerName) {
    qzPrintHtml(cfg.printerName, html, cfg.widthMm).catch(function () {
      browserPrint(html);
    });
    return;
  }
  browserPrint(html);
}

type StationChit = { station_id: string | null; station_name: string | null; label: string | null; items: { name: string; quantity: number; note?: string | null; seat?: number | null; allergy?: string | null; allergens?: string[]; prep_minutes?: number | null }[] };

// Format a fired station chit for a thermal kitchen printer. `config` (manager-controlled,
// Phase 2 #8) gates which fields print; defaults reproduce the original hardcoded chit.
export function stationChitHtml(chit: StationChit, config: KitchenTicketConfig = KITCHEN_TICKET_DEFAULTS, firedAt?: string): string {
  const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const header = config.show_station_header && chit.station_name ? chit.station_name : chit.label || "Kitchen";
  const sub = config.show_station_header && chit.station_name && chit.label && chit.label !== chit.station_name ? chit.label : "";
  const rows = chit.items
    .map((it) => {
      const seat = config.show_seat && it.seat ? " (S" + it.seat + ")" : "";
      const prep = config.show_prep_time && it.prep_minutes ? " &middot; " + it.prep_minutes + "m" : "";
      const allergy = config.show_allergens ? it.allergy || (it.allergens && it.allergens.length ? it.allergens.join(", ") : "") : "";
      return (
        "<div style='display:flex;justify-content:space-between'><span>" + it.quantity + "x " + esc(it.name) + esc(seat) + prep + "</span></div>" +
        (config.show_note && it.note ? "<div style='font-size:11px;padding-left:8px'>&rarr; " + esc(it.note) + "</div>" : "") +
        (allergy ? "<div style='font-size:12px;padding-left:8px;font-weight:bold;color:#c00'>&#9888; " + esc(allergy) + "</div>" : "")
      );
    })
    .join("");
  return (
    "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<style>body{font-family:'Courier New',monospace;font-size:14px;width:72mm;margin:0 auto;padding:6px}h1{font-size:16px;margin:0 0 4px}</style></head><body>" +
    "<h1>" + esc(header) + "</h1>" +
    (sub ? "<div style='font-size:12px;margin-bottom:2px'>" + esc(sub) + "</div>" : "") +
    (config.show_fire_time && firedAt ? "<div style='font-size:11px;margin-bottom:4px'>" + esc(firedAt) + "</div>" : "") +
    rows + "</body></html>"
  );
}

// Print each fired chit to its station's mapped printer (opt-in, per-device). No-op unless
// station printers are configured — screen-only kitchens are unaffected. The "default" key
// routes a no-station chit. Best-effort per chit; never throws to the caller.
export async function printStationChits(chits: StationChit[], config: KitchenTicketConfig = KITCHEN_TICKET_DEFAULTS): Promise<{ printed: number; skipped: number }> {
  const cfg = getPrinterConfig();
  const map = cfg?.stationPrinters;
  if (!cfg || !map || Object.keys(map).length === 0) return { printed: 0, skipped: chits.length };
  try {
    await qzConnect();
  } catch {
    return { printed: 0, skipped: chits.length };
  }
  const firedAt = new Date().toLocaleTimeString();
  let printed = 0;
  let skipped = 0;
  for (const chit of chits) {
    const printer = map[chit.station_id || "default"];
    if (!printer) {
      skipped++;
      continue;
    }
    try {
      await qzPrintHtml(printer, stationChitHtml(chit, config, firedAt), cfg.widthMm || 72);
      printed++;
    } catch (e) {
      console.error("printStationChits: print failed for station " + (chit.station_id || "default"), e);
      skipped++;
    }
  }
  return { printed, skipped };
}