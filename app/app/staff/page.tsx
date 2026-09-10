import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { StaffCard } from "../settings/staff-card";
import { RolesCard } from "../settings/roles-card";
import { listRoles } from "../settings/roles-actions";
import { loadStaffList } from "../settings/staff-data";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

// The sidebar links "Staff" here; staff (and their PINs) are owner/manager-managed.
export default async function StaffPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "edit_staff");

  const supabase = await createClient();
  const staffList = await loadStaffList(supabase, business.id);
  const rolesList = await listRoles();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Team members and the PINs they use at the register.
        </p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <StaffCard
          initialStaff={staffList}
          roles={rolesList.map((r) => ({ id: r.id, name: r.name, key: r.key, permissions: r.permissions }))}
        />
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Roles &amp; permissions</h2>
        <RolesCard initialRoles={rolesList} />
      </div>
    </div>
  );
}
