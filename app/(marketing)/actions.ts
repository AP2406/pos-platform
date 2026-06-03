"use server";

import { z } from "zod";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";

const LEADS_TO = process.env.SURGE_LEADS_EMAIL || "aathis2006@gmail.com";
const LEADS_FROM = process.env.SURGE_LEADS_FROM || "Surge <noreply@surgetechpos.com>";

// ----- Profit estimate assumptions (tune as you learn your real Finix costs) -----
const PER_MERCHANT_MONTHLY = 2.50; // Finix active sub-merchant fee
const PAYOUT_MONTHLY = 12;          // estimated payout fees per month (batched)
const FINIX_FIXED = 0.15;           // Finix per-transaction fee
const ADVANCED_MONTHLY = 29;        // recurring if they take Advanced

const VOLUME_MID: Record<string, number> = { "Under $5k": 3000, "$5k - $20k": 12500, "$20k - $50k": 35000, "$50k - $100k": 75000, "$100k+": 150000 };
const TICKET_MID: Record<string, number> = { "Under $15": 10, "$15 - $50": 32, "$50 - $150": 100, "$150+": 250 };

function rateFor(mix: string): { surgePct: number; surgeFixed: number; costPct: number } {
  if (mix === "Mostly online or phone") return { surgePct: 0.029, surgeFixed: 0.30, costPct: 0.021 };
  if (mix === "A mix of both") return { surgePct: 0.027, surgeFixed: 0.22, costPct: 0.018 };
  return { surgePct: 0.025, surgeFixed: 0.15, costPct: 0.0165 };
}

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

export type ContactInput = z.infer<typeof contactSchema>;

export async function submitContact(input: ContactInput): Promise<{ ok: boolean; error?: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: "Messaging is not set up yet. Please email or call us directly." };
  }
  const d = parsed.data;
  const html =
    "<h2>New contact message</h2>" +
    "<p><strong>Name:</strong> " + esc(d.name) + "</p>" +
    "<p><strong>Email:</strong> " + esc(d.email) + "</p>" +
    "<p><strong>Phone:</strong> " + esc(d.phone || "Not provided") + "</p>" +
    "<hr>" +
    "<p><strong>Message:</strong></p>" +
    "<p>" + nl2br(d.message) + "</p>";
  try {
    await sendEmail({ to: LEADS_TO, from: LEADS_FROM, replyTo: d.email, subject: "Surge contact: " + d.name, html: html });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Something went wrong sending your message. Please try again or email us." };
  }
}

const bookingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  business: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  businessType: z.string().trim().max(60).optional().or(z.literal("")),
  volume: z.string().trim().max(60).optional().or(z.literal("")),
  avgTicket: z.string().trim().max(60).optional().or(z.literal("")),
  paymentMix: z.string().trim().max(60).optional().or(z.literal("")),
  interest: z.string().trim().max(60).optional().or(z.literal("")),
  preferred: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export async function submitBooking(input: BookingInput): Promise<{ ok: boolean; error?: string }> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: "Booking is not set up yet. Please email or call us directly." };
  }
  const d = parsed.data;

  // ----- Internal profit + risk estimate (only you see this) -----
  const volume = VOLUME_MID[d.volume || ""] || 0;
  const ticket = TICKET_MID[d.avgTicket || ""] || 0;
  const txns = ticket > 0 ? Math.round(volume / ticket) : 0;
  const r = rateFor(d.paymentMix || "");
  const revenue = volume * r.surgePct + txns * r.surgeFixed;
  const cost = volume * r.costPct + txns * FINIX_FIXED;
  const grossMargin = revenue - cost;
  const netMonthly = grossMargin - PER_MERCHANT_MONTHLY - PAYOUT_MONTHLY;
  const netAnnual = netMonthly * 12;

  let risk = "Low";
  const flags: string[] = [];
  if (d.paymentMix === "Mostly online or phone") { risk = "Higher"; flags.push("card-not-present heavy (chargeback risk)"); }
  else if (d.paymentMix === "A mix of both") { risk = "Medium"; flags.push("some card-not-present volume"); }
  if (d.avgTicket === "$150+") { flags.push("large average ticket (bigger dispute exposure)"); if (risk === "Low") risk = "Medium"; }
  if (d.businessType === "Transportation") { flags.push("transportation (verify chargeback profile)"); }

  let estimateHtml = "";
  if (volume > 0) {
    estimateHtml =
      "<hr>" +
      "<h3>Estimated value (internal &mdash; rough)</h3>" +
      "<p><strong>Est. monthly volume:</strong> " + money(volume) + "</p>" +
      "<p><strong>Est. transactions / mo:</strong> " + txns.toLocaleString("en-CA") + "</p>" +
      "<p><strong>Est. processing revenue:</strong> " + money(revenue) + " / mo</p>" +
      "<p><strong>Est. cost (interchange + Finix):</strong> " + money(cost) + " / mo</p>" +
      "<p><strong>Est. gross margin:</strong> " + money(grossMargin) + " / mo</p>" +
      "<p><strong>Less per-merchant + payout fees:</strong> -" + money(PER_MERCHANT_MONTHLY + PAYOUT_MONTHLY) + " / mo</p>" +
      "<p><strong>Est. net profit:</strong> ~" + money(netMonthly) + " / mo (~" + money(netAnnual) + " / yr)</p>" +
      "<p><strong>If they take Advanced:</strong> + $" + ADVANCED_MONTHLY + " / mo near-pure margin</p>" +
      "<p><strong>Risk:</strong> " + risk + (flags.length ? " &mdash; " + esc(flags.join("; ")) : "") + "</p>" +
      "<p style='color:#888;font-size:12px'>Rough estimate from range midpoints and assumed costs. Tune the constants at the top of actions.ts as you learn your real Finix numbers.</p>";
  }

  const html =
    "<h2>New call request</h2>" +
    "<p><strong>Name:</strong> " + esc(d.name) + "</p>" +
    "<p><strong>Business:</strong> " + esc(d.business || "Not provided") + "</p>" +
    "<p><strong>Email:</strong> " + esc(d.email) + "</p>" +
    "<p><strong>Phone:</strong> " + esc(d.phone || "Not provided") + "</p>" +
    "<hr>" +
    "<h3>Lead qualifying</h3>" +
    "<p><strong>Business type:</strong> " + esc(d.businessType || "-") + "</p>" +
    "<p><strong>Monthly card sales:</strong> " + esc(d.volume || "-") + "</p>" +
    "<p><strong>Average sale:</strong> " + esc(d.avgTicket || "-") + "</p>" +
    "<p><strong>Payment mix:</strong> " + esc(d.paymentMix || "-") + "</p>" +
    "<p><strong>Interested in:</strong> " + esc(d.interest || "-") + "</p>" +
    "<p><strong>Preferred time:</strong> " + esc(d.preferred || "Any") + "</p>" +
    estimateHtml +
    "<hr>" +
    "<p><strong>Notes:</strong></p>" +
    "<p>" + nl2br(d.message || "None") + "</p>";

  const subject = "Surge call request: " + d.name + (d.volume ? " (" + d.volume + "/mo" + (volume > 0 ? ", ~" + money(netMonthly) + "/mo profit" : "") + ")" : "");

  try {
    await sendEmail({ to: LEADS_TO, from: LEADS_FROM, replyTo: d.email, subject: subject, html: html });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Something went wrong. Please try again or email us." };
  }
}