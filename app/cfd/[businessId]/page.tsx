import { createClient } from "@/lib/supabase/server";
import { CfdClient } from "./cfd-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

export default async function CfdPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  if (!UUID.test(businessId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
        Display not found.
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_menu", { p_business_id: businessId });
  const businessName =
    ((data as { business_name?: string } | null)?.business_name as string) || "Welcome";

  return <CfdClient businessId={businessId} businessName={businessName} />;
}
