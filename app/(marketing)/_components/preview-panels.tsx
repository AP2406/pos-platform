// THE FOUR POS SCREENS SHOWN INSIDE THE PRODUCT-PREVIEW FRAMES.
//
// All four are ordinary markup. None is an image, none contains money, and
// none performs a calculation: the handoff is explicit that generated UI
// "should not dictate exact amounts, calculations or data", and the launch
// rules forbid a published rate or a fabricated total anywhere on the site. So
// these carry table numbers, covers, ticket ages and item names — the things a
// floor actually looks at — and nothing a merchant could read as an offer.
//
// STATUS IS NEVER COLOUR ALONE. Every coloured state below is paired with a
// word: "In progress", "Pending", "Over target", "Ready". The mockup marks a
// late ticket with a red 6m and nothing else; that is the one thing in these
// panels that had to change to be legible to a reader who cannot see the red.

type Table = { id: string; covers: number; elapsed?: string; state: "open" | "seated" | "free" };

// Illustrative floor. Twelve tables, one seated and timed, matching the
// composition in 01-home.jpg.
const TABLES: Table[] = [
  { id: "T1", covers: 2, state: "free" },
  { id: "T2", covers: 4, state: "free" },
  { id: "T3", covers: 4, elapsed: "12m", state: "seated" },
  { id: "T4", covers: 2, state: "free" },
  { id: "T5", covers: 4, state: "free" },
  { id: "T6", covers: 2, state: "free" },
  { id: "T7", covers: 4, state: "free" },
  { id: "T8", covers: 4, state: "free" },
  { id: "T9", covers: 2, state: "free" },
  { id: "T10", covers: 4, state: "free" },
  { id: "T11", covers: 4, state: "free" },
  { id: "T12", covers: 2, state: "free" },
];

const AREAS = ["All", "Dining", "Patio", "Bar"];

function PanelHeader({ title, trailing }: { title: string; trailing: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <span className="text-[length:var(--surge-h4)] font-bold">{title}</span>
      <span className="inline-flex items-center gap-1.5 rounded-[var(--surge-radius-control)] border border-[var(--surge-border)] px-2.5 py-1.5 text-[length:var(--surge-micro)] font-semibold text-[var(--surge-muted)]">
        {trailing}
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </span>
    </div>
  );
}

