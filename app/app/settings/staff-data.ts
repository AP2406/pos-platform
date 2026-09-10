import type { createClient } from "@/lib/supabase/server";

// The staff list, with each row's linked web login resolved.
//
// /app/staff and /app/settings both render StaffCard and were each building
// this query by hand, so adding user_id (0100) meant fixing it twice. One
// loader now, used by both.

export type StaffListRow = {
  id: string;
  name: string;
  role: string;
  role_id: string | null;
  is_active: boolean;
  has_pin: boolean;
  pay_rate: number | null;
  overrides: Record<string, boolean>;
  /** auth.users id of this person's web login, when the two are linked. */
  user_id: string | null;
  login_email: string | null;
  web_role: string | null;
};

type Db = Awaited<ReturnType<typeof createClient>>;

export async function loadStaffList(
  supabase: Db,
  businessId: string
): Promise<StaffListRow[]> {
  // Migration-resilient: permission_overrides (0070) and user_id (0100) may not
  // exist yet on an un-migrated server. Widest select first, narrowing on error.
  const fetchStaff = (cols: string) =>
    supabase
      .from("staff_members")
      .select(cols)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

  let data: Record<string, unknown>[] | null = null;
  for (const cols of [
    "id, name, role, role_id, is_active, pin_hash, pay_rate, permission_overrides, user_id",
    "id, name, role, role_id, is_active, pin_hash, pay_rate, permission_overrides",
    "id, name, role, role_id, is_active, pin_hash, pay_rate",
  ]) {
    const res = await fetchStaff(cols);
    if (!res.error) {
      data = res.data as unknown as Record<string, unknown>[] | null;
      break;
    }
  }

  const rows: StaffListRow[] = (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    role: s.role as string,
    role_id: (s.role_id as string | null) ?? null,
    is_active: s.is_active as boolean,
    has_pin: !!s.pin_hash,
    pay_rate: (s.pay_rate as number | null) ?? null,
    overrides: (s.permission_overrides ?? {}) as Record<string, boolean>,
    user_id: (s.user_id as string | null) ?? null,
    login_email: null,
    web_role: null,
  }));

  // Resolve the linked logins in one round trip, so a row can show WHO it is
  // linked to rather than just that it is.
  const linkedIds = rows.map((r) => r.user_id).filter((x): x is string => !!x);
  if (linkedIds.length === 0) return rows;

  const [{ data: profs }, { data: mems }] = await Promise.all([
    supabase.from("profiles").select("id, email").in("id", linkedIds),
    supabase
      .from("business_members")
      .select("user_id, role")
      .eq("business_id", businessId)
      .in("user_id", linkedIds),
  ]);
  const emailById = new Map((profs ?? []).map((p) => [p.id as string, (p.email as string | null) ?? null]));
  const roleById = new Map((mems ?? []).map((m) => [m.user_id as string, (m.role as string | null) ?? null]));

  return rows.map((r) =>
    r.user_id
      ? { ...r, login_email: emailById.get(r.user_id) ?? null, web_role: roleById.get(r.user_id) ?? null }
      : r
  );
}
