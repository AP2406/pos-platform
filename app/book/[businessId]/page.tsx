import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BookClient } from "./book-client";

export const dynamic = "force-dynamic";

// Public, tokenless online-booking page. Gated by the business's
// online_booking_enabled config (enforced in the RPC). Writes into the same
// reservations table via the anon submit_online_reservation RPC.
export default async function BookPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_booking_business", { p_business_id: businessId });
  const biz = Array.isArray(data) ? data[0] : data;
  if (!biz || !biz.enabled) notFound();

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">{biz.name}</h1>
        <p className="text-muted-foreground text-sm mt-1 mb-6">Book a table</p>
        <BookClient businessId={businessId} timezone={biz.timezone || "America/Toronto"} />
      </div>
    </div>
  );
}
