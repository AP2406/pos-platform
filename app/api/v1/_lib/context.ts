import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { API_HEADERS, type ApiError } from "@surge/api-contracts";

// Shared request context for every /api/v1 route. Unlike the web (which resolves
// the tenant from the `surge_active_business` cookie), the native client is
// stateless: it sends a Supabase access token + the active business/staff as
// headers. This resolver verifies all three and returns a user-scoped Supabase
// client (RLS applies as that user). No cookies, no money logic — a pure gate.

export type ApiContext = {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null;
  businessId: string;
  businessName: string;
  // The acting POS-PIN identity (attribution + approvals). Null on an unstaffed till.
  staff: { id: string; name: string; role: string } | null;
};

export type ApiContextResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: NextResponse };

function fail(code: ApiError["error"]["code"], message: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error: { code, message } } satisfies ApiError, { status }) };
}

export async function resolveApiContext(req: Request): Promise<ApiContextResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return fail("server_error", "Supabase is not configured.", 500);

  // 1) Bearer token → user (RLS-scoped client, no session persistence).
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return fail("unauthenticated", "Missing bearer token.", 401);

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return fail("unauthenticated", "Invalid or expired token.", 401);
  const user = userData.user;

  // 2) Active business (header) → verified membership.
  const businessId = req.headers.get(API_HEADERS.business) || "";
  if (!businessId) return fail("bad_request", `Missing ${API_HEADERS.business} header.`, 400);

  const { data: member } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return fail("forbidden", "You are not a member of this business.", 403);

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return fail("not_found", "Business not found.", 404);

  // 3) Acting staff (optional header) → verified active for this business.
  let staff: ApiContext["staff"] = null;
  const staffId = req.headers.get(API_HEADERS.staff) || "";
  if (staffId) {
    const { data: sm } = await supabase
      .from("staff_members")
      .select("id, name, role, is_active")
      .eq("id", staffId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!sm || sm.is_active === false) {
      return fail("forbidden", "Acting staff is not active for this business.", 403);
    }
    staff = { id: sm.id as string, name: sm.name as string, role: (sm.role as string) || "staff" };
  }

  return {
    ok: true,
    ctx: {
      supabase: supabase as unknown as SupabaseClient,
      userId: user.id,
      userEmail: user.email ?? null,
      businessId: biz.id as string,
      businessName: (biz.name as string) || "",
      staff,
    },
  };
}
