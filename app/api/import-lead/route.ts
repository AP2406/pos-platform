import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseEmailWithGemini, type ParsedLead } from "@/lib/services/leads";

const STATUS_RANK: Record<string, number> = {
  booked: 0,
  confirmed: 1,
  completed: 2,
};

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-import-token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = serviceClient();

  const { data: tokenRow } = await supabase
    .from("import_tokens")
    .select("business_id")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const businessId = tokenRow.business_id as string;

  let payload: {
    messageId?: string;
    from?: string;
    subject?: string;
    body?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messageId, from, subject, body } = payload;
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Missing email body" }, { status: 400 });
  }

  // Skip if we already processed this exact email
  if (messageId) {
    const { data: dupe } = await supabase
      .from("trips")
      .select("id")
      .eq("business_id", businessId)
      .eq("source_message_id", messageId)
      .limit(1)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json({ ok: true, status: "duplicate" });
    }
  }

  // Parse with Gemini
  const emailText = `From: ${from ?? ""}\nSubject: ${subject ?? ""}\n\n${body}`;
  let parsed: ParsedLead;
  try {
    parsed = await parseEmailWithGemini(emailText);
  } catch (err) {
    console.error("import-lead parse error:", err);
    return NextResponse.json({ ok: true, status: "parse_failed" });
  }

  const detected = parsed.trip_status; // booked | confirmed | completed | null

  // FOLLOW-UP PATH: same reference as an existing trip → update status, don't duplicate
  if (parsed.booking_reference) {
    const { data: existingTrip } = await supabase
      .from("trips")
      .select("id, trip_status")
      .eq("business_id", businessId)
      .eq("booking_reference", parsed.booking_reference)
      .limit(1)
      .maybeSingle();

    if (existingTrip) {
      if (detected) {
        const cur = STATUS_RANK[existingTrip.trip_status] ?? 0;
        const next = STATUS_RANK[detected] ?? 0;
        if (next > cur) {
          await supabase
            .from("trips")
            .update({ trip_status: detected })
            .eq("id", existingTrip.id);
          return NextResponse.json({
            ok: true,
            status: "updated",
            tripId: existingTrip.id,
            to: detected,
          });
        }
      }
      return NextResponse.json({
        ok: true,
        status: "no_change",
        tripId: existingTrip.id,
      });
    }
  }

  // NEW TRIP PATH: needs the essentials
  if (
    !parsed.pickup_address ||
    !parsed.dropoff_address ||
    !parsed.scheduled_at ||
    parsed.price_total == null
  ) {
    return NextResponse.json({ ok: true, status: "incomplete" });
  }

  let customerId: string | null = null;
  if (parsed.customer_phone || parsed.customer_email) {
    const filters: string[] = [];
    if (parsed.customer_phone) filters.push(`phone.eq.${parsed.customer_phone}`);
    if (parsed.customer_email) filters.push(`email.eq.${parsed.customer_email}`);
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .or(filters.join(","))
      .limit(1)
      .maybeSingle();
    if (existing) customerId = existing.id;
  }
  if (!customerId && parsed.customer_name) {
    const { data: newCustomer } = await supabase
      .from("customers")
      .insert({
        business_id: businessId,
        name: parsed.customer_name,
        email: parsed.customer_email,
        phone: parsed.customer_phone,
      })
      .select("id")
      .single();
    if (newCustomer) customerId = newCustomer.id;
  }

  const tripStatus =
    detected ??
    (new Date(parsed.scheduled_at) < new Date() ? "completed" : "booked");

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      pickup_address: parsed.pickup_address,
      dropoff_address: parsed.dropoff_address,
      scheduled_at: parsed.scheduled_at,
      pricing_type: "flat",
      price_total: parsed.price_total,
      passenger_count: parsed.passenger_count,
      luggage_count: parsed.luggage_count,
      flight_number: parsed.flight_number,
      terminal: parsed.terminal,
      handled_by: "self",
      trip_status: tripStatus,
      notes: parsed.notes,
      source_message_id: messageId ?? null,
      booking_reference: parsed.booking_reference ?? null,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    console.error("import-lead insert error:", tripError);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "imported",
    tripId: trip.id,
    detected: tripStatus,
  });
}