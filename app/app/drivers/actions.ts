"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const driverSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  license_number: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type DriverInput = {
  name: string;
  phone?: string;
  email?: string;
  license_number?: string;
  status?: "active" | "inactive";
  notes?: string;
};

export async function createDriver(
  input: DriverInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drivers")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      license_number: parsed.data.license_number || null,
      status: parsed.data.status || "active",
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("createDriver:", error);
    return { error: "Could not create driver." };
  }
  revalidatePath("/app/drivers");
  return { ok: true, id: data.id };
}

export async function updateDriver(
  id: string,
  input: DriverInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      license_number: parsed.data.license_number || null,
      status: parsed.data.status || "active",
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (error) {
    console.error("updateDriver:", error);
    return { error: "Could not update driver." };
  }
  revalidatePath("/app/drivers");
  revalidatePath("/app/drivers/" + id);
  return { ok: true };
}

export async function deleteDriver(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) {
    console.error("deleteDriver:", error);
    return { error: "Could not delete driver." };
  }
  revalidatePath("/app/drivers");
  return { ok: true };
}

export async function assignDriverToTrip(
  tripId: string,
  driverId: string | null
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ driver_id: driverId })
    .eq("id", tripId);
  if (error) {
    console.error("assignDriverToTrip:", error);
    return { error: "Could not assign driver." };
  }
  revalidatePath("/app/trips/" + tripId);
  revalidatePath("/app/trips");
  return { ok: true };
}