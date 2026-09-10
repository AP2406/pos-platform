import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { LogForm, DeleteLogButton } from "./log-form";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

const CAT_META: Record<string, { label: string; cls: string }> = {
  note: { label: "Note", cls: "bg-muted text-muted-foreground" },
  incident: { label: "Incident", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  maintenance: { label: "Maintenance", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
  cash: { label: "Cash", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  weather: { label: "Weather/Events", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
};

export default async function ShiftLogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "void");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const q = (sp.q || "").trim().slice(0, 100);
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const supabase = await createClient();
  let query = supabase
    .from("shift_logs")
    .select("id, author_name, shift_date, category, body, created_at")
    .eq("business_id", business.id)
    .order("shift_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("body", `%${q}%`);
  const { data: logs } = await query;

  const fmtDate = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(d + "T00:00:00Z"));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  // Group by shift_date.
  const groups: { date: string; rows: typeof logs }[] = [];
  for (const l of logs ?? []) {
    const d = l.shift_date as string;
    let g = groups.find((x) => x.date === d);
    if (!g) { g = { date: d, rows: [] }; groups.push(g); }
    g.rows!.push(l);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Shift log</h1>
        <p className="text-muted-foreground text-sm mt-1">The manager&apos;s red book — handoff notes and incidents. Separate from the system activity log.</p>
      </div>

      <LogForm today={today} />

      <form className="mb-4" action="/app/log" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search the log…"
          className="h-9 w-full max-w-sm rounded-md border border-border bg-transparent px-3 text-sm"
        />
      </form>

      {(!logs || logs.length === 0) ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          {q ? "No entries match that search." : "No log entries yet. Add the first handoff note above."}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{fmtDate(g.date)}</div>
              <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
                {(g.rows ?? []).map((l) => {
                  const m = CAT_META[l.category as string] ?? CAT_META.note;
                  return (
                    <div key={l.id as string} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={"inline-block rounded-full px-2 py-0.5 text-[12px] font-medium " + m.cls}>{m.label}</span>
                        <span className="text-[12px] text-muted-foreground">{fmtTime(l.created_at as string)}{l.author_name ? " · " + l.author_name : ""}</span>
                        <span className="ml-auto"><DeleteLogButton id={l.id as string} /></span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{l.body as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
