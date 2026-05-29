"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { buildBrandedInvoiceEmail } from "@/lib/email-templates/branded-invoice-email";
import { buildBrandedReceiptEmail } from "@/lib/email-templates/branded-receipt-email";

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

  const { data: trip, error: tripError } = await supabase
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
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Could not load trip." };
  }

  const customer = Array.isArray(trip.customer) ? trip.customer[0] : trip.customer;
  if (!customer || !customer.email) {
    return { error: "This trip has no customer with an email address." };
  }
  if (!trip.square_invoice_url) {
    return { error: "Square invoice has not been created yet for this trip." };
  }

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

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(`
      id,
      pickup_address,
      dropoff_address,
      scheduled_at,
      price_total,
      tip_amount,
      pricing_type,
      hours,
      passenger_count,
      customer:customers ( name, email )
    `)
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Could not load trip." };
  }

  const customer = Array.isArray(trip.customer) ? trip.customer[0] : trip.customer;
  if (!customer || !customer.email) {
    return { error: "This trip has no customer with an email address." };
  }

  const price = parseFloat(trip.price_total);
  const tip = trip.tip_amount ? parseFloat(trip.tip_amount) : 0;
  const total = price + tip;

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
      price_total: price,
      tip_amount: tip,
      total_paid: total,
      pricing_type: trip.pricing_type,
      hours: trip.hours ? parseFloat(trip.hours) : null,
      passenger_count: trip.passenger_count,
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