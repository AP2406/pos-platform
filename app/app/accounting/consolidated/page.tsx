import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { consolidatedBooks } from "./actions";
import { IntercompanyForm } from "./intercompany-form";

export const dynamic = "force-dynamic";

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
}

export default async function ConsolidatedPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const periodKey = sp.period === "last_month" || sp.period === "this_quarter" ? sp.period : "this_month";
  const result = await consolidatedBooks(periodKey);
  const currency = (business.currency || "USD").toUpperCase();

  const grand = result.entities.reduce(
    (t, e) => ({ netSales: t.netSales + e.netSales, cogs: t.cogs + e.cogs, labor: t.labor + e.labor, operatingIncome: t.operatingIncome + e.operatingIncome }),
    { netSales: 0, cogs: 0, labor: 0, operatingIncome: 0 }
  );
  const presets = [
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_quarter", label: "This quarter" },
  ];
  const otherLocations = result.locationOptions.filter((l) => l.id !== business.id);

  return (
    <div className="max-w-3xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Consolidated books</h1>
        <p className="text-muted-foreground text-sm mt-1">Per-entity and consolidated statements across the locations you manage — {result.period}. Set each location&apos;s legal entity under Settings → Accounting basis.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <Link key={p.key} href={"/app/accounting/consolidated?period=" + p.key} className={"text-sm rounded-md px-3 py-1.5 border " + (periodKey === p.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>{p.label}</Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Net sales" value={money(grand.netSales, currency)} />
        <Stat label="COGS" value={money(grand.cogs, currency)} />
        <Stat label="Labor" value={money(grand.labor, currency)} />
        <Stat label="Operating income" value={money(grand.operatingIncome, currency)} />
      </div>

      <div className="space-y-4 mb-8">
        {result.entities.map((e) => (
          <div key={e.entity} className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">{e.entity}</span>
              <span className="text-xs text-muted-foreground">{e.locations.length} location{e.locations.length === 1 ? "" : "s"} · op. income {money(e.operatingIncome, currency)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-4 py-1.5 font-medium">Location</th>
                  <th className="px-4 py-1.5 font-medium text-right">Net sales</th>
                  <th className="px-4 py-1.5 font-medium text-right">COGS</th>
                  <th className="px-4 py-1.5 font-medium text-right">Labor</th>
                  <th className="px-4 py-1.5 font-medium text-right">Op. income</th>
                </tr>
              </thead>
              <tbody>
                {e.locations.map((l) => (
                  <tr key={l.businessId} className="border-b border-border last:border-0">
                    <td className="px-4 py-1.5">{l.name}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(l.netSales, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{money(l.cogs, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{money(l.labor, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums font-medium">{money(l.operatingIncome, currency)}</td>
                  </tr>
                ))}
                {e.locations.length > 1 && (
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-4 py-1.5">Entity total</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(e.netSales, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(e.cogs, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(e.labor, currency)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(e.operatingIncome, currency)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-1">Inter-location transfer</h2>
        <p className="text-xs text-muted-foreground mb-3">Posts a balanced due-from / due-to pair into both locations&apos; journals.</p>
        <IntercompanyForm locations={otherLocations} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
