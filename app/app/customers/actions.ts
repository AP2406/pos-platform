"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type CustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export async function createCustomer(
  input: CustomerInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createCustomer:", error);
    return { error: "Could not create customer." };
  }

  revalidatePath("/app/customers");
  return { ok: true, id: data.id };
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateCustomer:", error);
    return { error: "Could not update customer." };
  }

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${id}`);
  return { ok: true };
}