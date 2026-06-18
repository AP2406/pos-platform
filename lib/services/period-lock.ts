import type { createClient } from "@/lib/supabase/server";

// Fiscal-period lock: once a period is closed, sales dated on/before the lock
// boundary can't be voided/reopened/adjusted. No lock = no effect.

export async function lockedThrough(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("period_locks")
    .select("locked_through")
    .eq("business_id", businessId)
    .order("locked_through", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.locked_through as string) : null;
}

// YYYY-MM-DD of an instant in the business timezone.
function bizDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function dateIsLocked(
  lockedThroughDate: string | null,
  createdAtIso: string,
  tz: string
): boolean {
  if (!lockedThroughDate) return false;
  return bizDate(createdAtIso, tz) <= lockedThroughDate; // lexical compare of YYYY-MM-DD
}

// True when the order's business-day falls in a locked period.
export async function isOrderPeriodLocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  createdAtIso: string,
  tz: string
): Promise<boolean> {
  const lt = await lockedThrough(supabase, businessId);
  return dateIsLocked(lt, createdAtIso, tz);
}
