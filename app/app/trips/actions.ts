"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDraftSquareInvoice } from "@/lib/services/square";
import { refundTransfer } from "@/lib/services/finix";

const tripSchema = z
  .object({
    customer_id: z.string().uuid().optional().nullable(),
    vehicle_id: z.string().uuid().optional().nullable(),
    pickup_address: z.string().min(1, "Pickup address is required").max(500),
    dropoff_address: z.string().min(1, "Dropoff address is required").max(500),
    scheduled_at: z.string().min(1, "Pickup time required"),
    pricing_type: z.enum(["flat", "hourly"]),
    price_total: z.coerce.number().min(0).max(1000000),
    hours: z.coerce.number().min(0).max(100).optional().nullable(),
    passenger_count: z.coerce.number().int().min(0).max(100).optional().nullable(),
    luggage_count: z.coerce.number().int().min(0).max(50).optional().nullable(),
    flight_number: z.string().max(50).optional().or(z.literal("")),
    terminal: z.string().max(50).optional().or(z.literal("")),
    handled_by: z.enum(["self", "partner"]),
    partner_id: z.string().uuid().optional().nullable(),
    cookie_amount: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      (data.handled_by === "self" && !data.partner_id) ||
      (data.handled_by === "partner" && !!data.partner_id),
    { message: "If farmed out, you must select a partner." }
  );

type TripInput = {
  customer_id?: string | null;
  vehicle_id?: string | null;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  pricing_type: "flat" | "hourly";
  price_total: number;
  hours?: number | null;
  passenger_count?: number | null;
  luggage_count?: number | null;
  flight_number?: string;
  terminal?: string;
  handled_by: "self" | "partner";
  partner_id?: string | null;
  cookie_amount?: number | null;
  notes?: string;
};

type TripStatus =
  | "new_lead"
  | "confirmed"
  | "decision_making"
  | "completed"
  | "lost";

export async function createTrip(
  input: TripInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const isPartner = parsed.data.handled_by === "partner";

  const { data, error } = await supabase
    .from("trips")
    .insert({
      business_id: business.id,
      customer_id: parsed.data.customer_id || null,
      vehicle_id: isPartner ? null : parsed.data.vehicle_id || null,
      pickup_address: parsed.data.pickup_address,
      dropoff_address: parsed.data.dropoff_address,
      scheduled_at: parsed.data.scheduled_at,
      pricing_type: parsed.data.pricing_type,
      price_total: parsed.data.price_total,
      hours: parsed.data.pricing_type === "hourly" ? parsed.data.hours ?? null : null,
      passenger_count: parsed.data.passenger_count ?? null,
      luggage_count: parsed.data.luggage_count ?? null,
      flight_number: parsed.data.flight_number || null,
      terminal: parsed.data.terminal || null,
      handled_by: parsed.data.handled_by,
      partner_id: isPartner ? parsed.data.partner_id : null,
      cookie_amount: isPartner ? parsed.data.cookie_amount ?? null : null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createTrip:", error);
    return { error: "Could not create trip. Please try again." };
  }

  revalidatePath("/app/trips");
  revalidatePath("/app");
  revalidatePath("/app/trips/" + data.id);
  return { ok: true, id: data.id };
}

export async function updateTrip(
  id: string,
  input: TripInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await requireBusiness();
  const supabase = await createClient();
  const isPartner = parsed.data.handled_by === "partner";

  const { error } = await supabase
    .from("trips")
    .update({
      customer_id: parsed.data.customer_id || null,
      vehicle_id: isPartner ? null : parsed.data.vehicle_id || null,
      pickup_address: parsed.data.pickup_address,
      dropoff_address: parsed.data.dropoff_address,
      scheduled_at: parsed.data.scheduled_at,
      pricing_type: parsed.data.pricing_type,
      price_total: parsed.data.price_total,
      hours: parsed.data.pricing_type === "hourly" ? parsed.data.hours ?? null : null,
      passenger_count: parsed.data.passenger_count ?? null,
      luggage_count: parsed.data.luggage_count ?? null,
      flight_number: parsed.data.flight_number || null,
      terminal: parsed.data.terminal || null,
      handled_by: parsed.data.handled_by,
      partner_id: isPartner ? parsed.data.partner_id : null,
      cookie_amount: isPartner ? parsed.data.cookie_amount ?? null : null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateTrip:", error);
    return { error: "Could not update trip. Please try again." };
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + id);
  revalidatePath("/app");
  return { ok: true };
}

export async function updateTripStatus(
  id: string,
  status: TripStatus
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
.update({ trip_status: status, is_lead: status === "new_lead" })    .eq("id", id);

  if (error) {
    console.error("updateTripStatus:", error);
    return { error: "Could not update status." };
  }
  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + id);
  return { ok: true };
}

export async function togglePaymentCollected(
  id: string,
  collected: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ payment_collected: collected })
    .eq("id", id);

  if (error) {
    console.error("togglePaymentCollected:", error);
    return { error: "Could not update payment status." };
  }
  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + id);
  return { ok: true };
}

export async function toggleCookieCollected(
  id: string,
  collected: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ cookie_collected: collected })
    .eq("id", id);

  if (error) {
    console.error("toggleCookieCollected:", error);
    return { error: "Could not update cookie status." };
  }
  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + id);
  return { ok: true };
}

