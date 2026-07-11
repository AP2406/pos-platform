import { z } from "zod";

// Device profiles (Square's per-device lever): a named set of register behaviors a
// device inherits, so a bar / dining-room / takeout-counter iPad each start right.
// Pure types + parsing here (no "use server"); the write action lives in
// app/app/settings/device-profiles-actions.ts. Only FULLY-WIRED behaviors — no
// inert toggles.
export type DeviceProfile = {
  id: string;
  name: string;
  default_to_seat: boolean; // start new items on Seat 1 (table mode)
  default_dining_option: "dine_in" | "takeout" | "delivery" | "pickup";
};

export const deviceProfileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  default_to_seat: z.coerce.boolean(),
  default_dining_option: z.enum(["dine_in", "takeout", "delivery", "pickup"]),
});
export const deviceProfilesSchema = z.array(deviceProfileSchema).max(20);

export function parseDeviceProfiles(settings: unknown): DeviceProfile[] {
  const raw = (settings as { device_profiles?: unknown } | null)?.device_profiles;
  const parsed = deviceProfilesSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
