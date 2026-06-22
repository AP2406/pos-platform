import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { RecordsClient, type Writeup } from "./records-client";

export const dynamic = "force-dynamic";

export default async function StaffRecordsPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const [{ data: staffRows }, { data: writeupRows }] = await Promise.all([
    supabase.from("staff_members").select("id, name").eq("business_id", business.id).eq("is_active", true).order("name"),
    supabase
      .from("staff_writeups")
      .select("id, staff_id, type, body, occurred_on, author_name, created_at")
      .eq("business_id", business.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const staff = (staffRows ?? []).map((s) => ({ id: s.id as string, name: (s.name as string) || "Staff" }));
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const writeups: Writeup[] = (writeupRows ?? []).map((w) => ({
    id: w.id as string,
    staffId: w.staff_id as string,
    staffName: nameById.get(w.staff_id as string) ?? "Staff",
    type: (w.type as string) || "writeup",
    body: (w.body as string) || "",
    occurredOn: w.occurred_on as string,
    authorName: (w.author_name as string | null) ?? null,
    createdAt: w.created_at as string,
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Staff records</h1>
        <p className="text-muted-foreground text-sm mt-1">Write-ups, commendations and coaching notes. Visible to owners and managers only.</p>
      </div>
      <RecordsClient staff={staff} writeups={writeups} today={today} />
    </div>
  );
}
