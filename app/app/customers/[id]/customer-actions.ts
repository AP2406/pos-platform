"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// ───────────────────────────────────────────
// NOTES
// ───────────────────────────────────────────

export async function updateCustomerNotes(input: {
  customerId: string;
  notes: string;
}): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  if (input.notes.length > 5000) {
    return { error: "Notes too long (max 5000 characters)." };
  }

  const { error } = await supabase
    .from("customers")
    .update({ notes: input.notes.trim() || null })
    .eq("id", input.customerId);

  if (error) {
    console.error("updateCustomerNotes:", error);
    return { error: "Could not save notes." };
  }

  revalidatePath(`/app/customers/${input.customerId}`);
  revalidatePath("/app/customers");
  return { ok: true };
}

// ───────────────────────────────────────────
// TAGS — create / delete / attach / detach
// ───────────────────────────────────────────

const VALID_COLORS = [
  "gray",
  "red",
  "amber",
  "green",
  "blue",
  "purple",
  "pink",
];

export async function createTag(input: {
  name: string;
  color: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) return { error: "Tag name is required." };
  if (name.length > 40) return { error: "Tag name too long (max 40 chars)." };

  const color = VALID_COLORS.includes(input.color) ? input.color : "gray";

  const { data, error } = await supabase
    .from("tags")
    .insert({
      business_id: business.id,
      name,
      color,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "That tag name already exists." };
    }
    console.error("createTag:", error);
    return { error: "Could not create tag." };
  }

  revalidatePath("/app/customers");
  return { ok: true, id: data.id };
}

export async function deleteTag(
  tagId: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    console.error("deleteTag:", error);
    return { error: "Could not delete tag." };
  }

  revalidatePath("/app/customers");
  return { ok: true };
}

export async function attachTagToCustomer(input: {
  customerId: string;
  tagId: string;
}): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("customer_tags").insert({
    customer_id: input.customerId,
    tag_id: input.tagId,
  });

  if (error) {
    // Ignore duplicate-key errors (already attached)
    if (error.code !== "23505") {
      console.error("attachTagToCustomer:", error);
      return { error: "Could not attach tag." };
    }
  }

  revalidatePath(`/app/customers/${input.customerId}`);
  revalidatePath("/app/customers");
  return { ok: true };
}

export async function detachTagFromCustomer(input: {
  customerId: string;
  tagId: string;
}): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customer_tags")
    .delete()
    .eq("customer_id", input.customerId)
    .eq("tag_id", input.tagId);

  if (error) {
    console.error("detachTagFromCustomer:", error);
    return { error: "Could not remove tag." };
  }

  revalidatePath(`/app/customers/${input.customerId}`);
  revalidatePath("/app/customers");
  return { ok: true };
}