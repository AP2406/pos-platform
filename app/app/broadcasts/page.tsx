import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { BroadcastsClient, type Broadcast } from "./broadcasts-client";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const [{ data: bcRows }, { count: staffCount }] = await Promise.all([
    supabase
      .from("staff_broadcasts")
      .select("id, title, body, active, author_name, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("is_active", true),
  ]);

  const ids = (bcRows ?? []).map((b) => b.id as string);
  const acksByBc = new Map<string, { name: string; at: string }[]>();
  if (ids.length > 0) {
    const { data: acks } = await supabase
      .from("broadcast_acks")
      .select("broadcast_id, staff_name, acked_at")
      .in("broadcast_id", ids);
    for (const a of acks ?? []) {
      const arr = acksByBc.get(a.broadcast_id as string) ?? [];
      arr.push({ name: (a.staff_name as string) || "Staff", at: a.acked_at as string });
      acksByBc.set(a.broadcast_id as string, arr);
    }
  }

  const broadcasts: Broadcast[] = (bcRows ?? []).map((b) => ({
    id: b.id as string,
    title: (b.title as string) || "",
    body: (b.body as string) || "",
    active: b.active !== false,
    authorName: (b.author_name as string | null) ?? null,
    createdAt: b.created_at as string,
    acks: acksByBc.get(b.id as string) ?? [],
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="text-muted-foreground text-sm mt-1">Broadcast to your team. Staff acknowledge by PIN at the time clock.</p>
      </div>
      <BroadcastsClient broadcasts={broadcasts} staffCount={staffCount ?? 0} />
    </div>
  );
}
