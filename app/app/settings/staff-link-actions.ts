"use server";

// Linking a PIN identity to a web login.
//
// A person working here can exist twice: a staff_members row (their PIN at the
// till) and a business_members row (their email login to the dashboard).
// Migration 0100 added staff_members.user_id to join them; this is what
// populates it.
//
// Why it matters:
//   • Attribution — a void approved by PIN on the iPad and one approved from
//     the dashboard resolve to the same person instead of two unrelated rows.
//   • Permissions — per-person overrides and comp/discount caps live on the
//     staff record, so linking lets them reach the web too.
//   • No guessing — systemRoleForLegacy() infers a matrix role from the legacy
//     enum. A real link removes the inference for anyone who has one.
//
// Linking is optional by design: a line cook who only taps a PIN never needs a
// web account, and their user_id stays null.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { canAccess } from "@/lib/services/route-access";
import { ASSIGNABLE_WEB_ROLES, type WebRole } from "@/lib/services/route-access";
import { revalidatePath } from "next/cache";

export type LinkResult =
  | { ok: true; userId: string; email: string; invited: boolean }
  | { error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Give a staff member web dashboard access, and record that the two identities
 * are the same person.
 *
 * Resolution order for the account:
 *   1. An existing profile with this email (they already have a Surge login).
 *   2. Otherwise invite one. Note `auth.admin.listUsers` 500s on this project,
 *      so the lookup goes through public.profiles, which the
 *      on_auth_user_created trigger keeps in sync.
 */
export async function linkStaffToWebAccount(
  staffId: string,
  email: string,
  webRole: WebRole
): Promise<LinkResult> {
  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
  if (!canAccess(myRole, "edit_staff")) {
    return { error: "Only an owner or manager can grant dashboard access." };
  }
  // Nobody may hand out a role they don't hold themselves, or an owner seat.
  if (!ASSIGNABLE_WEB_ROLES.includes(webRole)) {
    return { error: "Choose an access level." };
  }
  if (webRole === "manager" && myRole !== "owner" && myRole !== "manager") {
    return { error: "Only an owner or manager can grant manager access." };
  }

  const clean = (email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return { error: "Enter a valid email address." };
  if (!staffId) return { error: "Missing staff member." };

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, name, user_id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staff) return { error: "Staff member not found." };
  if (staff.user_id) return { error: "This person is already linked to a login." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Dashboard invites aren't configured on this server." };
  }

  // 1. Do they already have a Surge login?
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", clean)
    .maybeSingle();

  let userId = existing ? (existing.id as string) : null;
  let invited = false;

  // 2. If not, invite them.
  if (!userId) {
    const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(clean, {
      data: { full_name: staff.name as string },
    });
    if (invErr || !inv?.user) {
      const msg = (invErr?.message || "").toLowerCase();
      if (msg.includes("already") && msg.includes("registered")) {
        return { error: "That email already has an account, but it couldn't be found. Ask them to sign in once, then link again." };
      }
      // Most often: no SMTP configured, or the invite rate limit.
      console.error("linkStaffToWebAccount invite:", invErr);
      return { error: "Couldn't send the invitation. Check email delivery is set up, then try again." };
    }
    userId = inv.user.id;
    invited = true;
  }

  // 3. Membership — the row that actually grants dashboard access.
  const { error: memErr } = await admin
    .from("business_members")
    .upsert({ business_id: business.id, user_id: userId, role: webRole }, { onConflict: "business_id,user_id" });
  if (memErr) {
    console.error("linkStaffToWebAccount membership:", memErr);
    return { error: "Couldn't grant dashboard access. Please try again." };
  }

  // 4. The link itself. The partial unique index on (business_id, user_id)
  //    stops the same login being attached to two PIN identities here.
  const { error: linkErr } = await supabase
    .from("staff_members")
    .update({ user_id: userId })
    .eq("id", staffId)
    .eq("business_id", business.id);
  if (linkErr) {
    console.error("linkStaffToWebAccount link:", linkErr);
    if ((linkErr as { code?: string }).code === "23505") {
      return { error: "That login is already linked to another staff member here." };
    }
    return { error: "Couldn't link the accounts. Please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/staff");
  return { ok: true, userId, email: clean, invited };
}

/**
 * Remove dashboard access and the identity link. The PIN identity and its
 * history are untouched — this is "they no longer use the dashboard", not
 * "they left".
 */
export async function unlinkStaffWebAccount(
  staffId: string,
  opts: { revokeAccess?: boolean } = {}
): Promise<{ ok: true } | { error: string }> {
  const { business, role: myRole } = await requireBusiness();
  assertConfigEditable(business);
  if (!canAccess(myRole, "edit_staff")) {
    return { error: "Only an owner or manager can change dashboard access." };
  }

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, user_id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staff) return { error: "Staff member not found." };
  if (!staff.user_id) return { ok: true };

  const userId = staff.user_id as string;

  if (opts.revokeAccess) {
    // Never strip the last owner's membership — that would orphan the business.
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "Not configured to change dashboard access on this server." };
    }
    const { data: owners } = await admin
      .from("business_members")
      .select("user_id")
      .eq("business_id", business.id)
      .eq("role", "owner");
    const isLastOwner =
      (owners ?? []).length === 1 && (owners ?? [])[0]?.user_id === userId;
    if (isLastOwner) {
      return { error: "This is the only owner. Add another owner before removing access." };
    }
    await admin
      .from("business_members")
      .delete()
      .eq("business_id", business.id)
      .eq("user_id", userId);
  }

  const { error } = await supabase
    .from("staff_members")
    .update({ user_id: null })
    .eq("id", staffId)
    .eq("business_id", business.id);
  if (error) {
    console.error("unlinkStaffWebAccount:", error);
    return { error: "Couldn't unlink. Please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/staff");
  return { ok: true };
}
