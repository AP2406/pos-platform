import { nativeDriver } from "./native-driver";
import { chitJob, receiptJob, renderPlainText, type ChitArgs, type ReceiptArgs } from "./format";
import type { PrinterBrand, PrinterTarget, PrintResult } from "./types";

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
  const target = resolveTarget(printerId);
  const job = chitJob(args, target?.widthMm ?? 80);
  return getPrinter().print(target, job);
}

export async function printReceipt(printerId: string | null, args: ReceiptArgs): Promise<PrintResult> {
  const target = resolveTarget(printerId);
  const job = receiptJob(args, target?.widthMm ?? 58);
  return getPrinter().print(target, job);
}