export async function deleteTrip(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase.from("trips").delete().eq("id", id);

  if (error) {
    console.error("deleteTrip:", error);
    return { error: "Could not delete trip." };
  }
  revalidatePath("/app/trips");
  return { ok: true };
}

export async function refundTrip(input: {
  id: string;
  amount: number;
  reason: string;
}): Promise<{ ok: true } | { error: string }> {
  const { role } = await requireBusiness();

  if (role !== "owner" && role !== "manager") {
    return { error: "Only owners or managers can issue refunds." };
  }
  if (!input.amount || input.amount <= 0) {
    return { error: "Refund amount must be greater than zero." };
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { error: "Please provide a refund reason (3+ characters)." };
  }

  const supabase = await createClient();

  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select("price_total, refund_status, processor_payment_id")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError || !trip) {
    return { error: "Could not find that trip." };
  }
  if (trip.refund_status === "completed") {
    return { error: "This trip has already been refunded." };
  }
  if (input.amount > parseFloat(trip.price_total)) {
    return { error: "Refund amount cannot exceed the trip price." };
  }

  let refundProcessor: "manual" | "finix" = "manual";
  let processorRef: string | null = null;

  if (trip.processor_payment_id) {
    const { data: finixPayment } = await supabase
      .from("finix_payments")
      .select("finix_transfer_id, status")
      .eq("id", trip.processor_payment_id)
      .maybeSingle();

    if (
      finixPayment?.finix_transfer_id &&
      (finixPayment.status === "succeeded" || finixPayment.status === "pending")
    ) {
      const refundAmountCents = Math.round(input.amount * 100);
      const idempotencyKey = "surge-refund-" + input.id + "-" + Date.now();

      const refundResult = await refundTransfer(finixPayment.finix_transfer_id, {
        refundAmount: refundAmountCents,
        idempotency_id: idempotencyKey,
        tags: {
          source: "surge",
          trip_id: input.id,
          reason: input.reason.trim().slice(0, 100),
        },
      });

      if ("error" in refundResult) {
        console.error("Finix refund failed:", refundResult);
        return {
          error:
            "Finix refund failed: " +
            refundResult.error +
            ". The trip refund was NOT recorded — please try again or refund manually in the Finix dashboard.",
        };
      }

      refundProcessor = "finix";
      processorRef = refundResult.data.id;
    }
  }

  const { error } = await supabase
    .from("trips")
    .update({
      refund_amount: input.amount,
      refund_reason: input.reason.trim(),
      refund_status: "completed",
      refunded_at: new Date().toISOString(),
      refund_processor: refundProcessor,
      refund_processor_ref: processorRef,
    })
    .eq("id", input.id);

  if (error) {
    console.error("refundTrip:", error);
    return { error: "Could not record the refund. Please try again." };
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + input.id);
  return { ok: true };
}

export async function updateTripTip(input: {
  id: string;
  amount: number;
}): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();

  if (input.amount < 0) {
    return { error: "Tip cannot be negative." };
  }
  if (input.amount > 100000) {
    return { error: "Tip amount looks too large. Double-check the value." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ tip_amount: input.amount })
    .eq("id", input.id);

  if (error) {
    console.error("updateTripTip:", error);
    return { error: "Could not update tip." };
  }

  revalidatePath("/app/trips");
  revalidatePath("/app/trips/" + input.id);
  return { ok: true };
}

export async function createSquareInvoiceForTrip(
  tripId: string
): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, customer_id, pickup_address, dropoff_address, scheduled_at, price_total, square_invoice_id"
    )
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { error: "Could not find that trip." };
  }
  if (trip.square_invoice_id) {
    return { error: "An invoice has already been created for this trip." };
  }
  if (!trip.customer_id) {
    return { error: "Add a customer to this trip before creating an invoice." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone, square_customer_id")
    .eq("id", trip.customer_id)
    .maybeSingle();

  if (!customer) {
    return { error: "Could not find the customer for this trip." };
  }

  const result = await createDraftSquareInvoice({
    businessId: business.id,
    customer: {
      square_customer_id: customer.square_customer_id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    trip: {
      pickup_address: trip.pickup_address,
      dropoff_address: trip.dropoff_address,
      scheduled_at: trip.scheduled_at,
      price_total: Number(trip.price_total),
    },
    currency: business.currency ?? "CAD",
  });

  if (!("ok" in result)) {
    await supabase
      .from("trips")
      .update({ square_error: result.error })
      .eq("id", trip.id);
    return { error: result.error };
  }

  if (!customer.square_customer_id) {
    await supabase
      .from("customers")
      .update({ square_customer_id: result.data.squareCustomerId })
      .eq("id", customer.id);
  }
  await supabase
    .from("trips")
    .update({
      square_invoice_id: result.data.invoiceId,
      square_invoice_status: result.data.invoiceStatus,
      square_invoice_url: result.data.invoiceUrl,
      square_order_id: result.data.orderId,
      square_error: null,
    })
    .eq("id", trip.id);

  revalidatePath("/app/trips/" + tripId);
  revalidatePath("/app/trips");
  return { ok: true };
}