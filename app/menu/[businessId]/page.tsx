import { createClient } from "@/lib/supabase/server";
import { MenuBoardClient, type MenuBoardItem } from "./menu-board-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

// P3-46 public digital menu board. Read-only; reflects 86 changes on a timer.
export default async function MenuBoardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Menu not found.</div>;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_menu", { p_business_id: businessId });
  const menu = (data ?? { found: false }) as {
    found: boolean;
    business_name?: string;
    items?: MenuBoardItem[];
  };

  if (!menu.found) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Menu not found.</div>;
  }

  return (
    <MenuBoardClient
      businessId={businessId}
      businessName={menu.business_name ?? "Menu"}
      initialItems={menu.items ?? []}
    />
  );
}
