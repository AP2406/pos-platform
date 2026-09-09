import { requireBusiness } from "@/lib/services/tenancy";
import { listPendingApprovals } from "./actions";
import { ApprovalsClient } from "./approvals-client";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { role } = await requireBusiness();
  requirePermission(role, "void");
  const initial = await listPendingApprovals();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pending requests from the floor. Approve to apply, deny to dismiss.
        </p>
      </div>
      <ApprovalsClient initial={initial} />
    </div>
  );
}