export function FloorPlanPanel() {
  return (
    <div>
      <PanelHeader title="Floor plan" trailing="Main Dining" />
      <div className="flex flex-wrap gap-4 border-b border-[var(--surge-border)] pb-2 text-[length:var(--surge-micro)]">
        {AREAS.map((a, i) => (
          <span
            key={a}
            className={
              i === 0
                ? "border-b-2 border-[var(--surge-action)] pb-1.5 font-bold text-[var(--surge-ink)]"
                : "pb-1.5 font-semibold text-[var(--surge-muted)]"
            }
          >
            {a}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TABLES.map((t) => {
          const seated = t.state === "seated";
          return (
            <div
              key={t.id}
              className={
                "rounded-[var(--surge-radius-control)] px-1 py-2.5 text-center " +
                (seated
                  ? "bg-[var(--surge-action)] text-white"
                  : "bg-[var(--surge-canvas)] text-[var(--surge-ink)]")
              }
            >
              <div className="text-[length:var(--surge-micro)] font-bold">{t.id}</div>
              <div className="text-[11px] opacity-90">{t.covers}</div>
              {/* The seated table says so in words as well as in blue. */}
              {t.elapsed ? <div className="text-[10px] font-semibold">Seated {t.elapsed}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Ticket = {
  id: string;
  channel: string;
  age: string;
  /** Text state — the chip and the age colour are decoration on top of this. */
  status: "In progress" | "Pending";
  late?: boolean;
  items: { qty: number; name: string; note?: string }[];
};

const TICKETS: Ticket[] = [
  { id: "#101", channel: "Dine in", age: "2m", status: "In progress", items: [{ qty: 1, name: "Burger", note: "No onions" }, { qty: 1, name: "Fries" }, { qty: 1, name: "Iced tea" }] },
  { id: "#102", channel: "Dine in", age: "6m", status: "Pending", late: true, items: [{ qty: 1, name: "Chicken sandwich" }, { qty: 1, name: "Caesar salad" }, { qty: 1, name: "Sparkling water" }] },
  { id: "#103", channel: "Takeaway", age: "8m", status: "Pending", items: [{ qty: 2, name: "Tacos" }, { qty: 1, name: "Queso" }, { qty: 1, name: "Chips" }] },
];

export function KitchenPanel() {
  return (
    <div>
      <PanelHeader title="Kitchen" trailing="All tickets" />
      <div className="grid grid-cols-3 gap-2">
        {TICKETS.map((t) => (
          <div key={t.id} className="flex flex-col rounded-[var(--surge-radius-control)] border border-[var(--surge-border)]">
            <div className="flex items-baseline justify-between gap-1 border-b border-[var(--surge-border)] px-2 py-1.5">
              <span className="text-[length:var(--surge-micro)] font-bold">{t.id}</span>
              <span className={"text-[11px] font-semibold " + (t.late ? "text-[var(--surge-danger)]" : "text-[var(--surge-muted)]")}>{t.age}</span>
            </div>
            <div className="px-2 pb-2 pt-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--surge-muted)]">{t.channel}</div>
              {/* THE LATE MARKER IN WORDS. The mockup signals it with a red
                  number only, which is status by colour alone. */}
              {t.late ? <div className="text-[10px] font-bold text-[var(--surge-danger)]">Over target</div> : null}
              <ul className="mt-1.5 space-y-1 text-[11px] leading-snug">
                {t.items.map((it) => (
                  <li key={it.name}>
                    <span className="font-semibold">{it.qty}</span> {it.name}
                    {it.note ? <span className="block text-[var(--surge-muted)]">{it.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className={"mt-auto rounded-b-[var(--surge-radius-control)] px-2 py-1.5 text-center text-[11px] font-semibold " + (t.status === "In progress" ? "bg-[var(--surge-accent-soft)] text-[var(--surge-action)]" : "bg-[var(--surge-canvas)] text-[var(--surge-muted)]")}>
              {t.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ORDERS = [
  { id: "#1042", where: "Table 7", channel: "Dine in", status: "Open", items: 4 },
  { id: "#1043", where: "Counter", channel: "Takeaway", status: "Ready", items: 2 },
  { id: "#1044", where: "Table 2", channel: "QR order", status: "Sent to kitchen", items: 6 },
  { id: "#1045", where: "Counter", channel: "Dine in", status: "Open", items: 3 },
];

export function OrdersPanel() {
  return (
    <div>
      <PanelHeader title="Orders" trailing="Today" />
      <ul className="divide-y divide-[var(--surge-border)] border-t border-[var(--surge-border)]">
        {ORDERS.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <div className="text-[length:var(--surge-micro)] font-bold">
                {o.id} <span className="font-normal text-[var(--surge-muted)]">{o.where}</span>
              </div>
              <div className="text-[11px] text-[var(--surge-muted)]">
                {o.channel} &middot; {o.items} items
              </div>
            </div>
            <span className="rounded-[var(--surge-radius-control)] border border-[var(--surge-border)] px-2 py-1 text-[11px] font-semibold text-[var(--surge-muted)]">{o.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// NO CURRENCY, NO TOTALS, NO PERCENTAGES. A reports screen is where a fabricated
// figure is most likely to be read as a result, so this one counts things —
// covers, orders, items — and the bar row is unlabelled shape rather than
// quantified revenue.
const HOURS = [
  { label: "11", height: 28 },
  { label: "12", height: 58 },
  { label: "13", height: 82 },
  { label: "14", height: 46 },
  { label: "15", height: 34 },
  { label: "16", height: 40 },
  { label: "17", height: 64 },
  { label: "18", height: 94 },
  { label: "19", height: 88 },
];

const TOP_ITEMS = [
  { name: "House burger", count: 42 },
  { name: "Flat white", count: 38 },
  { name: "Caesar salad", count: 27 },
];

export function ReportsPanel() {
  return (
    <div>
      <PanelHeader title="Reports" trailing="Today" />
      <div className="grid grid-cols-2 gap-3 pb-3">
        <div className="rounded-[var(--surge-radius-control)] bg-[var(--surge-canvas)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--surge-muted)]">Orders</div>
          <div className="text-[length:var(--surge-h3)] font-bold leading-tight">184</div>
        </div>
        <div className="rounded-[var(--surge-radius-control)] bg-[var(--surge-canvas)] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--surge-muted)]">Covers</div>
          <div className="text-[length:var(--surge-h3)] font-bold leading-tight">311</div>
        </div>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--surge-muted)]">Orders by hour</div>
      <div className="mt-2 flex h-[76px] items-end gap-1.5">
        {HOURS.map((h) => (
          <div key={h.label} className="flex flex-1 flex-col items-center gap-1">
            <div style={{ height: h.height + "%" }} className="w-full rounded-t-[3px] bg-[var(--surge-accent)]" />
            <span className="text-[9px] text-[var(--surge-muted)]">{h.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--surge-muted)]">Top items</div>
      <ul className="mt-1 space-y-1 text-[11px]">
        {TOP_ITEMS.map((t) => (
          <li key={t.name} className="flex justify-between border-b border-[var(--surge-border)] pb-1">
            <span>{t.name}</span>
            <span className="font-semibold text-[var(--surge-muted)]">{t.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
