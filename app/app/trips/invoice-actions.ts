"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { buildBrandedInvoiceEmail } from "@/lib/email-templates/branded-invoice-email";
import { buildBrandedReceiptEmail } from "@/lib/email-templates/branded-receipt-email";

type LineItemRow = {
  name: string;
  amount: string;
  quantity: number;
};

export async function sendBrandedInvoice(
  tripId: string
): Promise<{ ok: true } | { error: string }> {
  if (!isEmailConfigured()) {
    return { error: "Email service not configured. Add RESEND_API_KEY to your environment." };
  }

  const { business: businessRaw } = await requireBusiness();
  const business = businessRaw as typeof businessRaw & {
    brand_color?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    contact_email?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_postal_code?: string | null;
  };
  const supabase = await createClient();

  // Fetch trip + line items in parallel
  const [tripResult, lineItemsResult] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id,
        pickup_address,
        dropoff_address,
        scheduled_at,
        price_total,
        pricing_type,
        hours,
        passenger_count,
        flight_number,
        terminal,
        square_invoice_url,
        customer:customers ( name, email )
      `)
      .eq("id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_line_items")
      .select("name, amount, quantity")
      .eq("trip_id", tripId)
      .order("created_at"),
  ]);

  if (tripResult.error || !tripResult.data) {
    return { error: "Could not load trip." };
  }
  const trip = tripResult.data;

  const customer = Array.isArray(trip.customer) ? trip.customer[0] : trip.customer;
  if (!customer || !customer.email) {
    return { error: "This trip has no customer with an email address." };
  }
  if (!trip.square_invoice_url) {
    return { error: "Square invoice has not been created yet for this trip." };
  }

  const lineItems = ((lineItemsResult.data ?? []) as LineItemRow[]).map(
    (item) => ({
      name: item.name,
      amount: parseFloat(item.amount),
      quantity: item.quantity,
    })
  );

  const { subject, html } = buildBrandedInvoiceEmail(
    {
      business_name: business.name,
      brand_color: business.brand_color || "#3B82F6",
      logo_url: business.logo_url ?? null,
      phone: business.phone ?? null,
      contact_email: business.contact_email ?? null,
      address_street: business.address_street ?? null,
      address_city: business.address_city ?? null,
      address_province: business.address_province ?? null,
      address_postal_code: business.address_postal_code ?? null,
    },
    {
      customer_name: customer.name,
      pickup_address: trip.pickup_address,
      dropoff_address: trip.dropoff_address,
      scheduled_at: trip.scheduled_at,
      price_total: parseFloat(trip.price_total),
      pricing_type: trip.pricing_type,
      hours: trip.hours ? parseFloat(trip.hours) : null,
      passenger_count: trip.passenger_count,
      flight_number: trip.flight_number,
      terminal: trip.terminal,
      invoice_url: trip.square_invoice_url,
      line_items: lineItems,
    }
  );

  const result = await sendEmail({
    to: customer.email,
    from: `${business.name} <onboarding@resend.dev>`,
    replyTo: business.contact_email ?? undefined,
    subject,
    html,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  await supabase
    .from("trips")
    .update({ branded_invoice_sent_at: new Date().toISOString() })
    .eq("id", tripId);

  revalidatePath(`/app/trips/${tripId}`);
  revalidatePath("/app/trips");
  return { ok: true };
}

export async function sendBrandedReceipt(
  tripId: string
): Promise<{ ok: true } | { error: string }> {
  if (!isEmailConfigured()) {
    return { error: "Email service not configured." };
  }

  const { business: businessRaw } = await requireBusiness();
  const business = businessRaw as typeof businessRaw & {
    brand_color?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    contact_email?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_postal_code?: string | null;
  };
  const supabase = await createClient();

  // Fetch trip + line items in parallel
  const [tripResult, lineItemsResult] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id,
        pickup_address,
        dropoff_address,
        scheduled_at,
        price_total,
        tip_amount,
        refund_amount,
        refund_status,
        pricing_type,
        hours,
        passenger_count,
        customer:customers ( name, email )
      `)
      .eq("id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_line_items")
      .select("name, amount, quantity")
      .eq("trip_id", tripId)
      .order("created_at"),
  ]);

  if (tripResult.error || !tripResult.data) {
    return { error: "Could not load trip." };
  }
  const trip = tripResult.data;

  const customer = Array.isArray(trip.customer) ? trip.customer[0] : trip.customer;
  if (!customer || !customer.email) {
    return { error: "This trip has no customer with an email address." };
  }

  const lineItems = ((lineItemsResult.data ?? []) as LineItemRow[]).map(
    (item) => ({
      name: item.name,
      amount: parseFloat(item.amount),
      quantity: item.quantity,
    })
  );

  const basePrice = parseFloat(trip.price_total);
  const tip = trip.tip_amount ? parseFloat(trip.tip_amount) : 0;
  const refund =
    trip.refund_status === "completed" && trip.refund_amount
      ? parseFloat(trip.refund_amount)
      : 0;
  const addOnsSubtotal = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  const totalPaid = basePrice + addOnsSubtotal + tip - refund;

  const { subject, html } = buildBrandedReceiptEmail(
    {
      business_name: business.name,
      brand_color: business.brand_color || "#3B82F6",
      logo_url: business.logo_url ?? null,
      phone: business.phone ?? null,
      contact_email: business.contact_email ?? null,
      address_street: business.address_street ?? null,
      address_city: business.address_city ?? null,
      address_province: business.address_province ?? null,
      address_postal_code: business.address_postal_code ?? null,
    },
    {
      customer_name: customer.name,
      pickup_address: trip.pickup_address,
      dropoff_address: trip.dropoff_address,
      scheduled_at: trip.scheduled_at,
      price_total: basePrice,
      tip_amount: tip,
      refund_amount: refund,
      total_paid: totalPaid,
      pricing_type: trip.pricing_type,
      hours: trip.hours ? parseFloat(trip.hours) : null,
      passenger_count: trip.passenger_count,
      line_items: lineItems,
    }
  );

  const result = await sendEmail({
    to: customer.email,
    from: `${business.name} <onboarding@resend.dev>`,
    replyTo: business.contact_email ?? undefined,
    subject,
    html,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  await supabase
    .from("trips")
    .update({ branded_receipt_sent_at: new Date().toISOString() })
    .eq("id", tripId);

  revalidatePath(`/app/trips/${tripId}`);
  revalidatePath("/app/trips");
  return { ok: true };
}