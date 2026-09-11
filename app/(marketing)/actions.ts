"use server";

import { z } from "zod";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";

const LEADS_TO = process.env.SURGE_LEADS_EMAIL || "info@surgetechpos.com";
const LEADS_FROM = process.env.SURGE_LEADS_FROM || "Surge <noreply@surgetechpos.com>";
const SUPPORT_EMAIL = process.env.SURGE_SUPPORT_EMAIL || "info@surgetechpos.com";
const SITE_URL = process.env.SURGE_SITE_URL || "https://app.surgetechpos.com";

// ----- Profit estimate assumptions (tune as you learn your real Finix costs) -----
const PER_MERCHANT_MONTHLY = 2.50;
const PAYOUT_MONTHLY = 12;
const FINIX_FIXED = 0.15;
const ADVANCED_MONTHLY = 29;

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

function confirmationHtml(name: string, kind: string): string {
  const safeName = esc(name) || "there";
  const isCall = kind === "call";
  const heading = isCall ? "Your free call is booked" : "We got your message";
  const intro = isCall
    ? "Thanks for reaching out, " + safeName + ". We have your details and will contact you shortly to lock in a time that works &mdash; no pressure, no jargon."
    : "Thanks for reaching out, " + safeName + ". We have your message and a real person will get back to you shortly, usually the same day.";

  let steps = "";
  if (isCall) {
    const items = ["We review your business details to prep your numbers.", "We reach out to set a time that suits you.", "On the call, we show you exactly what you could save."];
    let rows = "";
    for (let i = 0; i < items.length; i++) {
      rows = rows +
        "<tr>" +
          // The numbered step chip, re-derived on the kit blue: a 12% tint of
          // #008CFF over white (#E0F1FF) with the numeral one rung darker than
          // the button fill. 5.96:1 — the pairing it replaces (#2563eb on
          // #e0edff) was 4.36:1, i.e. this chip was already under AA before the
          // hue moved, and a 13px numeral is not large text.
          "<td valign='top' style='padding:6px 12px 6px 0;'><div style='width:26px;height:26px;line-height:26px;text-align:center;border-radius:9999px;background-color:#E0F1FF;color:#0057B8;font-weight:700;font-size:13px;'>" + (i + 1) + "</div></td>" +
          "<td valign='top' style='padding:6px 0;color:#475569;font-size:14px;line-height:1.5;'>" + items[i] + "</td>" +
        "</tr>";
    }
    steps =
      "<div style='margin-top:22px;'>" +
        "<div style='font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:8px;'>What happens next</div>" +
        "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%'>" + rows + "</table>" +
      "</div>";
  }

  return "" +
    "<div style='margin:0;padding:0;background-color:#f1f5f9;'>" +
      "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color:#f1f5f9;padding:24px 0;'>" +
        "<tr><td align='center'>" +
          "<table role='presentation' cellpadding='0' cellspacing='0' border='0' width='560' style='width:560px;max-width:560px;'>" +
            // THE HEADER IS NOW INK, NOT BLUE, and carries the real lockup.
            // Two reasons. (1) The kit's dark artwork is white lettering with
            // blue bars; putting it on a blue bar would sit brand blue on
            // brand blue and lose the bars entirely. Ink #101318 is the
            // background the kit publishes that variant for. (2) The old
            // header paired a square icon with the word "Surge" typeset in
            // whatever sans the mail client happened to have — a lockup the
            // brand never drew. The kit has a real one; an email header is
            // wide enough to use it.
            // It has to be a hosted PNG: every mail client of consequence
            // blocks SVG, and Gmail strips <svg> outright. 440px source shown
            // at 220 (the kit's floor for the horizontal) = 2x for retina.
            "<tr><td style='background-color:#101318;border-radius:18px 18px 0 0;padding:26px 32px;text-align:center;'>" +
              "<img src='" + SITE_URL + "/brand/surge-lockup-email.png' width='220' height='65' alt='Surge' style='display:inline-block;border:0;outline:none;text-decoration:none;' />" +
            "</td></tr>" +
            "<tr><td style='background-color:#ffffff;padding:34px 32px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'>" +
              "<div style='width:54px;height:54px;line-height:54px;text-align:center;border-radius:9999px;background-color:#d1fae5;color:#059669;font-size:26px;margin:0 auto 18px;'>&#10003;</div>" +
              "<h1 style='margin:0 0 10px;text-align:center;color:#0f172a;font-size:24px;font-weight:700;'>" + heading + "</h1>" +
              "<p style='margin:0;text-align:center;color:#475569;font-size:15px;line-height:1.6;'>" + intro + "</p>" +
              steps +
              // Solid #006BDD, not the old blue-to-cyan gradient. That is the
              // same value as the web's light-theme --primary — the AA-safe
              // fill derived from the kit blue — and white on it measures
              // 5.06:1. A gradient could not be measured at all: half the mail
              // clients that matter drop background-image and fall back to
              // background-color, so the tested colour has to BE the fill.
              "<div style='text-align:center;margin-top:26px;'><a href='" + SITE_URL + "' style='display:inline-block;background-color:#006BDD;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:9999px;'>Visit Surge</a></div>" +
              "<p style='margin:22px 0 0;text-align:center;color:#94a3b8;font-size:13px;line-height:1.5;'>Questions in the meantime? Just reply to this email.</p>" +
            "</td></tr>" +
            // Footer takes the kit ink too, so the card's two dark bands are
            // the same colour rather than #101318 above and #0e1a2b below.
            "<tr><td style='background-color:#101318;border-radius:0 0 18px 18px;padding:22px 32px;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'>" +
              "<div style='color:#ffffff;font-size:14px;font-weight:700;'>Surge</div>" +
              "<div style='color:#94a3b8;font-size:12px;margin-top:6px;line-height:1.6;'>Smarter payments for local business<br/>Serving the GTA &amp; Durham Region<br/>" + esc(SUPPORT_EMAIL) + "</div>" +
              "<div style='color:#64748b;font-size:11px;margin-top:10px;'>&copy; 2026 Surge</div>" +
            "</td></tr>" +
          "</table>" +
        "</td></tr>" +
      "</table>" +
    "</div>";
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
  } catch (err) {
    return { ok: false, error: "Something went wrong sending your message. Please try again or email us." };
  }
  try {
    await sendEmail({ to: d.email, from: LEADS_FROM, replyTo: SUPPORT_EMAIL, subject: "Thanks for reaching out \u2014 Surge", html: confirmationHtml(d.name, "message") });
  } catch (err2) {
    // confirmation is best-effort; the lead already went through
  }
  return { ok: true };
}
const bookingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  business: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  businessType: z.string().trim().max(60).optional().or(z.literal("")),
  volume: z.string().trim().max(60).optional().or(z.literal("")),
  volumeExact: z.string().trim().max(20).optional().or(z.literal("")),
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

  const exactNum = d.volumeExact ? Number(d.volumeExact.replace(/[^0-9]/g, "")) : 0;
  const volume = exactNum > 0 ? exactNum : (VOLUME_MID[d.volume || ""] || 0);
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
      "<p><strong>Est. monthly volume:</strong> " + money(volume) + (exactNum > 0 ? " (exact)" : " (range midpoint)") + "</p>" +
      "<p><strong>Est. transactions / mo:</strong> " + txns.toLocaleString("en-CA") + "</p>" +
      "<p><strong>Est. processing revenue:</strong> " + money(revenue) + " / mo</p>" +
      "<p><strong>Est. cost (interchange + Finix):</strong> " + money(cost) + " / mo</p>" +
      "<p><strong>Est. gross margin:</strong> " + money(grossMargin) + " / mo</p>" +
      "<p><strong>Less per-merchant + payout fees:</strong> -" + money(PER_MERCHANT_MONTHLY + PAYOUT_MONTHLY) + " / mo</p>" +
      "<p><strong>Est. net profit:</strong> ~" + money(netMonthly) + " / mo (~" + money(netAnnual) + " / yr)</p>" +
      "<p><strong>If they take Advanced:</strong> + $" + ADVANCED_MONTHLY + " / mo near-pure margin</p>" +
      "<p><strong>Risk:</strong> " + risk + (flags.length ? " &mdash; " + esc(flags.join("; ")) : "") + "</p>" +
      "<p style='color:#888;font-size:12px'>Rough estimate. Tune the constants at the top of actions.ts as you learn your real Finix numbers.</p>";
  } else {
    estimateHtml = "<hr><p><em>New / no-history business &mdash; no processing numbers yet, so no profit estimate. Assess growth potential on the call.</em></p>";
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
  } catch (err) {
    return { ok: false, error: "Something went wrong. Please try again or email us." };
  }
  try {
    await sendEmail({ to: d.email, from: LEADS_FROM, replyTo: SUPPORT_EMAIL, subject: "We got your request \u2014 Surge", html: confirmationHtml(d.name, "call") });
  } catch (err2) {
    // confirmation is best-effort; the lead already went through
  }
  return { ok: true };
}