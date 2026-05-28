import { GoogleGenAI } from "@google/genai";

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
  trip_status: "booked" | "confirmed" | "completed" | null;
  booking_reference: string | null;
};

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
  "notes": string or null,
  "trip_status": "booked" | "confirmed" | "completed" | null,
  "booking_reference": string or null
}

Rules:
- Use null for any field NOT clearly stated in the email
- For dates: ONLY fill if you can determine BOTH the exact date AND time. If ambiguous, return null
- Business timezone: America/Toronto. Current date: {TODAY}
- Convert relative dates like "tomorrow" or "next Friday" using the current date
- For prices, extract the dollar value only (e.g., $85.50 becomes 85.50)
- For notes, capture special instructions, payment terms, customer preferences, broker reference numbers, etc.

- trip_status: classify what this email represents:
  - "booked" = a new reservation/booking request just placed, not yet confirmed
  - "confirmed" = the booking is confirmed or locked in (e.g. "your ride is confirmed", a driver/car was assigned, a confirmation number was issued)
  - "completed" = the trip already happened (e.g. a receipt, trip summary, drop-off notice, or "thank you for riding")
  - null only if you genuinely cannot tell
- booking_reference: any broker/booking/confirmation/reservation reference or ID in the email (e.g. "Booking #GL-48213", "Confirmation: ABC123", "Ref: 99281"). Extract just the identifier. null if none.

- Return ONLY the JSON object, no markdown formatting, no commentary

Email to parse:

{EMAIL}`;

export async function parseEmailWithGemini(
  emailBody: string
): Promise<ParsedLead> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const today = new Date().toISOString().split("T")[0];
  const prompt = PARSE_PROMPT.replace("{TODAY}", today).replace(
    "{EMAIL}",
    emailBody
  );

  const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: { responseMimeType: "application/json" },
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

  return JSON.parse(cleaned) as ParsedLead;
}