import type { PrinterDriver, PrinterTarget, PrintJob, PrintResult } from "./types";

// The driver that ships for the TestFlight pilot: it never touches hardware and
// always "succeeds" as a skip (printed:false). Identical spirit to the web QZ
// layer when no station printer is configured — the app is screen-only and
// nothing errors. Swapped for the real Star/Epson driver once the SDK is bound.
export const noopDriver: PrinterDriver = {
  name: "noop",
  async print(_target: PrinterTarget | null, _job: PrintJob): Promise<PrintResult> {
    return { ok: true, printed: false };
  },
  async discover(): Promise<PrinterTarget[]> {
    return [];
  },
};
