"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

export async function verifyManagerPin(
  pin: string
): Promise<{ ok: true; name: string } | { error: string }> {
  if (!pin || !/^[0-9]{4,6}$/.test(pin)) {
    return { error: "Enter a 4 to 6 digit PIN." };
  }
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: business.id,
    p_pin: pin,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.role !== "manager") {
    return { error: "Manager PIN not recognized." };
  }
  return { ok: true, name: row.name as string };
}