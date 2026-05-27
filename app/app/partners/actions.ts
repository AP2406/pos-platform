"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const partnerSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    contact_name: z.string().max(200).optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    default_cookie_percent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .nullable(),
    default_cookie_flat: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !(
        data.default_cookie_percent != null &&
        data.default_cookie_flat != null
      ),
    { message: "Use either percentage OR flat amount, not both." }
  );

type PartnerInput = {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  default_cookie_percent?: number | null;
  default_cookie_flat?: number | null;
  notes?: string;
};

export async function createPartner(
  input: PartnerInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partners")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      contact_name: parsed.data.contact_name || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      default_cookie_percent: parsed.data.default_cookie_percent ?? null,
      default_cookie_flat: parsed.data.default_cookie_flat ?? null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createPartner:", error);
    return { error: "Could not create partner." };
  }

  revalidatePath("/app/partners");
  return { ok: true, id: data.id };
}

export async function updatePartner(
  id: string,
  input: PartnerInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("partners")
    .update({
      name: parsed.data.name,
      contact_name: parsed.data.contact_name || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      default_cookie_percent: parsed.data.default_cookie_percent ?? null,
      default_cookie_flat: parsed.data.default_cookie_flat ?? null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updatePartner:", error);
    return { error: "Could not update partner." };
  }

  revalidatePath("/app/partners");
  revalidatePath(`/app/partners/${id}`);
  return { ok: true };
}