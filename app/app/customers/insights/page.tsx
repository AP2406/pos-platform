import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) => "$" + r2(n).toFixed(2);

// C6: RFM / retention. Per-customer Recency (days since last order), Frequency
// (visits) and Monetary (lifetime spend) over the last 365 days, rolled into
// human segments plus a lapsed-guest win-back list. Read-only.
type Seg = "champion" | "loyal" | "atrisk" | "new" | "lapsed" | "occasional";
const SEG_META: Record<Seg, { label: string; cls: string; blurb: string }> = {
  champion: { label: "Champions", cls: "text-emerald-600", blurb: "Frequent & recent" },
  loyal: { label: "Loyal", cls: "text-sky-600", blurb: "Regulars, still active" },
  new: { label: "New", cls: "text-violet-600", blurb: "First visits, ≤30d" },
  atrisk: { label: "At risk", cls: "text-amber-600", blurb: "Were regular, slipping" },
  lapsed: { label: "Lapsed", cls: "text-red-600", blurb: "No visit in 90+ days" },
  occasional: { label: "Occasional", cls: "text-muted-foreground", blurb: "Infrequent" },
};
const SEG_ORDER: Seg[] = ["champion", "loyal", "new", "atrisk", "lapsed", "occasional"];

function classify(visits: number, recencyDays: number): Seg {
  if (recencyDays > 90) return "lapsed";
  if (visits >= 5 && recencyDays <= 30) return "champion";
  if (visits >= 3 && recencyDays <= 45) return "loyal";
  if (visits >= 3 && recencyDays > 45) return "atrisk";
  if (visits <= 2 && recencyDays <= 30) return "new";
  return "occasional";
}

export default async function CustomerInsightsPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "access_reports");
  if (business.industry === "transportation") redirect("/app/customers");

  const supabase = await createClient();
  const now = Date.now();
  const since = new Date(now - 365 * 86400000).toISOString();

  const [{ data: custs }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("id, name, email, marketing_consent").eq("business_id", business.id),
    supabase
      .from("orders")
      .select("customer_id, total, created_at, status")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .not("customer_id", "is", null)
      .gte("created_at", since),
  ]);

  type Stat = { id: string; name: string; email: string | null; consent: boolean; visits: number; spend: number; firstMs: number; lastMs: number };
  const byCust = new Map<string, Stat>();
  for (const c of custs ?? []) {
    byCust.set(c.id as string, {
      id: c.id as string,
      name: (c.name as string) || "Guest",
      email: (c.email as string | null) ?? null,
      consent: !!c.marketing_consent,
      visits: 0, spend: 0, firstMs: Infinity, lastMs: 0,
    });
  }
  for (const o of orders ?? []) {
    const s = byCust.get(o.customer_id as string);
    if (!s) continue;
    const ms = new Date(o.created_at as string).getTime();
    s.visits += 1;
    s.spend += Number(o.total) || 0;
    if (ms < s.firstMs) s.firstMs = ms;
    if (ms > s.lastMs) s.lastMs = ms;
  }

  const active = Array.from(byCust.values()).filter((s) => s.visits > 0);
  const enriched = active.map((s) => {
    const recencyDays = Math.floor((now - s.lastMs) / 86400000);
    const spanDays = s.visits >= 2 ? (s.lastMs - s.firstMs) / 86400000 : 0;
    const avgGap = s.visits >= 2 ? spanDays / (s.visits - 1) : null;
    return { ...s, spend: r2(s.spend), recencyDays, seg: classify(s.visits, recencyDays), avgGap };
  });

  // Headline metrics.
  const total = enriched.length;
  const activeN = enriched.filter((e) => e.recencyDays <= 30).length;
  const lapsedN = enriched.filter((e) => e.recencyDays > 90).length;
  const repeat = enriched.filter((e) => e.visits >= 2).length;
  const repeatRate = total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0;
  const avgLtv = total > 0 ? r2(enriched.reduce((s, e) => s + e.spend, 0) / total) : 0;
  const avgVisits = total > 0 ? Math.round((enriched.reduce((s, e) => s + e.visits, 0) / total) * 10) / 10 : 0;
  const gaps = enriched.map((e) => e.avgGap).filter((g): g is number => g != null && g > 0);
  const avgGapDays = gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;

  // Segment rollup.
  const segAgg = new Map<Seg, { n: number; spend: number }>();
  for (const e of enriched) {
    const a = segAgg.get(e.seg) ?? { n: 0, spend: 0 };
    a.n += 1; a.spend += e.spend; segAgg.set(e.seg, a);
  }

  // Lapsed win-back list — highest lifetime spend among the lapsed.
  const lapsedList = enriched.filter((e) => e.seg === "lapsed").sort((a, b) => b.spend - a.spend).slice(0, 15);
  const fmtDate = (ms: number) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));

  return (
    <div className="max-w-4xl">
      <Link href="/app/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Customers
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Customer insights</h1>
        <p className="text-muted-foreground text-sm mt-1">Retention &amp; RFM over the last 12 months. Repeat behaviour, value, and who&apos;s slipping away.</p>
      </div>

      {total === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No customer orders in the last year yet. Attach a customer to checks at the register to build this.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Stat label="Customers" value={String(total)} />
            <Stat label="Active (≤30d)" value={String(activeN)} />
            <Stat label="Lapsed (90d+)" value={String(lapsedN)} tone={lapsedN > 0 ? "warn" : undefined} />
            <Stat label="Repeat rate" value={repeatRate + "%"} />
            <Stat label="Avg LTV" value={money(avgLtv)} />
            <Stat label="Avg visits" value={String(avgVisits)} hint={avgGapDays ? "~" + avgGapDays + "d apart" : undefined} />
          </div>

          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden mb-6">
            <div className="px-3 py-2 border-b border-border text-sm font-semibold">Segments</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 font-medium text-right">Customers</th>
                  <th className="px-3 py-2 font-medium text-right">Share</th>
                  <th className="px-3 py-2 font-medium text-right">Avg spend</th>
                </tr>
              </thead>
              <tbody>
                {SEG_ORDER.filter((s) => segAgg.has(s)).map((s) => {
                  const a = segAgg.get(s)!;
                  const m = SEG_META[s];
                  return (
                    <tr key={s} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <span className={"font-medium " + m.cls}>{m.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{m.blurb}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.n}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Math.round((a.n / total) * 100)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(a.spend / a.n)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lapsedList.length > 0 && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Win-back list — lapsed, by value</div>
                <Link href="/app/marketing" className="text-xs underline text-muted-foreground hover:text-foreground">Email the lapsed segment →</Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium text-right">Visits</th>
                    <th className="px-3 py-2 font-medium text-right">Lifetime</th>
                    <th className="px-3 py-2 font-medium text-right">Last visit</th>
                  </tr>
                </thead>
                <tbody>
                  {lapsedList.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Link href={"/app/customers/" + e.id} className="font-medium hover:underline">{e.name}</Link>
                        {!e.consent && <span className="ml-2 text-[10px] text-muted-foreground" title="Not opted in to email">no email consent</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.visits}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{money(e.spend)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDate(e.lastMs)}<span className="block text-[11px]">{e.recencyDays}d ago</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-lg font-semibold tabular-nums mt-0.5 " + (tone === "warn" ? "text-amber-600" : "")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
