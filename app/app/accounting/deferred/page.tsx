import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { listDeferred, giftBreakageInfo } from "./actions";
import { DeferredClient } from "./deferred-client";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function DeferredPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "access_reports");
  if (!hasFloorService(business)) redirect("/app/reports");

  const [rows, breakage] = await Promise.all([listDeferred(), giftBreakageInfo()]);
  const currency = (business.currency || "USD").toUpperCase();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <div className="max-w-3xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Deferred revenue &amp; breakage</h1>
        <p className="text-muted-foreground text-sm mt-1">Hold deposits/catering as a liability and release to revenue on the event date; recognize aged gift-card breakage. Each action posts a balanced journal entry.</p>
      </div>
      <DeferredClient rows={rows} breakage={breakage} currency={currency} today={today} />
    </div>
  );
}
