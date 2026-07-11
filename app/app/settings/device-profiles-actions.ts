"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { deviceProfilesSchema, type DeviceProfile } from "@/lib/services/device-profiles";

export async function saveDeviceProfiles(profiles: DeviceProfile[]): Promise<{ ok: true } | { error: string }> {
  const parsed = deviceProfilesSchema.safeParse(profiles);
  if (!parsed.success) return { error: "Check the profile details and try again." };
  // Names must be distinct so the device picker is usable.
  const names = parsed.data.map((p) => p.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Give each profile a distinct name." };

  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change device profiles." };

  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, device_profiles: parsed.data } })
    .eq("id", business.id);
  if (error) {
    console.error("saveDeviceProfiles:", error);
    return { error: "Could not save device profiles." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}
