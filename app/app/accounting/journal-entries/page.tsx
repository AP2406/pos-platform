import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { listJournalEntries, listJournalTemplates } from "./actions";
import { resolveCoa, COA_DEFAULTS, type CoaKey } from "../journal";
import { JournalClient } from "./journal-client";

export const dynamic = "force-dynamic";

export default async function JournalEntriesPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const [entries, templates] = await Promise.all([listJournalEntries(), listJournalTemplates()]);
  const coa = resolveCoa((business as { settings?: unknown }).settings);
  const accounts = (Object.keys(COA_DEFAULTS) as CoaKey[]).map((k) => ({ name: coa[k].name, code: coa[k].code }));
  const currency = (business.currency || "USD").toUpperCase();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <div className="max-w-3xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Journal entries</h1>
        <p className="text-muted-foreground text-sm mt-1">Post manual double-entry adjustments (rent, prepaids, amortization, payroll cutoff). Save recurring ones as templates; auto-reverse books the flip on the 1st of next month.</p>
      </div>
      <JournalClient entries={entries} templates={templates} accounts={accounts} currency={currency} today={today} />
    </div>
  );
}
