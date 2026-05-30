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

type LineItem = {
  name: string;
  amount: number;
  quantity: number;
};

type TripDetails = {
  customer_name: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  price_total: number;
  pricing_type: "flat" | "hourly";
  hours: number | null;
  passenger_count: number | null;
  flight_number: string | null;
  terminal: string | null;
  invoice_url: string;
  line_items: LineItem[];
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

export function buildBrandedInvoiceEmail(
  branding: Branding,
  trip: TripDetails
): { subject: string; html: string } {
  const brand = branding.brand_color || "#3B82F6";
  const businessAddress = formatAddress(branding);

  const subject = `Invoice from ${branding.business_name} — ${formatScheduled(trip.scheduled_at)}`;

  const logoBlock = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${branding.business_name}" height="48" style="display:block;margin:0 auto 12px auto;max-height:48px;" />`
    : "";

  const flightLine =
    trip.flight_number || trip.terminal
      ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;width:90px;">Flight</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;">${[trip.flight_number, trip.terminal].filter(Boolean).join(" · ")}</td>
        </tr>`
      : "";

  const passengerLine =
    trip.passenger_count != null
      ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;width:90px;">Passengers</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;">${trip.passenger_count}</td>
        </tr>`
      : "";

  const pricingLabel =
    trip.pricing_type === "hourly" && trip.hours
      ? `Trip (${trip.hours}h hourly)`
      : "Trip (flat rate)";

  // Compute totals
  const addOnsSubtotal = trip.line_items.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  const total = trip.price_total + addOnsSubtotal;

  // Render line items
  const lineItemRows = trip.line_items
    .map((item) => {
      const qtyLabel =
        item.quantity > 1
          ? `<span style="color:#9ca3af;font-size:12px;margin-left:4px;">×${item.quantity}</span>`
          : "";
      const lineTotal = (item.amount * item.quantity).toFixed(2);
      return `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151;">${item.name}${qtyLabel}</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">$${lineTotal}</td>
        </tr>`;
    })
    .join("");

  // Subtotal row only if there are line items
  const subtotalRow =
    trip.line_items.length > 0
      ? `
        <tr>
          <td style="padding:10px 0 6px 0;border-top:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Subtotal</td>
          <td style="padding:10px 0 6px 0;border-top:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">$${total.toFixed(2)}</td>
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
              <p style="margin:0 0 12px 0;font-size:16px;color:#111827;line-height:1.5;">Hi ${trip.customer_name},</p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#374151;line-height:1.6;">Here's your invoice for the upcoming trip. Tap the button below to pay securely.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;width:90px;">From</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${trip.pickup_address}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">To</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${trip.dropoff_address}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Pickup</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;">${formatScheduled(trip.scheduled_at)}</td>
                </tr>
                ${flightLine}
                ${passengerLine}
              </table>

              <!-- Itemized breakdown -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#374151;">${pricingLabel}</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">$${trip.price_total.toFixed(2)}</td>
                </tr>
                ${lineItemRows}
                ${subtotalRow}
                <tr>
                  <td style="padding:12px 0 6px 0;border-top:2px solid #111827;font-size:15px;color:#111827;font-weight:600;">Amount due</td>
                  <td style="padding:12px 0 6px 0;border-top:2px solid #111827;font-size:20px;color:${brand};font-weight:600;text-align:right;font-variant-numeric:tabular-nums;">$${total.toFixed(2)}</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${trip.invoice_url}" style="display:inline-block;padding:14px 36px;background-color:${brand};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Pay Invoice</a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;">Payment is processed securely. You can also copy this link into your browser: <br /><a href="${trip.invoice_url}" style="color:#6b7280;word-break:break-all;">${trip.invoice_url}</a></p>
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