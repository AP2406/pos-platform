import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { StaffCard } from "../settings/staff-card";

export const dynamic = "force-dynamic";

// The sidebar links "Staff" here; staff (and their PINs) are owner/manager-managed.
export default async function StaffPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active, pin_hash")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });
  const staffList = (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    role: s.role as string,
    is_active: s.is_active as boolean,
    has_pin: !!s.pin_hash,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Team members and the PINs they use at the register.
        </p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <StaffCard initialStaff={staffList} />
      </div>
    </div>
  );
}
