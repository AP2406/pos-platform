import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { displayItemName } from "@/lib/format";
import { plateCostByItem } from "../accounting/cost";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

type MenuRow = { name: string; units: number; revenue: number; cost: number; costedUnits: number };
const QUAD: Record<string, { label: string; cls: string }> = {
  star: { label: "Star", cls: "text-emerald-600" },
  plow: { label: "Plowhorse", cls: "text-sky-600" },
  puzzle: { label: "Puzzle", cls: "text-amber-600" },
  dog: { label: "Dog", cls: "text-muted-foreground" },
};

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; mode?: string }>;
}) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const range = sp.range === "today" || sp.range === "30d" ? sp.range : "7d";
  const mode = sp.mode === "margin" ? "margin" : "revenue";
  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const now = Date.now();
  const since = new Date(now - (range === "today" ? 1 : range === "7d" ? 7 : 30) * 86400000).toISOString();
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const todayKey = dayKey(new Date().toISOString());
  const inRange = (iso: string) => (range === "today" ? dayKey(iso) === todayKey : new Date(iso).getTime() >= now - (range === "7d" ? 7 : 30) * 86400000);

  const [{ data: orders }, { data: items }, plate, { data: ktix }, { data: kstations }] = await Promise.all([
    supabase.from("orders").select("id, total, status, created_at, guest_count, seated_at").eq("business_id", business.id).neq("status", "voided").gte("created_at", since),
    supabase.from("order_items").select("order_id, catalog_item_id, name, quantity, unit_price, created_at").eq("business_id", business.id).gte("created_at", since),
    plateCostByItem(supabase, business.id),
    supabase.from("kitchen_tickets").select("station_id, fired_at, fulfilled_at").eq("business_id", business.id).gte("fired_at", since).not("fulfilled_at", "is", null),
    supabase.from("kitchen_stations").select("id, name").eq("business_id", business.id),
  ]);

  // B4 speed-of-service: fire → bump time per ticket + per station.
  const stationName = new Map((kstations ?? []).map((s) => [s.id as string, (s.name as string) || "Station"]));
  let kTimeSum = 0, kTimeN = 0;
  const perStation = new Map<string, { sum: number; n: number }>();
  for (const k of ktix ?? []) {
    const mins = (new Date(k.fulfilled_at as string).getTime() - new Date(k.fired_at as string).getTime()) / 60000;
    if (mins < 0 || mins > 240) continue;
    kTimeSum += mins; kTimeN += 1;
    const sid = (k.station_id as string | null) ?? "none";
    const cur = perStation.get(sid) ?? { sum: 0, n: 0 };
    cur.sum += mins; cur.n += 1; perStation.set(sid, cur);
  }
  const avgTicketMin = kTimeN > 0 ? kTimeSum / kTimeN : 0;
  const stationTimes = Array.from(perStation.entries())
    .map(([sid, v]) => ({ name: sid === "none" ? "Unrouted" : stationName.get(sid) ?? "Station", avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);

  const liveOrders = (orders ?? []).filter((o) => inRange(o.created_at as string));
  const liveIds = new Set(liveOrders.map((o) => o.id as string));

  // Daypart (hour of day) + day of week.
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
  const dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const byHour = new Array(24).fill(0);
  const byDow = new Map<string, number>();
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const o of liveOrders) {
    const t = Number(o.total) || 0;
    const h = Number(hourFmt.format(new Date(o.created_at as string))) % 24;
    byHour[h] += t;
    const dow = dowFmt.format(new Date(o.created_at as string));
    byDow.set(dow, (byDow.get(dow) ?? 0) + t);
  }
  const maxHour = Math.max(1, ...byHour);
  const maxDow = Math.max(1, ...DOW.map((d) => byDow.get(d) ?? 0));

  // Covers + table-turn-time (from orders that carry guest_count / seated_at).
  let coversTotal = 0, coverSales = 0, coverChecks = 0, turnSum = 0, turnCount = 0;
  for (const o of liveOrders) {
    const g = Number(o.guest_count) || 0;
    if (g > 0) { coversTotal += g; coverSales += Number(o.total) || 0; coverChecks += 1; }
    if (o.seated_at) {
      const mins = (new Date(o.created_at as string).getTime() - new Date(o.seated_at as string).getTime()) / 60000;
      if (mins > 0 && mins < 600) { turnSum += mins; turnCount += 1; }
    }
  }
  const salesPerCover = coversTotal > 0 ? coverSales / coversTotal : 0;
  const avgTurnMin = turnCount > 0 ? turnSum / turnCount : 0;
  const avgPartySize = coverChecks > 0 ? coversTotal / coverChecks : 0;
  const hasCovers = coversTotal > 0 || turnCount > 0;

  // Menu mix (exclude voided orders' items). Cost accumulates each line's recipe
  // plate cost × qty (0 when no recipe); costedUnits tracks recipe coverage.
  const menu = new Map<string, MenuRow>();
  for (const it of items ?? []) {
    if (!liveIds.has(it.order_id as string)) continue;
    if (!inRange(it.created_at as string)) continue;
    const base = displayItemName((it.name as string).replace(/\s*\(\+[^)]*\)\s*$/, ""));
    if (!base) continue;
    const qty = Number(it.quantity) || 0;
    const cid = it.catalog_item_id as string | null;
    const hasRecipe = cid != null && plate.has(cid);
    const row = menu.get(base) ?? { name: base, units: 0, revenue: 0, cost: 0, costedUnits: 0 };
    row.units += qty;
    row.revenue += (Number(it.unit_price) || 0) * qty;
    if (hasRecipe) {
      row.cost += (plate.get(cid as string) || 0) * qty;
      row.costedUnits += qty;
    }
    menu.set(base, row);
  }
  const menuRows = Array.from(menu.values()).map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * 100) / 100,
    cost: Math.round(r.cost * 100) / 100,
    margin: Math.round((r.revenue - r.cost) * 100) / 100,
  }));
  type Row = (typeof menuRows)[number];
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  // Profitability axis = revenue, or contribution margin in margin mode.
  const profitOf = (r: Row) => (mode === "margin" ? r.margin : r.revenue);
  const medU = median(menuRows.map((r) => r.units));
  const medP = median(menuRows.map((r) => profitOf(r)));
  const quadOf = (r: Row) => {
    const hu = r.units >= medU, hp = profitOf(r) >= medP;
    return hu && hp ? "star" : hu && !hp ? "plow" : !hu && hp ? "puzzle" : "dog";
  };
  const topMenu = menuRows.sort((a, b) => profitOf(b) - profitOf(a)).slice(0, 25);
  const anyUncosted = mode === "margin" && menuRows.some((r) => r.costedUnits < r.units);

  const tabs = [{ key: "today", label: "Today" }, { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }];

  const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{label}</span>
      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
        <div className="h-full bg-foreground/70" style={{ width: Math.round((value / max) * 100) + "%" }} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums">{value > 0 ? money(value) : ""}</span>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">When you&apos;re busy and what sells. Voided sales excluded.</p>
        </div>
        <Link href="/app/reports" className="text-sm text-muted-foreground underline hover:text-foreground shrink-0">Reports →</Link>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link key={t.key} href={"/app/insights?range=" + t.key}
            className={"text-sm rounded-md px-3 py-1.5 border " + (range === t.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <h2 className="font-semibold mb-2 text-sm">By hour</h2>
          <div className="space-y-1">
            {byHour.map((v, h) => (v > 0 ? <Bar key={h} label={(h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "a" : "p")} value={v} max={maxHour} /> : null))}
          </div>
        </div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <h2 className="font-semibold mb-2 text-sm">By day of week</h2>
          <div className="space-y-1">
            {DOW.map((d) => <Bar key={d} label={d} value={byDow.get(d) ?? 0} max={maxDow} />)}
          </div>
        </div>
      </div>

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
        <h2 className="font-semibold mb-2 text-sm">Covers &amp; table turn</h2>
        {!hasCovers ? (
          <p className="text-xs text-muted-foreground">No guest counts recorded yet — enter a party size when opening a table to track covers and turn time.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><div className="text-muted-foreground text-xs">Covers</div><div className="text-lg font-semibold tabular-nums">{coversTotal}</div></div>
            <div><div className="text-muted-foreground text-xs">Sales / cover</div><div className="text-lg font-semibold tabular-nums">{money(salesPerCover)}</div></div>
            <div><div className="text-muted-foreground text-xs">Avg table turn</div><div className="text-lg font-semibold tabular-nums">{avgTurnMin > 0 ? Math.round(avgTurnMin) + "m" : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Avg party</div><div className="text-lg font-semibold tabular-nums">{avgPartySize > 0 ? avgPartySize.toFixed(1) : "—"}</div></div>
          </div>
        )}
      </div>

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
        <h2 className="font-semibold mb-2 text-sm">Kitchen speed</h2>
        {kTimeN === 0 ? (
          <p className="text-xs text-muted-foreground">No bumped kitchen tickets in this range yet.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-semibold tabular-nums">{avgTicketMin.toFixed(1)}m</span>
              <span className="text-xs text-muted-foreground">avg fire → bump · {kTimeN} tickets</span>
            </div>
            <div className="space-y-1">
              {stationTimes.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.name}<span className="text-xs ml-1">{s.n}</span></span>
                  <span className={"tabular-nums " + (s.avg >= avgTicketMin * 1.3 ? "text-amber-600 font-medium" : "")}>{s.avg.toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold">
            Menu engineering <span className="text-xs font-normal text-muted-foreground ml-1">{mode === "margin" ? "popularity × profit margin" : "popularity × revenue"}</span>
          </div>
          <div className="flex gap-1.5 text-xs">
            {[
              { key: "revenue", label: "By revenue" },
              { key: "margin", label: "By margin" },
            ].map((m) => (
              <Link key={m.key} href={"/app/insights?range=" + range + (m.key === "margin" ? "&mode=margin" : "")}
                className={"rounded-md px-2.5 py-1 border " + (mode === m.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        {topMenu.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No items sold in this range.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium text-right">Units</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                {mode === "margin" && <th className="px-3 py-2 font-medium text-right">Margin</th>}
                {mode === "margin" && <th className="px-3 py-2 font-medium text-right">Food %</th>}
                <th className="px-3 py-2 font-medium text-right">Class</th>
              </tr>
            </thead>
            <tbody>
              {topMenu.map((r) => {
                const q = QUAD[quadOf(r)];
                const uncosted = r.costedUnits < r.units;
                const foodPct = r.revenue > 0 ? Math.round((r.cost / r.revenue) * 1000) / 10 : null;
                return (
                  <tr key={r.name} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium truncate max-w-[260px]">
                      {r.name}
                      {mode === "margin" && uncosted && <span className="ml-1.5 text-[10px] text-amber-600" title="No recipe — margin may be overstated">no recipe</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.units}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                    {mode === "margin" && <td className="px-3 py-2 text-right tabular-nums">{money(r.margin)}</td>}
                    {mode === "margin" && <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{foodPct != null && r.cost > 0 ? foodPct + "%" : "—"}</td>}
                    <td className={"px-3 py-2 text-right font-medium " + q.cls}>{q.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {anyUncosted && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
            Items marked &ldquo;no recipe&rdquo; count as $0 food cost, so their margin equals revenue. <Link href="/app/recipes" className="underline hover:text-foreground">Add recipes</Link> for accurate margins.
          </div>
        )}
      </div>
    </div>
  );
}
