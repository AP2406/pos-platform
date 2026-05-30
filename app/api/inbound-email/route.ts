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

function tokenFromAddress(address: string): string | null {
  const match = address.match(/leads-([^@>\s]+)@/i);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const expectedKey = process.env.INBOUND_WEBHOOK_KEY;
  if (expectedKey) {
    const k = req.nextUrl.searchParams.get("k");
    if (k !== expectedKey) {
      return NextResponse.json({ ok: true, status: "bad_key" });
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: true, status: "no_form" });
  }

  const from = (form.get("from") as string) || "";
  const subject = (form.get("subject") as string) || "";
  const text = (form.get("text") as string) || "";
  const html = (form.get("html") as string) || "";
  const toField = (form.get("to") as string) || "";
  const envelope = (form.get("envelope") as string) || "";
  const headers = (form.get("headers") as string) || "";

  let recipient = toField;
  try {
    if (envelope) {
      const env = JSON.parse(envelope);
      if (Array.isArray(env.to)) {
        const hit = env.to.find(
          (a: string) => /inbound\./i.test(a) || /leads-/i.test(a)
        );
        if (hit) recipient = hit;
      }
    }
  } catch {
    // fall back to the To header
  }

  const token = tokenFromAddress(recipient);
  console.log("inbound-email: recipient=" + recipient + " token=" + token + " from=" + from);
  if (!token) {
    return NextResponse.json({ ok: true, status: "no_token" });
  }

  const supabase = serviceClient();

  const { data: tokenRow } = await supabase
    .from("import_tokens")
    .select("business_id")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) {
    console.log("inbound-email: UNKNOWN token " + token);
    return NextResponse.json({ ok: true, status: "unknown_token" });
  }
  const businessId = tokenRow.business_id as string;

  if (/forwarding-noreply@google\.com/i.test(from)) {
    const body = (text || "") + "\n" + (html || "");
    console.log("inbound-email verification body:", body.slice(0, 2000));
    const codeMatch = body.match(/\b(\d{9})\b/);
    const code = codeMatch ? codeMatch[1] : null;

    let confirmed = false;
    const linkMatch = body.match(
      /https:\/\/[^\s"'<>]*google\.com[^\s"'<>]*(?:Confirm|confirm|isConfirmation)[^\s"'<>]*/
    );
    if (linkMatch) {
      try {
        const resp = await fetch(linkMatch[0]);
        confirmed = resp.ok;
      } catch (e) {
        console.error("inbound-email auto-confirm failed", e);
      }
    }

    await supabase
      .from("import_tokens")
      .update({
        last_verification_code: code,
        last_verification_at: new Date().toISOString(),
      })
      .eq("token", token);

    console.log("inbound-email: Gmail verification, code=" + code + " confirmed=" + confirmed);
    return NextResponse.json({
      ok: true,
      status: "forwarding_verification",
      autoConfirmed: confirmed,
      code: code,
    });
  }

  const body = text || html;
  if (!body || !body.trim()) {
    console.log("inbound-email: empty body");
    return NextResponse.json({ ok: true, status: "empty" });
  }

  let messageId: string | null = null;
  const midMatch = headers.match(/^message-id:\s*(.+)$/im);
  if (midMatch) messageId = midMatch[1].trim();

  if (messageId) {
    const { data: dupe } = await supabase
      .from("trips")
      .select("id")
      .eq("business_id", businessId)
      .eq("source_message_id", messageId)
      .limit(1)
      .maybeSingle();
    if (dupe) {
      console.log("inbound-email: duplicate " + messageId);
      return NextResponse.json({ ok: true, status: "duplicate" });
    }
  }

  const emailText = "From: " + from + "\nSubject: " + subject + "\n\n" + body;
  let parsed: ParsedLead;
  try {
    parsed = await parseEmailWithGemini(emailText);
  } catch (err) {
    console.error("inbound-email parse error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: true, status: "parse_failed", detail });
  }

  console.log("inbound-email parsed:", JSON.stringify(parsed));
  const detected = parsed.trip_status;

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

  if (
    !parsed.pickup_address ||
    !parsed.dropoff_address ||
    !parsed.scheduled_at
  ) {
    console.log("inbound-email: INCOMPLETE — pickup=" + parsed.pickup_address + " dropoff=" + parsed.dropoff_address + " when=" + parsed.scheduled_at);
    return NextResponse.json({ ok: true, status: "incomplete" });
  }

  let customerId: string | null = null;

  if (parsed.customer_phone || parsed.customer_email) {
    const filters: string[] = [];
    if (parsed.customer_phone) filters.push("phone.eq." + parsed.customer_phone);
    if (parsed.customer_email) filters.push("email.eq." + parsed.customer_email);
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
      price_total: parsed.price_total ?? 0,
      passenger_count: parsed.passenger_count,
      luggage_count: parsed.luggage_count,
      flight_number: parsed.flight_number,
      terminal: parsed.terminal,
      handled_by: "self",
      trip_status: tripStatus,
      notes: parsed.notes,
      source_message_id: messageId,
      booking_reference: parsed.booking_reference ?? null,
      is_lead: true,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    console.error("inbound-email insert error:", tripError);
    return NextResponse.json({ ok: true, status: "insert_failed" });
  }

  console.log("inbound-email: IMPORTED trip " + trip.id);
  return NextResponse.json({
    ok: true,
    status: "imported",
    tripId: trip.id,
    detected: tripStatus,
  });
}