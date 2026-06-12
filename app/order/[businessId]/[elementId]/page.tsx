import { createClient } from "@/lib/supabase/server";
import { GuestOrderClient, type GuestMenuItem } from "./order-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

// P2-27 public guest ordering. The menu + submit both go through anon-callable
// SECURITY DEFINER RPCs, so no RLS is opened up. Orders land on the table's open
// check (unfired) for staff to review — there is no online payment.
export default async function GuestOrderPage({
  params,
}: {
  params: Promise<{ businessId: string; elementId: string }>;
}) {
  const { businessId, elementId } = await params;

  function shell(msg: string) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <p className="text-sm text-muted-foreground max-w-sm text-center">{msg}</p>
      </div>
    );
  }

  if (!UUID.test(businessId) || !UUID.test(elementId)) return shell("This ordering link isn't valid.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_menu", {
    p_business_id: businessId,
    p_element_id: elementId,
  });
  if (error || !data) return shell("Sorry, we couldn't load the menu. Please ask your server.");

  const menu = data as {
    found: boolean;
    business_name?: string;
    enabled?: boolean;
    table_label?: string | null;
    open?: boolean;
    items?: GuestMenuItem[];
  };

  if (!menu.found) return shell("Restaurant not found.");
  if (!menu.enabled) return shell("Online ordering isn't available here right now.");
  if (!menu.open) return shell("Please ask your server to start your table, then scan again.");

  return (
    <GuestOrderClient
      businessId={businessId}
      elementId={elementId}
      businessName={menu.business_name ?? "Menu"}
      tableLabel={menu.table_label ?? null}
      items={menu.items ?? []}
    />
  );
}
