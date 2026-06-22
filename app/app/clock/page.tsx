import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { listOnShift } from "./time-actions";
import { ClockClient } from "./clock-client";

export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const { business } = await requireBusiness();
  if (!hasFloorService(business)) redirect("/app");

  const supabase = await createClient();
  const [onShift, { data: bcRows }] = await Promise.all([
    listOnShift(),
    // D7: active announcements staff acknowledge by PIN here.
    supabase
      .from("staff_broadcasts")
      .select("id, title, body")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const broadcasts = (bcRows ?? []).map((b) => ({ id: b.id as string, title: (b.title as string) || "", body: (b.body as string) || "" }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Time clock</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Staff clock in and out with their PIN.
        </p>
      </div>
      <ClockClient initialOnShift={onShift} broadcasts={broadcasts} />
    </div>
  );
}
