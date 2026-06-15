import { createClient } from "@/lib/supabase/server";
import { KioskClient, type KioskItem } from "./kiosk-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

export default async function KioskPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) {
    return <Centered>Kiosk not found.</Centered>;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_kiosk_menu", { p_business_id: businessId });
  const menu = (data ?? { found: false }) as {
    found: boolean;
    business_name?: string;
    enabled?: boolean;
    items?: KioskItem[];
  };

  if (!menu.found) return <Centered>Kiosk not found.</Centered>;
  if (!menu.enabled) return <Centered>Ordering isn&apos;t available here right now.</Centered>;

  return (
    <KioskClient
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
