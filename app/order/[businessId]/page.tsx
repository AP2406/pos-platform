import { createClient } from "@/lib/supabase/server";
import { OnlineOrderClient, type OnlineItem } from "./online-order-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

// GAP-1 (2/5): public online pickup ordering. Sibling of the table-QR route
// (/order/<businessId>/<elementId>); this no-element route is the takeout menu.
export default async function OnlineOrderPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) {
    return <Centered>This ordering page isn&apos;t available.</Centered>;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_online_menu", { p_business_id: businessId });
  const menu = (data ?? { found: false }) as {
    found: boolean;
    business_name?: string;
    enabled?: boolean;
    items?: OnlineItem[];
  };

  if (!menu.found) return <Centered>This ordering page isn&apos;t available.</Centered>;
  if (!menu.enabled) return <Centered>Online ordering isn&apos;t available here right now.</Centered>;

  return (
    <OnlineOrderClient
      businessId={businessId}
      businessName={menu.business_name ?? "Order"}
      items={menu.items ?? []}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500 text-lg p-8 text-center">
      {children}
    </div>
  );
}
