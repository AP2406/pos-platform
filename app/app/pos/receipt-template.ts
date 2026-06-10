// Shared, framework-agnostic receipt renderer. Used by both the live preview in
// settings and the actual print path, so what a merchant sees is what prints.

export type ReceiptStyle = "minimal" | "classic" | "bold";

export type ReceiptSettings = {
  style: ReceiptStyle;
  headerName: string;
  tagline: string;
  showAddress: boolean;
  address: string;
  showPhone: boolean;
  phone: string;
  showEmail: boolean;
  email: string;
  showWebsite: boolean;
  website: string;
  showTaxNumber: boolean;
  taxNumber: string;
  taxLabel: string;
  showSaleNumber: boolean;
  showDateTime: boolean;
  showCustomer: boolean;
  footerMessage: string;
  footerPolicy: string;
  showSocial: boolean;
  social: string;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  style: "classic",
  headerName: "",
  tagline: "",
  showAddress: true,
  address: "",
  showPhone: true,
  phone: "",
  showEmail: false,
  email: "",
  showWebsite: true,
  website: "",
  showTaxNumber: true,
  taxNumber: "",
  taxLabel: "",
  showSaleNumber: true,
  showDateTime: true,
  showCustomer: true,
  footerMessage: "Thank you!",
  footerPolicy: "",
  showSocial: false,
  social: "",
};

export function mergeReceiptSettings(partial: Partial<ReceiptSettings> | null | undefined): ReceiptSettings {
  return { ...DEFAULT_RECEIPT_SETTINGS, ...(partial || {}) };
}

export type ReceiptData = {
  saleNumber: number;
  id: string;
  businessName: string;
  customerName: string | null;
  items: { name: string; quantity: number; unit_price: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  payments: { method: string; amount: number; tendered: number | null; change: number | null }[];
  at: string;
  // Optional: dining option label and "this is an unpaid bill" pre-receipt flag.
  diningOption?: string | null;
  bill?: boolean;
};

const DINING_LABELS: Record<string, string> = {
  dine_in: "Dine in",
  takeout: "Takeout",
  delivery: "Delivery",
  pickup: "Pickup",
};

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number): string {
  return "$" + (Number(n) || 0).toFixed(2);
}

function methodLabel(m: string): string {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "split") return "Split";
  return "Other";
}

function row(left: string, right: string, opts?: { muted?: boolean; small?: boolean; bold?: boolean }): string {
  const o = opts || {};
  const styles: string[] = ["display:flex", "justify-content:space-between"];
  if (o.muted) styles.push("color:#444");
  if (o.small) styles.push("font-size:10px");
  if (o.bold) styles.push("font-weight:bold");
  return '<div style="' + styles.join(";") + '">' + "<span>" + left + "</span><span>" + right + "</span></div>";
}

function contactBlock(s: ReceiptSettings): string {
  const lines: string[] = [];
  if (s.showAddress && s.address.trim()) lines.push(esc(s.address.trim()));
  const contact: string[] = [];
  if (s.showPhone && s.phone.trim()) contact.push(esc(s.phone.trim()));
  if (s.showEmail && s.email.trim()) contact.push(esc(s.email.trim()));
  if (contact.length) lines.push(contact.join("  \u00b7  "));
  if (s.showWebsite && s.website.trim()) lines.push(esc(s.website.trim()));
  if (s.showTaxNumber && s.taxNumber.trim()) lines.push("Tax# " + esc(s.taxNumber.trim()));
  if (!lines.length) return "";
  return '<div class="ctc">' + lines.join("<br/>") + "</div>";
}

function metaBlock(r: ReceiptData, s: ReceiptSettings): string {
  const bits: string[] = [];
  if (s.showSaleNumber && !r.bill) bits.push("Sale #" + r.saleNumber);
  if (s.showDateTime) bits.push(esc(r.at));
  let html = "";
  if (r.bill) html += '<div class="meta">\u2014 BILL \u2014 not a receipt</div>';
  if (bits.length) html += '<div class="meta">' + bits.join("  \u00b7  ") + "</div>";
  if (r.diningOption && DINING_LABELS[r.diningOption]) {
    html += '<div class="meta">' + DINING_LABELS[r.diningOption] + "</div>";
  }
  if (s.showCustomer && r.customerName) html += '<div class="meta">Customer: ' + esc(r.customerName) + "</div>";
  return html;
}

function itemsBlock(r: ReceiptData): string {
  return r.items
    .map(function (l) {
      return row(esc(l.name) + " x" + l.quantity, money(l.unit_price * l.quantity));
    })
    .join("");
}

function totalsBlock(r: ReceiptData, s: ReceiptSettings, boldTotal: boolean): string {
  const taxLabel = s.taxLabel.trim() ? esc(s.taxLabel.trim()) : "Tax";
  let html = row("Subtotal", money(r.subtotal), { muted: true });
  if (r.discount > 0) html += row("Discount", "-" + money(r.discount), { muted: true });
  html += row(taxLabel, money(r.tax), { muted: true });
  if (r.tip > 0) html += row("Tip", money(r.tip), { muted: true });
  html += row("Total", money(r.total), { bold: true });
  return html;
}

function paymentBlock(r: ReceiptData): string {
  return r.payments
    .map(function (p) {
      let h = row(methodLabel(p.method), money(p.amount), { small: true });
      if (p.method === "cash" && p.change !== null && p.change > 0) {
        h += row("Cash given", money(p.tendered || 0), { small: true, muted: true });
        h += row("Change", money(p.change), { small: true, muted: true });
      }
      return h;
    })
    .join("");
}

