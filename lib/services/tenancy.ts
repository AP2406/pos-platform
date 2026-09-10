import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ACTIVE_BUSINESS_COOKIE = "surge_active_business";

// A business is blocked from using the app ONLY if its access_status is one of
// these. Anything else (including "active", null, or an unexpected value) is
// allowed through, so an existing/paying merchant can never be locked out by a
// missing or unrecognized value.
export const BLOCKED_ACCESS_STATUSES = ["suspended", "past_due"];

export type IndustryType =
  | "transportation"
  | "restaurant"
  | "retail"
  | "service"
  | "mobile_seller";

export type MemberRole =
  | "owner"
  | "manager"
  | "shift_lead"
  | "bookkeeper"
  | "staff"
  | "trainee";

export type BusinessContext = {
  role: MemberRole;
  business: {
    id: string;
    name: string;
    industry: IndustryType;
    currency: string;
    default_tax_rate: number;
    timezone: string;
    drivers_enabled: boolean;
    access_status?: string;
    // True for sandbox/demo businesses: fully usable for taking orders but
    // locked against any config change and unable to process real money.
    is_demo?: boolean;
    training_mode?: boolean;
    // Stored onboarding config (modules + mode). Present at runtime because
    // getCurrentBusiness selects businesses(*); typed here so mode-gated
    // features (e.g. full-service floor) can read business.config.mode.
    config?: { mode?: string } | null;
  };
};

export const DEMO_LOCKED_MESSAGE =
  "This is a demo account — the menu, floor plan and settings are locked.";

/**
 * Thrown by config-mutation server actions when invoked on a demo business.
 * The UI also disables the relevant controls, so this is a server-side
 * backstop that guarantees no demo config write ever lands.
 */
export class DemoLockedError extends Error {
  constructor() {
    super(DEMO_LOCKED_MESSAGE);
    this.name = "DemoLockedError";
  }
}

/**
 * Guards every business-configuration write (menu, floor, settings, staff).
 * No-op for real businesses; throws for demo/sandbox businesses.
 */
export function assertConfigEditable(business: { is_demo?: boolean }): void {
  if (business.is_demo) throw new DemoLockedError();
}

export type BusinessSummary = {
  id: string;
  name: string;
  industry: IndustryType;
  role: MemberRole;
  mode: string | null;
};

/**
 * Requires the user to be signed in. Redirects to /login if not.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Every business the current user belongs to, oldest first. Used by the
 * workspace switcher.
 */
export async function listBusinesses(): Promise<BusinessSummary[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_members")
    .select("role, business:businesses(id, name, industry, config)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("listBusinesses:", error);
    return [];
  }

  const out: BusinessSummary[] = [];
  for (const row of data) {
    const b = (Array.isArray(row.business) ? row.business[0] : row.business) as
      | { id: string; name: string; industry: string; config?: unknown }
      | null
      | undefined;
    if (!b) continue;

    let mode: string | null = null;
    if (b.config && typeof b.config === "object") {
      const c = b.config as { mode?: unknown };
      if (typeof c.mode === "string") mode = c.mode;
    }

    out.push({
      id: b.id,
      name: b.name,
      industry: b.industry as IndustryType,
      role: row.role as MemberRole,
      mode,
    });
  }
  return out;
}

/**
 * Returns the user's ACTIVE business. If an active-business cookie is set and
 * the user is a member of that business, it wins; otherwise it falls back to
 * the first business they joined (identical to the previous one-business
 * behavior, so nothing changes for existing single-business logins).
 */
export async function getCurrentBusiness(): Promise<BusinessContext | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getCurrentBusiness:", error);
    return null;
  }
  if (!data || data.length === 0) {
    // Demo users are provisioned in the Supabase dashboard and flagged via
    // app_metadata.demo. On first sign-in they have no membership yet, so we
    // auto-join the shared demo business (RPC is SECURITY DEFINER + verifies
    // the admin-set JWT claim, so it can't be abused).
    const isDemoUser =
      (user.app_metadata as { demo?: boolean } | undefined)?.demo === true;
    if (isDemoUser) {
      const { data: joinedId } = await supabase.rpc("join_demo_business");
      if (joinedId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", joinedId as string)
          .single();
        if (biz) {
          return {
            role: "manager",
            business: biz as BusinessContext["business"],
          };
        }
      }
    }
    return null;
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  let chosen = data[0];
  if (activeId) {
    const match = data.find((row) => {
      const b = Array.isArray(row.business) ? row.business[0] : row.business;
      return b && b.id === activeId;
    });
    if (match) chosen = match;
  }

  const biz = Array.isArray(chosen.business)
    ? chosen.business[0]
    : chosen.business;
  if (!biz) return null;

  return {
    role: chosen.role as MemberRole,
    business: biz as BusinessContext["business"],
  };
}

/**
 * True if a business's access_status puts it in a blocked state. A missing or
 * unrecognized status is treated as allowed (never block by default).
 */
export function isBusinessBlocked(accessStatus: string | null | undefined): boolean {
  const status = accessStatus || "active";
  return BLOCKED_ACCESS_STATUSES.indexOf(status) !== -1;
}

/**
 * Same as getCurrentBusiness but redirects to /onboarding if they don't have
 * one, and to /account-paused if the business has been suspended or is past
 * due. This is the single chokepoint that gates every protected page and
 * server action, so a blocked merchant can neither load the app nor transact.
 */
export async function requireBusiness(): Promise<BusinessContext> {
  const ctx = await getCurrentBusiness();
  if (!ctx) redirect("/onboarding");
  if (isBusinessBlocked(ctx.business.access_status)) {
    redirect("/account-paused");
  }
  return ctx;
}