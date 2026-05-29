type Branding = {
  business_name: string;
  brand_color: string;
  logo_url: string | null;
  phone: string | null;
  contact_email: string | null;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null;
  address_postal_code: string | null;
};

type ReceiptDetails = {
  customer_name: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  price_total: number;
  tip_amount: number;
  total_paid: number;
  pricing_type: "flat" | "hourly";
  hours: number | null;
  passenger_count: number | null;
};

function formatScheduled(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAddress(b: Branding): string {
  const parts = [
    b.address_street,
    [b.address_city, b.address_province].filter(Boolean).join(", "),
    b.address_postal_code,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildBrandedReceiptEmail(
  branding: Branding,
  receipt: ReceiptDetails
): { subject: string; html: string } {
  const brand = branding.brand_color || "#3B82F6";
  const businessAddress = formatAddress(branding);

  const subject = `Thanks for riding with ${branding.business_name}`;

  const logoBlock = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${branding.business_name}" height="48" style="display:block;margin:0 auto 12px auto;max-height:48px;" />`
    : "";

  const tipLine =
    receipt.tip_amount > 0
      ? `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151;">Tip</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">$${receipt.tip_amount.toFixed(2)}</td>
        </tr>`
      : "";

  const footerLines = [
    branding.business_name,
    branding.phone,
    branding.contact_email,
    businessAddress,
  ]
    .filter(Boolean)
    .join("<br />");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:32px 32px 16px 32px;text-align:center;">
              ${logoBlock}
              <div style="font-size:22px;color:${brand};font-weight:600;letter-spacing:-0.01em;">${branding.business_name}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;">
              <p style="margin:0 0 12px 0;font-size:16px;color:#111827;line-height:1.5;">Hi ${receipt.customer_name},</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#374151;line-height:1.6;">Thank you for riding with ${branding.business_name}. Here's your receipt for our records.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;width:90px;">From</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${receipt.pickup_address}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">To</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${receipt.dropoff_address}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Date</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${formatScheduled(receipt.scheduled_at)}</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#374151;">Trip</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">$${receipt.price_total.toFixed(2)}</td>
                </tr>
                ${tipLine}
                <tr>
                  <td style="padding:12px 0 6px 0;border-top:1px solid #e5e7eb;font-size:15px;color:#111827;font-weight:600;">Total paid</td>
                  <td style="padding:12px 0 6px 0;border-top:1px solid #e5e7eb;font-size:18px;color:${brand};font-weight:600;text-align:right;font-variant-numeric:tabular-nums;">$${receipt.total_paid.toFixed(2)}</td>
                </tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">We hope to see you again soon.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.7;text-align:center;">
              ${footerLines}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}