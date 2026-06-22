import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { ChecklistsClient, type Task } from "./checklists-client";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  const { business, role } = await requireBusiness();
  if (!hasFloorService(business)) redirect("/app/reports");

  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const { data: templates } = await supabase
    .from("task_templates")
    .select("id, label, segment, assignee, sort")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("segment", { ascending: true })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  const ids = (templates ?? []).map((t) => t.id as string);
  const doneMap = new Map<string, { byName: string | null; at: string }>();
  if (ids.length > 0) {
    const { data: instances } = await supabase
      .from("task_instances")
      .select("template_id, completed_by_name, completed_at")
      .eq("business_id", business.id)
      .eq("business_date", today)
      .in("template_id", ids);
    for (const i of instances ?? []) doneMap.set(i.template_id as string, { byName: (i.completed_by_name as string | null) ?? null, at: i.completed_at as string });
  }

  const tasksBySegment: Record<string, Task[]> = { open: [], close: [], changeover: [] };
  for (const t of templates ?? []) {
    const seg = (t.segment as string) || "open";
    const d = doneMap.get(t.id as string);
    (tasksBySegment[seg] ??= []).push({
      id: t.id as string,
      label: (t.label as string) || "",
      assignee: (t.assignee as string | null) ?? null,
      done: !!d,
      byName: d?.byName ?? null,
      at: d?.at ?? null,
    });
  }

  const canManage = role === "owner" || role === "manager";

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Checklists</h1>
        <p className="text-muted-foreground text-sm mt-1">Opening, closing and changeover tasks. Check items off as you go — completions are signed and dated.</p>
      </div>
      <ChecklistsClient tasksBySegment={tasksBySegment} canManage={canManage} />
    </div>
  );
}
