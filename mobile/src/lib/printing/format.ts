import { colsFor, type PrintJob, type PrintLine, type PrintWidth } from "./types";

// Pure formatters: turn a fired ticket / a completed order into a structured
// PrintJob. No I/O, fully testable. Mirrors what the web chit/receipt show.

export type ChitItem = { name: string; quantity: number; note?: string | null; allergy?: string | null; seat?: number | null };
export type ChitArgs = {
  label: string; // table / ticket label
  stationName?: string | null;
  items: ChitItem[];
  firedAt?: string | null;
  showSeat?: boolean;
  showAllergens?: boolean;
  showNote?: boolean;
};

const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const money = (n: number) => "$" + (n || 0).toFixed(2);

// Kitchen chit: big table header, then each line with qty, allergens (loud), note.
export function chitJob(args: ChitArgs, width: PrintWidth = 80): PrintJob {
  const showSeat = args.showSeat ?? true;
  const showAllergens = args.showAllergens ?? true;
  const showNote = args.showNote ?? true;
  const lines: PrintLine[] = [];
  if (args.stationName) lines.push({ kind: "text", text: args.stationName.toUpperCase(), align: "center", size: "sm" });
  lines.push({ kind: "text", text: args.label, bold: true, size: "lg", align: "center" });
  if (args.firedAt) lines.push({ kind: "text", text: "Fired " + timeOf(args.firedAt), align: "center", size: "sm" });
  lines.push({ kind: "rule" });
  for (const it of args.items) {
    const seat = showSeat && it.seat != null ? "  [S" + it.seat + "]" : "";
    lines.push({ kind: "text", text: it.quantity + "x  " + it.name + seat, bold: true, size: "md" });
    if (showAllergens && it.allergy) lines.push({ kind: "text", text: "  ** ALLERGY: " + it.allergy.toUpperCase() + " **", size: "sm" });
    if (showNote && it.note) lines.push({ kind: "text", text: "  - " + it.note, size: "sm" });
  }
  lines.push({ kind: "feed", lines: 1 });
  lines.push({ kind: "cut" });
  return { title: "Kitchen chit — " + args.label, width, lines };
}

export type ReceiptLine = { name: string; quantity: number; unitPrice: number };
export type ReceiptArgs = {
  businessName: string;
  saleNumber: number | null;
  createdAt: string;
  items: ReceiptLine[];
  subtotal: number;
  discount?: number;
  tax: number;
  tip?: number;
  total: number;
  payments?: { method: string; amount: number }[];
  footer?: string | null;
};

// Guest receipt: header, itemized lines with prices, totals, payment, footer.
export function receiptJob(args: ReceiptArgs, width: PrintWidth = 58): PrintJob {
  const lines: PrintLine[] = [];
  lines.push({ kind: "text", text: args.businessName, bold: true, size: "lg", align: "center" });
  // Sale # and timestamp on their own lines so neither overflows narrow paper.
  if (args.saleNumber != null) lines.push({ kind: "text", text: "Sale #" + args.saleNumber, align: "center", size: "sm" });
  lines.push({ kind: "text", text: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(args.createdAt)), align: "center", size: "sm" });
  lines.push({ kind: "rule" });
  for (const it of args.items) {
    lines.push({ kind: "cols", left: it.quantity + "x " + it.name, right: money(it.unitPrice * it.quantity) });
  }
  lines.push({ kind: "rule" });
  lines.push({ kind: "cols", left: "Subtotal", right: money(args.subtotal) });
  if (args.discount && args.discount > 0) lines.push({ kind: "cols", left: "Discount", right: "-" + money(args.discount) });
  lines.push({ kind: "cols", left: "Tax", right: money(args.tax) });
  if (args.tip && args.tip > 0) lines.push({ kind: "cols", left: "Tip", right: money(args.tip) });
  lines.push({ kind: "cols", left: "TOTAL", right: money(args.total), bold: true });
  for (const p of args.payments ?? []) lines.push({ kind: "cols", left: p.method, right: money(p.amount) });
  if (args.footer) {
    lines.push({ kind: "feed", lines: 1 });
    lines.push({ kind: "text", text: args.footer, align: "center", size: "sm" });
  }
  lines.push({ kind: "feed", lines: 2 });
  lines.push({ kind: "cut" });
  return { title: "Receipt" + (args.saleNumber != null ? " #" + args.saleNumber : ""), width, lines };
}

// Monospace plain-text render of a job — the print preview + the basis a real
// driver expands into ESC/POS. Deterministic, so it's unit-testable.
export function renderPlainText(job: PrintJob): string {
  const cols = colsFor(job.width);
  const out: string[] = [];
  const clip = (s: string) => (s.length > cols ? s.slice(0, cols) : s);
  const center = (s: string) => {
    const t = clip(s);
    const pad = Math.max(0, Math.floor((cols - t.length) / 2));
    return " ".repeat(pad) + t;
  };
  for (const l of job.lines) {
    if (l.kind === "text") out.push(l.align === "center" ? center(l.text) : clip(l.text));
    else if (l.kind === "cols") {
      // Never let a long name push the price past the paper edge — clip the name.
      const leftMax = Math.max(0, cols - l.right.length - 1);
      const left = l.left.length > leftMax ? l.left.slice(0, leftMax) : l.left;
      const gap = Math.max(1, cols - left.length - l.right.length);
      out.push(left + " ".repeat(gap) + l.right);
    } else if (l.kind === "rule") out.push("-".repeat(cols));
    else if (l.kind === "feed") out.push(...Array(l.lines ?? 1).fill(""));
    // "cut" produces no visible text
  }
  return out.join("\n");
}
