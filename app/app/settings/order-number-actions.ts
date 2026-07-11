"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const seedSchema = z.object({
  // Cap well below bigint to keep it sane; 1 .. ~1e12.
  seed: z.coerce.number().int().min(1).max(1_000_000_000_000),
});

type SeedResult = { ok: true; next: number } | { error: string };

// Set the NEXT sale/bill number. The RPC gates owner/manager and refuses to move
// the counter backwards (would risk duplicate sale numbers).
export async function setSaleNumberSeed(seed: number): Promise<SeedResult> {
  const parsed = seedSchema.safeParse({ seed });
  if (!parsed.success) return { error: "Enter a whole number of 1 or greater." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change the order number." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_sale_number_seed", {
    p_business_id: business.id,
    p_seed: parsed.data.seed,
  });
  if (error) {
    // Surface the RPC's own message (e.g. "can't go backwards") when it's useful.
    const msg = error.message || "";
    if (/backwards/i.test(msg)) return { error: msg.replace(/^.*?:\s*/, "") };
    console.error("setSaleNumberSeed:", error);
    return { error: "Could not update the order number. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true, next: Number(data) };
}
