import type { ServiceStage } from "@surge/design-tokens";
import type { KitchenTicket } from "./reads";

// Floor v2 service lifecycle — derived from the open ticket + its kitchen tickets,
// correlated by element_id. Reads-only; no money paths touched.

export type KitchenState = { open: number; done: number };

// Per-table kitchen state keyed by element_id. `open` = fired tickets not yet
// bumped; `done` = bumped tickets still within the KDS window (fetchKitchenTickets
// keeps fulfilled tickets ~30 min, so a table reads "Ready" after the last bump).
export function kitchenStateByElement(tickets: KitchenTicket[]): Record<string, KitchenState> {
  const m: Record<string, KitchenState> = {};
  for (const t of tickets) {
    if (!t.elementId) continue;
    const s = (m[t.elementId] ||= { open: 0, done: 0 });
    if (t.fulfilledAt) s.done++;
    else s.open++;
  }
  return m;
}

export type Occupancy = { checkDropped: boolean; elementId: string | null };

// Service stage for an OCCUPIED check (the caller returns "available" when there
// is no open ticket at all). Both the tile text and its color derive from this.
// A non-table check (elementId null) can only be resolved to open/pay — its
// kitchen tickets don't carry a per-check key to correlate Sent/Ready.
export function serviceStage(o: Occupancy, kstate: Record<string, KitchenState>): ServiceStage {
  if (o.checkDropped) return "pay";
  const k = o.elementId ? kstate[o.elementId] : undefined;
  if (k && k.open > 0) return "sent"; // something's still cooking
  if (k && k.open === 0 && k.done > 0) return "ready"; // all fired tickets bumped
  return "open"; // seated / building, nothing fired yet
}
