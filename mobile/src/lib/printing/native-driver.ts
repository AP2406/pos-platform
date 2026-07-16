import { NativeModules } from "react-native";
import type { PrinterDriver, PrinterTarget, PrintJob, PrintResult } from "./types";
import { noopDriver } from "./noop-driver";
import { renderPlainText } from "./format";

// Boundary to the native Star/Epson SDK module. The pilot build has no such module
// linked, so `SurgePrinter` is undefined here and we transparently fall back to the
// no-op driver — the app runs identically, just screen-only.
//
// TO GO LIVE: add the Expo native module `SurgePrinter` exposing
//   printJob(target: PrinterTargetJSON, escposText: string): Promise<{printed: boolean}>
//   discover(): Promise<PrinterTargetJSON[]>
// backed by StarXpandSDK / Epson ePOS. This file already hands it the resolved
// target + a plain-text render; the native side expands that into ESC/POS.

type NativePrinterModule = {
  printJob(target: PrinterTarget, payload: string): Promise<{ printed: boolean }>;
  discover?(): Promise<PrinterTarget[]>;
};

function nativeModule(): NativePrinterModule | null {
  const m = (NativeModules as Record<string, unknown>).SurgePrinter;
  return m ? (m as NativePrinterModule) : null;
}

export const nativeDriver: PrinterDriver = {
  name: "native",
  async print(target: PrinterTarget | null, job: PrintJob): Promise<PrintResult> {
    if (!target) return { ok: true, printed: false }; // no printer configured
    const mod = nativeModule();
    if (!mod) return noopDriver.print(target, job); // SDK not linked (pilot) → no-op
    try {
      const res = await mod.printJob(target, renderPlainText(job));
      return { ok: true, printed: !!res?.printed };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Print failed." };
    }
  },
  async discover(): Promise<PrinterTarget[]> {
    const mod = nativeModule();
    if (!mod?.discover) return [];
    try {
      return await mod.discover();
    } catch {
      return [];
    }
  },
};
