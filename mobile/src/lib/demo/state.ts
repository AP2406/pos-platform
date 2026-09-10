// Demo restaurant mode — a switch that swaps every read (and every write) for an
// in-memory "realistic evening of service" so the app can be shown to a
// prospective restaurant without a database full of stale test rows.
//
// • Available ONLY in development builds (or when EXPO_PUBLIC_ALLOW_DEMO=1 is
//   baked into a build) — merchants never see the toggle.
// • Nothing is written to Supabase while it's on. Fires, bumps, seats, clock-ins
//   all mutate the in-memory store, so the demo feels live but leaves no trace.
// • Every timestamp is relative to the moment the store was built, so tables
//   read "8 min", not "43h", no matter when the demo is given.

declare const __DEV__: boolean;

export const DEMO_AVAILABLE: boolean = (typeof __DEV__ !== "undefined" && __DEV__) || process.env.EXPO_PUBLIC_ALLOW_DEMO === "1";

let enabled = false;
const subs = new Set<() => void>();

export function demoOn(): boolean {
  return enabled;
}

export function setDemoMode(on: boolean): void {
  const next = on && DEMO_AVAILABLE;
  if (next === enabled) return;
  enabled = next;
  for (const fn of subs) fn();
}

export function subscribeDemo(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
