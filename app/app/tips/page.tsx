import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { requirePermission } from "@/lib/services/route-access";
import { hasFloorService } from "@/lib/modules/modes";
import { getTipPoolSettings } from "./tip-actions";
import { TipsClient } from "./tips-client";

export const dynamic = "force-dynamic";

export default async function TipsPage() {
  const { business, role } = await requireBusiness();
  // Full-service only; tip pooling is payroll-adjacent, so it needs reports access.
  if (!hasFloorService(business)) redirect("/app");
  requirePermission(role, "access_reports");

  const settings = await getTipPoolSettings();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Tips</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pool a day&apos;s tips, tip out support roles, and split the rest among servers.
        </p>
      </div>
      <TipsClient initialSettings={settings} today={today} />
    </div>
  );
}
