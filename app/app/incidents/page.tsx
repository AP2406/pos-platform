import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { IncidentsClient, type Incident } from "./incidents-client";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "void");
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_incidents")
    .select("id, type, severity, body, resolution, status, created_by_name, created_at, resolved_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(300);

  const incidents: Incident[] = (data ?? []).map((i) => ({
    id: i.id as string,
    type: (i.type as string) || "complaint",
    severity: (i.severity as string) || "medium",
    body: (i.body as string) || "",
    resolution: (i.resolution as string | null) ?? null,
    status: (i.status as string) || "open",
    createdByName: (i.created_by_name as string | null) ?? null,
    createdAt: i.created_at as string,
    resolvedAt: (i.resolved_at as string | null) ?? null,
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Customer incidents</h1>
        <p className="text-muted-foreground text-sm mt-1">Complaints, allergy incidents and how they were resolved — the qualitative record, separate from Exceptions.</p>
      </div>
      <IncidentsClient incidents={incidents} />
    </div>
  );
}
