import { nativeDriver } from "./native-driver";
import { chitJob, receiptJob, renderPlainText, type ChitArgs, type ReceiptArgs } from "./format";
import type { PrinterBrand, PrinterTarget, PrintResult, PrintJob } from "./types";
import { isNativePrinterAvailable } from "../../../modules/surge-printer";
import { demoOn } from "../demo/state";

export * from "./types";
export { chitJob, receiptJob, renderPlainText };

// Map a device-profile printer id (see lib/device-profile PRINTER_TARGETS) to a
// resolved target. "none"/null ⇒ no printer ⇒ printing is skipped (screen-only).
export function resolveTarget(printerId: string | null): PrinterTarget | null {
  if (!printerId || printerId === "none") return null;
  const brand: PrinterBrand = printerId.includes("epson") ? "epson" : printerId.includes("star") ? "star" : "none";
  const width = printerId.includes("kitchen") ? 80 : 58;
  return { id: printerId, brand, connection: "lan", address: null, widthMm: width };
}

// The active driver. Currently the native driver, which self-degrades to a no-op
// when the SDK module isn't linked (the pilot) — so callers never branch.
export function getPrinter() {
  return nativeDriver;
}

// Fire a kitchen chit for the printer configured on this device. Always resolves;
// returns printed:false when no printer is set. NEVER throws into the order flow.
export async function printKitchenChit(printerId: string | null, args: ChitArgs): Promise<PrintResult> {
  if (demoOn()) return { ok: true, printed: true }; // demo: never reaches a real printer
  const target = resolveTarget(printerId);
  const job = chitJob(args, target?.widthMm ?? 80);
  return getPrinter().print(target, job);
}

export async function printReceipt(printerId: string | null, args: ReceiptArgs): Promise<PrintResult> {
  if (demoOn()) return { ok: true, printed: true };
  const target = resolveTarget(printerId);
  const job = receiptJob(args, target?.widthMm ?? 58);
  return getPrinter().print(target, job);
}

// ── Device-settings helpers ─────────────────────────────────────────────────
// Connection status for the printer picker. The pilot build ships without the
// Star/Epson SDK bound, so a chosen printer reads "Not connected" until it is —
// honest, merchant-facing, and it flips to "Connected" with no UI change.
export type PrinterStatus = "none" | "not_connected" | "connected";

export function printerStatus(printerId: string | null): PrinterStatus {
  if (!resolveTarget(printerId)) return "none";
  return isNativePrinterAvailable() ? "connected" : "not_connected";
}

// Print a short test page to the configured printer. Same PrintResult semantics
// as chits/receipts: ok+printed:false means nothing was sent (no hardware yet).
export async function printTestPage(printerId: string | null, businessName: string): Promise<PrintResult> {
  if (demoOn()) return { ok: true, printed: true };
  const target = resolveTarget(printerId);
  const job: PrintJob = {
    title: "Test page",
    width: target?.widthMm ?? 58,
    lines: [
      { kind: "text", text: businessName, bold: true, size: "lg", align: "center" },
      { kind: "text", text: "Surge POS — printer test", align: "center" },
      { kind: "rule" },
      { kind: "text", text: new Date().toLocaleString(), align: "center" },
      { kind: "feed", lines: 2 },
      { kind: "cut" },
    ],
  };
  return getPrinter().print(target, job);
}
