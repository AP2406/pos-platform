import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { listDeposits, listUndepositedDays } from "../deposit-actions";
import { DepositsClient } from "./deposits-client";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const [deposits, undeposited] = await Promise.all([listDeposits(), listUndepositedDays()]);
  const currency = (business.currency || "USD").toUpperCase();

  return (
    <div className="max-w-3xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Bank deposits</h1>
        <p className="text-muted-foreground text-sm mt-1">Record the cash deposited to the bank against each day&apos;s Z-report and reconcile against your statement. Variances are flagged.</p>
      </div>
      <DepositsClient deposits={deposits} undeposited={undeposited} currency={currency} />
    </div>
  );
}
