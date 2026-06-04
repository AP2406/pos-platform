"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { BUSINESS_MODES } from "@/lib/modules/modes";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/services/tenancy";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  mode: z.string().min(1, "Pick what kind of business you run."),
});

export async function createBusiness(input: {
  name: string;
  mode: string;
}): Promise<{ ok: true; businessId: string } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const mode = BUSINESS_MODES.find((m) => m.key === parsed.data.mode);
  if (!mode) {
    return { error: "Please pick a business type from the list." };
  }
  if (mode.status !== "live") {
    return { error: "That business type is coming soon. Please pick another for now." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated. Please sign in again." };

  // 1. Create the business. `industry` satisfies the enum column; `config`
  //    drives the menu/labels and records the chosen mode key.
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      name: parsed.data.name,
      industry: mode.industry,
      owner_id: user.id,
      config: { ...mode.config, mode: mode.key },
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
    return { error: "Business created but membership failed. Contact support." };
  }

  // 3. Make the brand-new business the active workspace.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, business.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true, businessId: business.id };
}