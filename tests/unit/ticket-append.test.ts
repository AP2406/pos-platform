import { describe, it, expect } from "vitest";
import { appendLineToTable } from "../../lib/services/ticket-append";

// Move-item core: append a line to a destination table's open check (create if
// absent). Money-independent (no kitchen ticket, no tender). Mocks the supabase
// query builder used by the core.

function mockSb(opts: { existing?: unknown; insertId?: string; updateError?: unknown }) {
  const calls: { insert?: Record<string, unknown>; update?: Record<string, unknown> } = {};
  const builder = () => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      is: () => b,
      insert: (p: Record<string, unknown>) => {
        calls.insert = p;
        return b;
      },
      update: (p: Record<string, unknown>) => {
        calls.update = p;
        return b;
      },
      maybeSingle: () => Promise.resolve({ data: opts.existing ?? null }),
      single: () => Promise.resolve({ data: opts.insertId ? { id: opts.insertId } : null, error: null }),
      // update().eq().eq() is awaited directly → make the builder thenable.
      then: (res: (v: { error: unknown }) => unknown) => Promise.resolve({ error: opts.updateError ?? null }).then(res),
    });
    return b;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { sb: { from: () => builder() } as any, calls };
}

const item = { catalog_item_id: "c1", name: "Fries", unit_price: 5, quantity: 1, note: null, seat: 2 };
const args = (over = {}) => ({ businessId: "b", staffId: "s", elementId: "e-dest", label: "Table 5", item, ...over });

describe("appendLineToTable", () => {
  it("appends to an existing open check, keeping prior items, marking the moved item unfired", async () => {
    const { sb, calls } = mockSb({ existing: { id: "t1", cart: { items: [{ name: "Cola" }] }, parent_ticket_id: null } });
    const res = await appendLineToTable(sb, args());
    expect(res).toEqual({ ticketId: "t1" });
    const items = (calls.update?.cart as { items: Record<string, unknown>[] }).items;
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ name: "Fries", quantity: 1, sent_qty: 0, seat: 2 });
  });

  it("opens a new check when the table has none", async () => {
    const { sb, calls } = mockSb({ existing: null, insertId: "new-1" });
    const res = await appendLineToTable(sb, args());
    expect(res).toEqual({ ticketId: "new-1" });
    expect(calls.insert).toMatchObject({ element_id: "e-dest", ticket_type: "table", label: "Table 5" });
    expect((calls.insert?.cart as { items: unknown[] }).items).toHaveLength(1);
  });

  it("refuses a split check", async () => {
    const { sb } = mockSb({ existing: { id: "t2", cart: { items: [] }, parent_ticket_id: "parent" } });
    expect(await appendLineToTable(sb, args())).toEqual({ error: "Can't move into a split check." });
  });

  it("validates input", async () => {
    const { sb } = mockSb({});
    expect(await appendLineToTable(sb, args({ elementId: "" }))).toHaveProperty("error");
    expect(await appendLineToTable(sb, args({ item: { ...item, quantity: 0 } }))).toHaveProperty("error");
  });
});
