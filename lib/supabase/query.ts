// Making a failed Supabase query impossible to miss.
//
// PostgREST answers a bad query with `{ data: null, error }` — no throw. So
// `const { data } = await supabase.from("orders").select("...")` compiles,
// runs, and hands back null, and a page that does `data ?? []` renders a
// perfectly calm empty screen. That is exactly how the Orders hub came to show
// zero orders for a table holding hundreds: it selected `dining_option`, which
// isn't a column, and nobody ever saw the error.
//
// The instinct is to make every call site `if (error) throw`. That is wrong
// here for two reasons:
//
//   1. This is a point of sale. Throwing inside a server component blanks the
//      whole route, so a failed *secondary* lookup (customer names, say) would
//      take down the Orders screen instead of merely dropping a column.
//   2. Several loaders swallow errors ON PURPOSE — they try the widest select
//      first and narrow it when a column from an unapplied migration is
//      missing. Throwing would break the fallback that keeps an un-migrated
//      server working.
//
// So: two helpers, and the choice is about how much of the page depends on it.
//
//   must()  — the query the page IS. No rows means broken, not empty; fail loud.
//   soft()  — an enrichment. Degrade, but never in silence.

type Result<T> = { data: T | null; error: { message: string; details?: string | null; code?: string } | null };

/**
 * The page's primary query. Throws on failure so the Next.js error boundary
 * shows it, instead of rendering a convincing empty state.
 *
 * ```ts
 * const orders = must("orders hub", await supabase.from("orders").select(...));
 * ```
 */
export function must<T>(label: string, res: Result<T>): T {
  if (res.error) {
    const e = res.error;
    console.error("[query] " + label + " failed:", e.message, e.details ?? "", e.code ?? "");
    throw new Error("Couldn't load " + label + ": " + e.message);
  }
  return (res.data ?? []) as T;
}

/**
 * A secondary/enrichment query. Returns `fallback` on failure and always logs,
 * so the page still renders but the failure is visible in the server log.
 *
 * ```ts
 * const custs = soft("orders hub → customers", await supabase.from(...), []);
 * ```
 */
export function soft<T>(label: string, res: Result<T>, fallback: T): T {
  if (res.error) {
    const e = res.error;
    console.error("[query] " + label + " degraded:", e.message, e.details ?? "", e.code ?? "");
    return fallback;
  }
  return res.data ?? fallback;
}

/**
 * For the deliberate widest-select-then-narrow pattern: try each select in
 * order, take the first that succeeds, and log if any had to be skipped. Keeps
 * un-migrated servers working while making the fallback audible.
 *
 * ```ts
 * const rows = await widest("staff list", [
 *   () => q("id, name, user_id"),
 *   () => q("id, name"),
 * ]);
 * ```
 */
export async function widest<T>(
  label: string,
  attempts: (() => Promise<Result<T>>)[],
  fallback: T
): Promise<T> {
  for (let i = 0; i < attempts.length; i++) {
    const res = await attempts[i]();
    if (!res.error) {
      if (i > 0) console.warn("[query] " + label + ": fell back to select #" + (i + 1) + " (older schema)");
      return res.data ?? fallback;
    }
    if (i === attempts.length - 1) {
      console.error("[query] " + label + ": every select failed:", res.error.message);
    }
  }
  return fallback;
}
