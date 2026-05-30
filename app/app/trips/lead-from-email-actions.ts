"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

const PARSE_PROMPT = `You extract structured data from limo/transportation booking emails.

Emails come from various sources:
- Broker platforms (GroundLink, Mozio, Blacklane, etc.)
- Direct customer emails
- Corporate booking systems
- Website booking form submissions

Return ONLY a JSON object with these fields (use null for missing/unclear data):

{
  "customer_name": string or null,
  "customer_email": string or null,
  "customer_phone": string or null,
  "pickup_address": string or null,
  "dropoff_address": string or null,
  "scheduled_at": ISO 8601 datetime with timezone or null,
  "price_total": number or null,
  "passenger_count": integer or null,
  "luggage_count": integer or null,
  "flight_number": string or null,
  "terminal": string or null,
  "notes": string or null
}

Rules:
- Use null for any field NOT clearly stated in the email
- For dates: ONLY fill if you can determine BOTH the exact date AND time. If ambiguous, return null
- Business timezone: America/Toronto. Current date: {TODAY}
- Convert relative dates like "tomorrow" or "next Friday" using the current date
- For prices, extract the dollar value only (e.g., $85.50 becomes 85.50)
- For notes, capture special instructions, payment terms, customer preferences, broker reference numbers, etc.
- Return ONLY the JSON object, no markdown formatting, no commentary

Email to parse:

{EMAIL}`;

export type ParsedLead = {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  scheduled_at: string | null;
  price_total: number | null;
  passenger_count: number | null;
  luggage_count: number | null;
  flight_number: string | null;
  terminal: string | null;
  notes: string | null;
};

export async function parseLeadEmail(
  emailBody: string
): Promise<{ ok: true; data: ParsedLead } | { error: string }> {
  await requireBusiness();

  if (!process.env.GEMINI_API_KEY) {
    return {
      error: "Gemini API key not configured. Add GEMINI_API_KEY to .env.local.",
    };
  }

  if (!emailBody.trim()) {
    return { error: "Please paste the email content first." };
  }

  if (emailBody.length > 20000) {
    return { error: "Email is too long. Try pasting a shorter section." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const today = new Date().toISOString().split("T")[0];
    const prompt = PARSE_PROMPT.replace("{TODAY}", today).replace(
      "{EMAIL}",
      emailBody
    );

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText =
      response.text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";

    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    const data = JSON.parse(cleaned) as ParsedLead;
    return { ok: true, data };
  } catch (error) {
    console.error("parseLeadEmail error:", error);
    if (error instanceof SyntaxError) {
      return { error: "AI returned invalid JSON. Please try again or fill manually." };
    }
    return { error: "Failed to parse email. Please try again or fill manually." };
  }
}

export async function createTripFromLead(input: {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  price_total: number;
  passenger_count: number | null;
  luggage_count: number | null;
  flight_number: string | null;
  terminal: string | null;
  notes: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  let customerId: string | null = null;

  // Try to match existing customer by phone or email
  if (input.customer_phone || input.customer_email) {
    const filters: string[] = [];
    if (input.customer_phone) filters.push("phone.eq." + input.customer_phone);
    if (input.customer_email) filters.push("email.eq." + input.customer_email);

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .or(filters.join(","))
      .limit(1)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    }
  }

  // Create new customer if not matched and name provided
  if (!customerId && input.customer_name) {
    const { data: newCustomer } = await supabase
      .from("customers")
      .insert({
        business_id: business.id,
        name: input.customer_name,
        email: input.customer_email,
        phone: input.customer_phone,
      })
      .select("id")
      .single();

    if (newCustomer) {
      customerId = newCustomer.id;
    }
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      business_id: business.id,
      customer_id: customerId,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      scheduled_at: input.scheduled_at,
      pricing_type: "flat",
      price_total: input.price_total,
      passenger_count: input.passenger_count,
      luggage_count: input.luggage_count,
      flight_number: input.flight_number,
      terminal: input.terminal,
      handled_by: "self",
      notes: input.notes,
      is_lead: true,
    })
    .select()
    .single();

  if (tripError || !trip) {
    console.error("createTripFromLead trip insert:", tripError);
    return { error: "Could not create trip from lead." };
  }

  revalidatePath("/app/trips");
  revalidatePath("/app");
  revalidatePath("/app/trips/" + trip.id);
  return { ok: true, id: trip.id };
}

export async function updateTripFromConversation(
  tripId: string,
  conversation: string
): Promise<{ ok: true; updated: string[] } | { error: string }> {
  const { business } = await requireBusiness();

  const parsedResult = await parseLeadEmail(conversation);
  if (!("ok" in parsedResult)) {
    return { error: parsedResult.error };
  }
  const parsed = parsedResult.data;

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, notes")
    .eq("id", tripId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!trip) {
    return { error: "Could not find that trip." };
  }

  const updates: Record<string, unknown> = {};
  const updated: string[] = [];

  if (parsed.pickup_address) {
    updates.pickup_address = parsed.pickup_address;
    updated.push("pickup address");
  }
  if (parsed.dropoff_address) {
    updates.dropoff_address = parsed.dropoff_address;
    updated.push("dropoff address");
  }
  if (parsed.scheduled_at) {
    updates.scheduled_at = parsed.scheduled_at;
    updated.push("pickup time");
  }
  if (parsed.price_total != null) {
    updates.price_total = parsed.price_total;
    updated.push("price");
  }
  if (parsed.passenger_count != null) {
    updates.passenger_count = parsed.passenger_count;
    updated.push("passengers");
  }
  if (parsed.luggage_count != null) {
    updates.luggage_count = parsed.luggage_count;
    updated.push("luggage");
  }
  if (parsed.flight_number) {
    updates.flight_number = parsed.flight_number;
    updated.push("flight number");
  }
  if (parsed.terminal) {
    updates.terminal = parsed.terminal;
    updated.push("terminal");
  }
  if (parsed.notes) {
    const existing = trip.notes ? trip.notes + "\n\n" : "";
    updates.notes = existing + parsed.notes;
    updated.push("notes");
  }

  if (updated.length === 0) {
    return { error: "Couldn't pull any new details from that conversation." };
  }

  const { error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", tripId);

  if (error) {
    console.error("updateTripFromConversation:", error);
    return { error: "Could not update the trip. Please try again." };
  }

  revalidatePath("/app/trips/" + tripId);
  revalidatePath("/app/trips");
  return { ok: true, updated: updated };
}