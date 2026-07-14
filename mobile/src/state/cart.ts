// Local cart state for the register — pure client state, NO writes. Persisting
// the check (send-to-kitchen) and charging it are on the deferred write path.

import type { LineModifier } from "../lib/modifiers";

export type DiningOption = "dine_in" | "takeout" | "delivery" | "pickup";

export type CartLine = {
  id: string; // local line id
  catalogItemId: string | null;
  variationId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  seat: number | null; // null = check-level (no seat)
  course: number; // 1..n
  note: string | null;
  // Structured modifiers chosen for this line (prices already inside unitPrice).
  modifiers: LineModifier[] | null;
  // Customized lines (variation/modifiers/note) never merge with a plain tap-add.
  customized: boolean;
  // How many of this line have already been fired to the kitchen (coursing).
  firedQty: number;
};

// Full line spec for a customized add (from the modifier sheet).
export type LineSpec = {
  catalogItemId: string | null;
  variationId?: string | null;
  name: string;
  unitPrice: number;
  note?: string | null;
  modifiers?: LineModifier[] | null;
  course?: number;
};

export type CartState = {
  lines: CartLine[];
  activeSeat: number | null;
  diningOption: DiningOption;
  seq: number; // monotonic id source (deterministic — no Date.now/random)
};

export const initialCart: CartState = {
  lines: [],
  activeSeat: null,
  diningOption: "dine_in",
  seq: 1,
};

export type CartAction =
  | { type: "ADD"; item: { catalogItemId: string | null; name: string; unitPrice: number }; course?: number }
  | { type: "ADD_LINE"; spec: LineSpec }
  | { type: "REPLACE_LINE"; id: string; spec: LineSpec }
  | { type: "INC"; id: string }
  | { type: "DEC"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "SET_ACTIVE_SEAT"; seat: number | null }
  | { type: "SET_LINE_SEAT"; id: string; seat: number | null }
  | { type: "SET_LINE_COURSE"; id: string; course: number }
  | { type: "SET_NOTE"; id: string; note: string | null }
  | { type: "SET_DINING"; option: DiningOption }
  | { type: "MARK_FIRED"; ids: string[] }
  | { type: "LOAD"; lines: Omit<CartLine, "id">[] }
  | { type: "CLEAR" };

// Defaults for the fields a plain tap-add doesn't set.
function baseLine(): Pick<CartLine, "variationId" | "modifiers" | "customized" | "firedQty" | "note"> {
  return { variationId: null, modifiers: null, customized: false, firedQty: 0, note: null };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const seat = state.activeSeat;
      const course = action.course ?? 1;
      // Merge into an identical unmodified line on the same seat + course.
      const existing = state.lines.find(
        (l) =>
          l.catalogItemId === action.item.catalogItemId &&
          l.unitPrice === action.item.unitPrice &&
          l.seat === seat &&
          l.course === course &&
          !l.note &&
          !l.customized
      );
      if (existing) {
        return { ...state, lines: state.lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)) };
      }
      const id = "l" + state.seq;
      return {
        ...state,
        seq: state.seq + 1,
        lines: [...state.lines, { ...baseLine(), id, catalogItemId: action.item.catalogItemId, name: action.item.name, unitPrice: action.item.unitPrice, quantity: 1, seat, course }],
      };
    }
    case "ADD_LINE": {
      // Customized add (from the modifier sheet): always its own line, never merged.
      const id = "l" + state.seq;
      const sp = action.spec;
      return {
        ...state,
        seq: state.seq + 1,
        lines: [
          ...state.lines,
          { ...baseLine(), id, catalogItemId: sp.catalogItemId, variationId: sp.variationId ?? null, name: sp.name, unitPrice: sp.unitPrice, quantity: 1, seat: state.activeSeat, course: sp.course ?? 1, note: sp.note ?? null, modifiers: sp.modifiers ?? null, customized: true },
        ],
      };
    }
    case "REPLACE_LINE": {
      const sp = action.spec;
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.id ? { ...l, catalogItemId: sp.catalogItemId, variationId: sp.variationId ?? null, name: sp.name, unitPrice: sp.unitPrice, note: sp.note ?? null, modifiers: sp.modifiers ?? null, customized: true, course: sp.course ?? l.course } : l
        ),
      };
    }
    case "INC":
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, quantity: l.quantity + 1 } : l)) };
    case "DEC":
      // Never below what's already fired to the kitchen (can't un-fire); 0 removes.
      return {
        ...state,
        lines: state.lines.flatMap((l) => {
          if (l.id !== action.id) return [l];
          const floor = Math.max(0, l.firedQty);
          if (l.quantity - 1 <= 0 && floor === 0) return [];
          return [{ ...l, quantity: Math.max(Math.max(1, floor), l.quantity - 1) }];
        }),
      };
    case "REMOVE":
      // A fired line can't be removed here (use Void post-charge); guard it.
      return { ...state, lines: state.lines.filter((l) => l.id !== action.id || l.firedQty > 0) };
    case "MARK_FIRED":
      return { ...state, lines: state.lines.map((l) => (action.ids.includes(l.id) ? { ...l, firedQty: l.quantity } : l)) };
    case "SET_ACTIVE_SEAT":
      return { ...state, activeSeat: action.seat };
    case "SET_LINE_SEAT":
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, seat: action.seat } : l)) };
    case "SET_LINE_COURSE":
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, course: action.course } : l)) };
    case "SET_NOTE":
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, note: action.note } : l)) };
    case "SET_DINING":
      return { ...state, diningOption: action.option };
    case "LOAD": {
      let seq = state.seq;
      const lines: CartLine[] = action.lines.map((l) => ({ ...l, id: "l" + seq++ }));
      return { ...state, lines, seq };
    }
    case "CLEAR":
      return { ...initialCart, diningOption: state.diningOption, seq: state.seq };
    default:
      return state;
  }
}

export function cartSubtotal(state: CartState): number {
  return Math.round(state.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;
}

// Distinct seats present (for the seat rail), plus whether any line is check-level.
export function cartSeats(state: CartState): number[] {
  const seats = new Set<number>();
  for (const l of state.lines) if (l.seat != null) seats.add(l.seat);
  return Array.from(seats).sort((a, b) => a - b);
}
