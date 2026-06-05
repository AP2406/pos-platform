// Client-only helper for QZ Tray printing + saved printer config.
// Prints the receipt silently through a configured printer when QZ Tray is
// running, and falls back to the browser print dialog when it is not.

export type PrinterConfig = { printerName: string; widthMm: number; autoPrint: boolean };

const STORAGE_KEY = "surge_printer_config_v1";
const QZ_SRC = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js";

function getQz(): any {
  if (typeof window === "undefined") return null;
  return (window as any).qz || null;
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
      reject(new Error("Could not load the QZ Tray library. A VPN, ad blocker, or shield may be blocking jsdelivr.net."));
    };
    document.body.appendChild(s);
  });
  return loadPromise;
}

// Connect to the local QZ Tray instance. Returns false if QZ Tray isn't running.
export async function qzConnect(): Promise<boolean> {
  let qz: any = null;
  try {
    qz = await loadQz();
  } catch (e) {
    return false;
  }
  if (!qz || !qz.websocket) return false;
  try {
    if (typeof qz.websocket.isActive === "function" && qz.websocket.isActive()) return true;
    await qz.websocket.connect({ retries: 2, delay: 1 });
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

// High-level: print receipt HTML silently via the saved QZ printer, or fall back
// to the browser dialog (the original behavior) when no printer is configured or
// QZ Tray can't be reached.
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