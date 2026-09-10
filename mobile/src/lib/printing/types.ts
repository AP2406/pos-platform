// Printing abstraction — brand-agnostic. Formatters produce a structured PrintJob;
// a driver renders it (Star / Epson native SDK, or the no-op that ships for the
// pilot). Money-INDEPENDENT: a chit/receipt is an artifact of an already-decided
// order, never a charge.

export type PrintAlign = "left" | "center" | "right";
export type PrintSize = "sm" | "md" | "lg";

export type PrintLine =
  | { kind: "text"; text: string; bold?: boolean; size?: PrintSize; align?: PrintAlign }
  | { kind: "cols"; left: string; right: string; bold?: boolean } // two-column (item / price)
  | { kind: "rule" }
  | { kind: "feed"; lines?: number }
  | { kind: "cut" };

export type PrintWidth = 58 | 80; // paper width in mm
export type PrintJob = { title: string; width: PrintWidth; lines: PrintLine[] };

export type PrinterBrand = "star" | "epson" | "none";
export type PrinterConnection = "lan" | "bluetooth" | "usb";
export type PrinterTarget = {
  id: string;
  brand: PrinterBrand;
  connection: PrinterConnection;
  address?: string | null; // IP / BT identifier
  widthMm: PrintWidth;
};

// `printed:false` with ok:true = intentionally skipped (no printer configured) —
// the graceful no-op, exactly like the web QZ layer when station printing is off.
export type PrintResult = { ok: true; printed: boolean } | { ok: false; error: string };

export interface PrinterDriver {
  readonly name: string;
  print(target: PrinterTarget | null, job: PrintJob): Promise<PrintResult>;
  discover?(): Promise<PrinterTarget[]>;
}

// Chars per line by paper width (monospace thermal), for two-column layout.
export function colsFor(width: PrintWidth): number {
  return width === 80 ? 48 : 32;
}