function footerBlock(s: ReceiptSettings): string {
  const parts: string[] = [];
  if (s.footerMessage.trim()) parts.push('<div class="ft">' + esc(s.footerMessage.trim()).replace(/\n/g, "<br/>") + "</div>");
  if (s.footerPolicy.trim()) parts.push('<div class="ft small">' + esc(s.footerPolicy.trim()).replace(/\n/g, "<br/>") + "</div>");
  if (s.showSocial && s.social.trim()) parts.push('<div class="ft small">' + esc(s.social.trim()) + "</div>");
  return parts.join("");
}

function styleCss(style: ReceiptStyle, widthMm: number): string {
  const base =
    "*{box-sizing:border-box}" +
    "html,body{margin:0;padding:0;background:#fff}" +
    "body{font-family:'Courier New',monospace;font-size:11px;line-height:1.35;color:#000;width:" +
    widthMm +
    "mm;margin:0 auto;padding:6px 2mm 14mm}" +
    "table{width:100%;border-collapse:collapse}" +
    ".ctc{text-align:center;font-size:10px;color:#444;margin-bottom:6px}" +
    ".meta{text-align:center;font-size:10px;color:#444}" +
    ".ft{text-align:center;font-size:10px;color:#444;margin-top:8px}" +
    ".ft.small{font-size:9px}" +
    "@media print{@page{margin:0}html,body{width:" +
    widthMm +
    "mm}}";

  if (style === "minimal") {
    return (
      base +
      ".name{text-align:center;letter-spacing:2px;font-size:13px;margin:2px 0}" +
      ".tag{text-align:center;font-size:10px;color:#444;margin-bottom:8px}" +
      ".rule{border-top:0.5px solid #000;margin:8px 0}"
    );
  }
  if (style === "bold") {
    return (
      base +
      ".bar{background:#000;color:#fff;text-align:center;padding:9px 8px;margin:-6px -2mm 8px}" +
      ".bar .name{font-size:15px;font-weight:bold;letter-spacing:1px}" +
      ".bar .tag{font-size:10px;color:#fff;opacity:0.85}" +
      ".rule{border-top:0.5px solid #000;margin:8px 0}" +
      ".totbox{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;border:1px solid #000;border-radius:4px;padding:5px 8px;margin-top:6px}"
    );
  }
  return (
    base +
    ".name{text-align:center;font-size:14px;font-weight:bold;margin:2px 0}" +
    ".tag{text-align:center;font-size:10px;color:#444}" +
    ".rule{border-top:1px dashed #000;margin:6px 0}"
  );
}

export function buildReceiptHtml(r: ReceiptData, settingsIn: Partial<ReceiptSettings> | null | undefined, widthMm: number): string {
  const s = mergeReceiptSettings(settingsIn);
  const w = widthMm && widthMm > 0 ? widthMm : 54;
  const name = s.headerName.trim() ? s.headerName.trim() : r.businessName;
  const tag = s.tagline.trim();

  let head = "";
  if (s.style === "bold") {
    head =
      '<div class="bar"><div class="name">' +
      esc(name) +
      "</div>" +
      (tag ? '<div class="tag">' + esc(tag) + "</div>" : "") +
      "</div>" +
      contactBlock(s) +
      metaBlock(r, s);
  } else {
    head =
      '<div class="name">' +
      esc(name) +
      "</div>" +
      (tag ? '<div class="tag">' + esc(tag) + "</div>" : "") +
      contactBlock(s) +
      metaBlock(r, s);
  }

  let totals = "";
  if (s.style === "bold") {
    totals =
      row("Subtotal", money(r.subtotal), { muted: true }) +
      (r.discount > 0 ? row("Discount", "-" + money(r.discount), { muted: true }) : "") +
      row(s.taxLabel.trim() ? esc(s.taxLabel.trim()) : "Tax", money(r.tax), { muted: true }) +
      (r.tip > 0 ? row("Tip", money(r.tip), { muted: true }) : "") +
      '<div class="totbox"><span>TOTAL</span><span>' +
      money(r.total) +
      "</span></div>";
  } else {
    totals = totalsBlock(r, s, true);
  }

  const body =
    head +
    '<div class="rule"></div>' +
    itemsBlock(r) +
    '<div class="rule"></div>' +
    totals +
    '<div class="rule"></div>' +
    (r.bill ? "" : paymentBlock(r)) +
    footerBlock(s);

  return (
    "<html><head><title>Receipt</title>" +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<style>" +
    styleCss(s.style, w) +
    "</style></head><body>" +
    body +
    "</body></html>"
  );
}

export function sampleReceipt(businessName: string): ReceiptData {
  return {
    saleNumber: 1042,
    id: "a1b2c3d4",
    businessName: businessName || "Your Business",
    customerName: "Maya R.",
    items: [
      { name: "Chicken wings", quantity: 1, unit_price: 10.23 },
      { name: "Fries", quantity: 1, unit_price: 5.34 },
    ],
    subtotal: 15.57,
    discount: 0,
    tax: 2.02,
    tip: 0,
    total: 17.59,
    payments: [{ method: "cash", amount: 17.59, tendered: 20, change: 2.41 }],
    at: new Date().toLocaleString(),
  };
}