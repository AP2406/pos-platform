"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  industry: z.enum([
    "transportation",
    "restaurant",
    "retail",
    "service",
    "mobile_seller",
  ]),
});

export async function createBusiness(input: {
  name: string;
  industry: string;
}): Promise<{ ok: true; businessId: string } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated. Please sign in again." };

 
  // 1. Create the business
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      name: parsed.data.name,
      industry: parsed.data.industry,
      owner_id: user.id,
    })
    .select()
    .single();

  if (bizError || !business) {
    console.error("createBusiness:", bizError);
    return { error: "Could not create business. Please try again." };
  }

  // 2. Add the creator as the owner-member
  const { error: memberError } = await supabase
    .from("business_members")
    .insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    console.error("createBusiness (member):", memberError);
    return {
      error: "Business created but membership failed. Contact support.",
    };
  }

  return { ok: true, businessId: business.id };
}