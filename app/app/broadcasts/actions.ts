"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { notifyBusiness } from "@/lib/push";
import { revalidatePath } from "next/cache";

// D7: staff broadcast / messaging — manager announcements with per-staff
// acknowledgement (staff ack by PIN at the shared clock terminal).
export async function postBroadcast(input: { title: string; body: string }): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can post." };
  const title = (input.title || "").trim().slice(0, 160);
  const body = (input.body || "").trim().slice(0, 4000);
  if (!title) return { error: "Add a title." };
  if (!body) return { error: "Write the announcement." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("staff_broadcasts").insert({
    business_id: business.id,
    author_id: user ? user.id : null,
    author_name: user?.email ? (user.email as string).split("@")[0] : null,
    title,
    body,
  });
  if (error) {
    console.error("postBroadcast:", error);
    return { error: "Could not post the announcement." };
  }
  try {
    await notifyBusiness(business.id, "exception", { title: "Staff announcement: " + title, body: body.slice(0, 120), url: "/app/broadcasts" });
  } catch { /* best-effort */ }
  revalidatePath("/app/broadcasts");
  revalidatePath("/app/clock");
  return { ok: true };
}

export async function setBroadcastActive(id: string, active: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_broadcasts").update({ active }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not update." };
  revalidatePath("/app/broadcasts");
  revalidatePath("/app/clock");
  return { ok: true };
}

export async function deleteBroadcast(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_broadcasts").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/broadcasts");
  revalidatePath("/app/clock");
  return { ok: true };
}

// Staff acknowledges a broadcast with their PIN (at the shared clock terminal).
export async function ackBroadcast(broadcastId: string, pin: string): Promise<{ ok: true; name: string } | { error: string }> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { error: "Enter your 4 to 6 digit PIN." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: bc } = await supabase
    .from("staff_broadcasts")
    .select("id")
    .eq("id", broadcastId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!bc) return { error: "Announcement not found." };

  const { data } = await supabase.rpc("verify_staff_member_pin", { p_business_id: business.id, p_pin: pin });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "PIN not recognized." };

  const { error } = await supabase.from("broadcast_acks").upsert(
    { business_id: business.id, broadcast_id: broadcastId, staff_id: row.id as string, staff_name: row.name as string },
    { onConflict: "broadcast_id,staff_id", ignoreDuplicates: true }
  );
  if (error) {
    console.error("ackBroadcast:", error);
    return { error: "Could not record your acknowledgement." };
  }
  revalidatePath("/app/clock");
  revalidatePath("/app/broadcasts");
  return { ok: true, name: row.name as string };
}
