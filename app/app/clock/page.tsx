import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { listOnShift } from "./time-actions";
import { ClockClient } from "./clock-client";

export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const { business } = await requireBusiness();
  if (!hasFloorService(business)) redirect("/app");

  const onShift = await listOnShift();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Time clock</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Staff clock in and out with their PIN.
        </p>
      </div>
      <ClockClient initialOnShift={onShift} />
    </div>
  );
}
