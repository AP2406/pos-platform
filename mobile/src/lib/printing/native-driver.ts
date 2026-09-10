import type { PrinterDriver, PrinterTarget, PrintJob, PrintResult, PrinterBrand, PrinterConnection, PrintWidth } from "./types";
import { noopDriver } from "./noop-driver";
import { renderPlainText } from "./format";
import * as SurgePrinter from "../../../modules/surge-printer";

// Boundary to the SurgePrinter native module (modules/surge-printer). On device
// the module is linked and currently returns a no-op success; in Expo Go / when
// unlinked it isn't available and we fall back to the no-op driver — so the app
// runs identically either way. Once the Star/Epson SDK is bound in the Swift
// module (printed:true), printing goes live with no changes here.

export const nativeDriver: PrinterDriver = {
  name: "native",
  async print(target: PrinterTarget | null, job: PrintJob): Promise<PrintResult> {
    if (!target) return { ok: true, printed: false }; // no printer configured
    if (!SurgePrinter.isNativePrinterAvailable()) return noopDriver.print(target, job);
    try {
      const res = await SurgePrinter.printJob(target, renderPlainText(job));
      return { ok: true, printed: !!res?.printed };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Print failed." };
    }
  },
  async discover(): Promise<PrinterTarget[]> {
    if (!SurgePrinter.isNativePrinterAvailable()) return [];
    try {
      const found = await SurgePrinter.discover();
      return found.map((t) => ({
        id: t.id,
        brand: t.brand as PrinterBrand,
        connection: t.connection as PrinterConnection,
        address: t.address ?? null,
        widthMm: (t.widthMm === 80 ? 80 : 58) as PrintWidth,
      }));
    } catch {
      return [];
    }
  },
};
