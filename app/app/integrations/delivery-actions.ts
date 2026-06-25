"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { integrationEnabled } from "@/lib/services/integrations";
import { isDeliveryPlatform } from "@/lib/services/delivery";
import { revalidatePath } from "next/cache";

// GAP-1 (4/5): inject a sample delivery order so an operator can verify the whole
// pipeline (KDS card with platform badge + by-channel reporting + 'delivery' tender)
// without a live platform connection. Owner/manager only; needs the delivery
// connector enabled.
export async function sendTestDeliveryOrder(platform: string): Promise<{ ok: true; orderId: string | null } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can do this." };
  if (!isDeliveryPlatform(platform)) return { error: "Unknown platform." };
  if (!integrationEnabled((business as { settings?: unknown }).settings, "delivery")) {
    return { error: "Enable the delivery connector first." };
  }
  const supabase = await createClient();
  const externalId = "test-" + platform + "-" + Date.now();
  const { data, error } = await supabase.rpc("inject_delivery_order", {
    p_business_id: business.id,
    p_platform: platform,
    p_external_id: externalId,
    p_display_id: "TEST",
    p_items: [
      { name: "Test Burger", quantity: 1, unit_price: 14.5 },
      { name: "Fries", quantity: 1, unit_price: 5 },
    ],
    p_subtotal: 19.5,
    p_tax: 0,
    p_total: 19.5,
  });
  if (error) {
    console.error("sendTestDeliveryOrder:", error);
    return { error: "Could not inject the test order. Is migration 0074 applied?" };
  }
  revalidatePath("/app/kitchen");
  const res = (data ?? null) as { order_id?: string } | null;
  return { ok: true, orderId: res?.order_id ?? null };
}
