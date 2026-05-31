import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type IndustryType =
  | "transportation"
  | "restaurant"
  | "retail"
  | "service"
  | "mobile_seller";

export type MemberRole = "owner" | "manager" | "staff" | "trainee";

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
  };
};

/**
 * Requires the user to be signed in. Redirects to /login if not.
 * Returns the auth user.
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
 * Returns the user's primary business (the first one they're a member of),
 * or null if they don't belong to any yet.
 *
 * MVP assumption: one user = one business. A business switcher comes later.
 */
export async function getCurrentBusiness(): Promise<BusinessContext | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentBusiness:", error);
    return null;
  }

  if (!data || !data.business) return null;

  return {
    role: data.role as MemberRole,
    // Supabase returns nested select as object for single() / array otherwise.
    // The cast below handles either shape safely.
    business: (Array.isArray(data.business)
      ? data.business[0]
      : data.business) as BusinessContext["business"],
  };
}

/**
 * Same as getCurrentBusiness but redirects to /onboarding if they don't have one.
 * Use this in any page under /app where a business is required.
 */
export async function requireBusiness(): Promise<BusinessContext> {
  const ctx = await getCurrentBusiness();
  if (!ctx) redirect("/onboarding");
  return ctx;
}