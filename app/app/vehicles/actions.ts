"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const vehicleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  vehicle_type: z.string().max(50).optional().or(z.literal("")),
  plate: z.string().max(20).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(60).optional().nullable(),
});

export async function createVehicle(input: {
  name: string;
  vehicle_type?: string;
  plate?: string;
  capacity?: number | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      vehicle_type: parsed.data.vehicle_type || null,
      plate: parsed.data.plate || null,
      capacity: parsed.data.capacity ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createVehicle:", error);
    return { error: "Could not add vehicle. Please try again." };
  }

  revalidatePath("/app/vehicles");
  return { ok: true, id: data.id };
}

export async function toggleVehicleActive(
  id: string,
  isActive: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("toggleVehicleActive:", error);
    return { error: "Could not update vehicle." };
  }

  revalidatePath("/app/vehicles");
  return { ok: true };
}