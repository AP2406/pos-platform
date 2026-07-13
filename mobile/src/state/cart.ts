// Local cart state for the register — pure client state, NO writes. Persisting
// the check (send-to-kitchen) and charging it are on the deferred write path.

export type DiningOption = "dine_in" | "takeout" | "delivery" | "pickup";

export type CartLine = {
  id: string; // local line id
  catalogItemId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  seat: number | null; // null = check-level (no seat)
  course: number; // 1..n
  note: string | null;
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
  | { type: "INC"; id: string }
  | { type: "DEC"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "SET_ACTIVE_SEAT"; seat: number | null }
  | { type: "SET_LINE_SEAT"; id: string; seat: number | null }
  | { type: "SET_LINE_COURSE"; id: string; course: number }
  | { type: "SET_NOTE"; id: string; note: string | null }
  | { type: "SET_DINING"; option: DiningOption }
  | { type: "LOAD"; lines: Omit<CartLine, "id">[] }
  | { type: "CLEAR" };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const seat = state.activeSeat;
      const course = action.course ?? 1;
      // Merge into an identical line on the same seat + course (unmodified items).
      const existing = state.lines.find(
        (l) =>
          l.catalogItemId === action.item.catalogItemId &&
          l.unitPrice === action.item.unitPrice &&
          l.seat === seat &&
          l.course === course &&
          !l.note
      );
      if (existing) {
        return { ...state, lines: state.lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)) };
      }
      const id = "l" + state.seq;
      return {
        ...state,
        seq: state.seq + 1,
        lines: [...state.lines, { id, catalogItemId: action.item.catalogItemId, name: action.item.name, unitPrice: action.item.unitPrice, quantity: 1, seat, course, note: null }],
      };
    }
    case "INC":
      return { ...state, lines: state.lines.map((l) => (l.id === action.id ? { ...l, quantity: l.quantity + 1 } : l)) };
    case "DEC":
      return {
        ...state,
        lines: state.lines.flatMap((l) => (l.id === action.id ? (l.quantity <= 1 ? [] : [{ ...l, quantity: l.quantity - 1 }]) : [l])),
      };
    case "REMOVE":
      return { ...state, lines: state.lines.filter((l) => l.id !== action.id) };
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
