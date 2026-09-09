// The demo restaurant's in-memory state: one believable evening of service for
// "the merchant's own room". Floor PLANS/ELEMENTS still come from the merchant's
// real layout (so the map is theirs); everything LIVE — checks, kitchen tickets,
// orders, reservations, guests, shifts — is generated here relative to `base`
// (the moment the store was built) and mutated by the demo API shims.
//
// Deterministic (seeded PRNG) so the same demo tells the same story every time,
// and rebuilt automatically once it's old enough that "8 min" would read stale.
import type { ModifierGroup } from "../modifiers";
import type { MenuItem, KitchenTicket, KdsItem, ReservationRow, CheckLine } from "../reads";

// ── tiny seeded PRNG (mulberry32) ───────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const DEMO_TAX_RATE = 0.13;

// ── menu ────────────────────────────────────────────────────────────────────
type Raw = { n: string; p: number; c: string; sc?: string; a?: string[]; oos?: boolean; mods?: ModifierGroup[]; short?: string };

const g = (id: string, name: string, required: boolean, min: number, max: number | null, options: [string, number][]): ModifierGroup => ({
  id: "dg-" + id,
  name,
  required,
  min_select: min,
  max_select: max,
  allow_split: false,
  options: options.map(([n, p], i) => ({ id: "dm-" + id + "-" + i, name: n, price: p })),
});
const TEMP = g("temp", "Temperature", true, 1, 1, [["Rare", 0], ["Medium rare", 0], ["Medium", 0], ["Medium well", 0], ["Well done", 0]]);
const SIDE = g("side", "Side", true, 1, 1, [["Fries", 0], ["House salad", 0], ["Truffle parmesan fries", 3], ["Sweet potato fries", 2]]);
const CHEESE = g("cheese", "Cheese", false, 0, 1, [["Aged cheddar", 0], ["Swiss", 0], ["Blue cheese", 1.5], ["No cheese", 0]]);
const BURGER_EXTRAS = g("bx", "Extras", false, 0, null, [["Bacon", 3], ["Fried egg", 2], ["Avocado", 2.5], ["Extra patty", 6], ["Jalapeños", 1]]);
const WING_SAUCE = g("ws", "Sauce", true, 1, 1, [["Buffalo", 0], ["Honey garlic", 0], ["Lemon pepper (dry)", 0], ["Korean BBQ", 0.5]]);
const PROTEIN = g("prot", "Add protein", false, 0, 1, [["Grilled chicken", 6], ["Garlic shrimp", 8], ["Salmon", 10]]);
const SCOOPS = g("ice", "Flavours", true, 1, 2, [["Vanilla bean", 0], ["Dark chocolate", 0], ["Salted caramel", 0], ["Strawberry", 0]]);
const MILK = g("milk", "Milk", false, 0, 1, [["Whole", 0], ["Oat", 0.75], ["Almond", 0.75], ["Skim", 0]]);
const DRESSING = g("dress", "Dressing", true, 1, 1, [["Caesar", 0], ["Balsamic", 0], ["Lemon vinaigrette", 0], ["Ranch", 0]]);

const RAW: Raw[] = [
  { n: "Crispy Calamari", p: 15, c: "Starters", a: ["Shellfish", "Gluten"] },
  { n: "Burrata & Heirloom Tomato", p: 16, c: "Starters", a: ["Milk"] },
  { n: "Truffle Parmesan Fries", p: 9, c: "Starters", a: ["Milk"] },
  { n: "Charred Broccolini", p: 11, c: "Starters" },
  { n: "Chicken Wings (1 lb)", p: 16, c: "Starters", mods: [WING_SAUCE] },
  { n: "Soup of the Day", p: 8, c: "Starters" },
  { n: "Steamed PEI Mussels", p: 17, c: "Starters", a: ["Shellfish"] },
  { n: "Caesar Salad", p: 13, c: "Salads", a: ["Eggs", "Fish", "Gluten"], mods: [PROTEIN] },
  { n: "Kale & Quinoa Salad", p: 14, c: "Salads", mods: [DRESSING, PROTEIN] },
  { n: "Beet & Goat Cheese Salad", p: 14, c: "Salads", a: ["Milk", "Tree nuts"] },
  { n: "House Greens", p: 9, c: "Salads", mods: [DRESSING] },
  { n: "Classic Burger", p: 18, c: "Burgers & Sandwiches", a: ["Gluten"], mods: [TEMP, CHEESE, BURGER_EXTRAS, SIDE] },
  { n: "Smash Double", p: 21, c: "Burgers & Sandwiches", a: ["Gluten", "Milk"], mods: [TEMP, BURGER_EXTRAS, SIDE] },
  { n: "Buttermilk Chicken Sandwich", p: 19.5, c: "Burgers & Sandwiches", a: ["Gluten", "Milk", "Eggs"], mods: [SIDE] },
  { n: "Veggie Burger", p: 17, c: "Burgers & Sandwiches", a: ["Gluten"], mods: [SIDE] },
  { n: "Steak Frites Sandwich", p: 22, c: "Burgers & Sandwiches", a: ["Gluten"], mods: [TEMP] },
  { n: "Pan-Seared Salmon", p: 29, c: "Mains", a: ["Fish"] },
  { n: "Half Roast Chicken", p: 27, c: "Mains" },
  { n: "10 oz Striploin", p: 38, c: "Mains", mods: [TEMP] },
  { n: "Mushroom Risotto", p: 24, c: "Mains", a: ["Milk"] },
  { n: "Braised Short Rib", p: 34, c: "Mains" },
  { n: "Fish & Chips", p: 22, c: "Mains", a: ["Fish", "Gluten"] },
  { n: "Rigatoni Bolognese", p: 23, c: "Mains", a: ["Gluten", "Milk"] },
  { n: "Grilled Sea Bass", p: 32, c: "Mains", a: ["Fish"], oos: true },
  { n: "Fries", p: 6, c: "Sides" },
  { n: "Sweet Potato Fries", p: 7.5, c: "Sides" },
  { n: "Garlic Mash", p: 7, c: "Sides", a: ["Milk"] },
  { n: "Seasonal Vegetables", p: 7, c: "Sides" },
  { n: "Side Salad", p: 6, c: "Sides" },
  { n: "Sticky Toffee Pudding", p: 10, c: "Desserts", a: ["Gluten", "Milk", "Eggs"] },
  { n: "Crème Brûlée", p: 9, c: "Desserts", a: ["Milk", "Eggs"] },
  { n: "Chocolate Torte", p: 11, c: "Desserts", a: ["Milk", "Eggs", "Tree nuts"] },
  { n: "Ice Cream (2 scoops)", p: 7, c: "Desserts", a: ["Milk"], mods: [SCOOPS] },
  { n: "House Lemonade", p: 5.5, c: "Drinks", sc: "Beverage" },
  { n: "Iced Tea", p: 4.5, c: "Drinks", sc: "Beverage" },
  { n: "Sparkling Water", p: 4, c: "Drinks", sc: "Beverage" },
  { n: "Coke", p: 3.5, c: "Drinks", sc: "Beverage" },
  { n: "Diet Coke", p: 3.5, c: "Drinks", sc: "Beverage" },
  { n: "Ginger Beer", p: 4.5, c: "Drinks", sc: "Beverage" },
  { n: "Espresso", p: 3.5, c: "Drinks", sc: "Beverage" },
  { n: "Latte", p: 5, c: "Drinks", sc: "Beverage", a: ["Milk"], mods: [MILK] },
  { n: "Spicy Margarita", p: 15, c: "Cocktails", sc: "Alcohol" },
  { n: "Old Fashioned", p: 16, c: "Cocktails", sc: "Alcohol" },
  { n: "Aperol Spritz", p: 14, c: "Cocktails", sc: "Alcohol" },
  { n: "Espresso Martini", p: 16, c: "Cocktails", sc: "Alcohol" },
  { n: "Negroni", p: 15, c: "Cocktails", sc: "Alcohol" },
  { n: "House Red (6 oz)", p: 12, c: "Wine", sc: "Alcohol", short: "House Red" },
  { n: "House White (6 oz)", p: 11, c: "Wine", sc: "Alcohol", short: "House White" },
  { n: "Rosé (6 oz)", p: 12, c: "Wine", sc: "Alcohol", short: "Rosé" },
  { n: "Prosecco (6 oz)", p: 13, c: "Wine", sc: "Alcohol", short: "Prosecco" },
  { n: "Local IPA", p: 9, c: "Beer", sc: "Alcohol" },
  { n: "Lager", p: 8, c: "Beer", sc: "Alcohol" },
  { n: "Pilsner", p: 8.5, c: "Beer", sc: "Alcohol" },
];

export const DEMO_MENU: MenuItem[] = RAW.map((r, i) => ({
  id: "demo-item-" + (i + 1),
  name: r.n,
  shortName: r.short ?? null,
  price: r.p,
  category: r.c,
  salesCategory: r.sc ?? (["Starters", "Salads", "Burgers & Sandwiches", "Mains", "Sides", "Desserts"].includes(r.c) ? "Food" : "Beverage"),
  imageUrl: null,
  outOfStock: !!r.oos,
  barcode: null,
  allergens: r.a ?? [],
  defaultCourseId: null,
  variations: [],
  modifierGroups: r.mods ?? [],
}));

const byName = (n: string) => DEMO_MENU.find((m) => m.name === n)!;

// Kitchen station by category (bar drinks don't go to the pass).
function stationFor(item: MenuItem): string | null {
  const c = item.category ?? "";
  if (c === "Drinks" || c === "Cocktails" || c === "Wine" || c === "Beer") return "demo-st-bar";
  if (/Fries|Calamari|Wings|Fish & Chips/.test(item.name)) return "demo-st-fryer";
  if (c === "Salads" || c === "Desserts") return "demo-st-salad";
  return "demo-st-grill";
}
export const DEMO_STATIONS = [
  { id: "demo-st-grill", name: "Grill" },
  { id: "demo-st-fryer", name: "Fryer" },
  { id: "demo-st-salad", name: "Salad & Dessert" },
  { id: "demo-st-bar", name: "Bar" },
];

// ── people ──────────────────────────────────────────────────────────────────
export const DEMO_STAFF = [
  { id: "demo-staff-sam", name: "Sam Whitfield", role: "server" },
  { id: "demo-staff-alexis", name: "Alexis Moreau", role: "server" },
  { id: "demo-staff-priya", name: "Priya Natarajan", role: "server" },
  { id: "demo-staff-marco", name: "Marco Ruiz", role: "server" },
  { id: "demo-staff-jordan", name: "Jordan Lee", role: "kitchen" },
  { id: "demo-staff-dana", name: "Dana Okafor", role: "host" },
];
const SERVERS = DEMO_STAFF.filter((s) => s.role === "server");

export type DemoCustomer = { id: string; name: string; phone: string | null; email: string | null; notes: string | null; taxExempt: boolean; loyaltyPoints: number | null; storeCredit: number };
export const DEMO_CUSTOMERS: DemoCustomer[] = [
  ["Maya Richardson", "(416) 555-0142", "maya.r@example.com", "Prefers a booth. Oat milk.", 640, 0],
  ["Daniel Brooks", "(647) 555-0198", "dbrooks@example.com", "Anniversary every Sept 12.", 1210, 25],
  ["Mei Lin", "(416) 555-0177", null, null, 320, 0],
  ["Fatima Al-Sayed", "(905) 555-0123", "fatima@example.com", "Severe tree-nut allergy — flag every order.", 890, 0],
  ["Tom Reilly", "(416) 555-0110", "tom.reilly@example.com", null, 150, 0],
  ["Ana Castillo", "(647) 555-0134", "ana.c@example.com", "Books the back room for team dinners.", 2350, 0],
  ["Chris Okonkwo", "(416) 555-0165", null, "Regular — Old Fashioned, no fruit.", 410, 0],
  ["Harper Family", "(905) 555-0187", "harpers@example.com", "Two high chairs.", 275, 0],
  ["Noor Haddad", "(647) 555-0151", "noor.h@example.com", null, 95, 40],
  ["Liam Gallagher", "(416) 555-0129", null, null, 60, 0],
  ["Sofia Petrov", "(416) 555-0173", "sofia.p@example.com", "Gluten-free.", 505, 0],
  ["Ethan Park", "(647) 555-0116", "ethan.park@example.com", null, 180, 0],
  ["Grace Mbeki", "(905) 555-0140", null, "Vegetarian; loves the risotto.", 720, 0],
  ["Owen Tremblay", "(416) 555-0195", "owen.t@example.com", null, 30, 0],
  ["Isabella Rossi", "(647) 555-0102", "bella.rossi@example.com", "Wine club member.", 1560, 0],
  ["Kai Nakamura", "(416) 555-0158", null, null, 240, 0],
].map(([name, phone, email, notes, pts, credit], i) => ({
  id: "demo-cust-" + (i + 1),
  name: name as string,
  phone: phone as string | null,
  email: email as string | null,
  notes: notes as string | null,
  taxExempt: false,
  loyaltyPoints: pts as number,
  storeCredit: credit as number,
}));

// ── store types ─────────────────────────────────────────────────────────────
export type DemoLine = CheckLine & { firedAt: string | null };
export type DemoCheck = {
  id: string;
  number: number; // check number shown as #1048
  label: string;
  ticketType: string; // table | togo | bar | delivery
  channel: string; // dine_in | takeout | pickup | delivery
  guests: number;
  openedAt: string;
  checkDropped: boolean;
  customerPhone: string | null;
  staffId: string;
  serverName: string;
  elementId: string | null;
  lines: DemoLine[];
};
export type DemoOrder = {
  id: string;
  saleNumber: number;
  createdAt: string;
  seatedAt: string | null;
  fulfilledAt: string | null;
  status: "paid" | "voided";
  refunded: number; // $ refunded (0 = none)
  channel: string;
  diningOption: string;
  guests: number | null;
  customerId: string | null;
  staffId: string;
  serverName: string;
  lines: { name: string; quantity: number; unitPrice: number; note: string | null; seat: number | null; allergy: string | null }[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  method: string;
};
export type DemoShift = { staffId: string; name: string; since: string; onBreakSince: string | null };

export type DemoStore = {
  base: number;
  checks: DemoCheck[];
  kitchen: KitchenTicket[];
  orders: DemoOrder[];
  reservations: ReservationRow[];
  shifts: DemoShift[];
  myShift: { onShift: boolean; onBreak: boolean; since: string | null; onBreakSince: string | null };
  tablesAssigned: boolean;
  nextCheck: number;
  nextSale: number;
  seq: number;
};

let store: DemoStore | null = null;
const STALE_MS = 75 * 60 * 1000;

export function demoStore(): DemoStore {
  if (!store || Date.now() - store.base > STALE_MS) store = build();
  return store;
}
export function resetDemoStore(): void {
  store = null;
}
export function nextId(prefix: string): string {
  const s = demoStore();
  s.seq += 1;
  return "demo-" + prefix + "-" + s.seq;
}
export const ago = (min: number, base = demoStore().base) => new Date(base - min * 60000).toISOString();
export const minutesSinceIso = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

// ── builder ─────────────────────────────────────────────────────────────────
function build(): DemoStore {
  const base = Date.now();
  const rand = rng(20260909);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);

  // 30 days of closed sales (today's stop a few minutes ago).
  const orders: DemoOrder[] = [];
  let sale = 1000;
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const POPULAR = ["Classic Burger", "Smash Double", "Buttermilk Chicken Sandwich", "Pan-Seared Salmon", "Fish & Chips", "Rigatoni Bolognese", "Caesar Salad", "Truffle Parmesan Fries", "Half Roast Chicken", "Mushroom Risotto", "Chicken Wings (1 lb)", "Crispy Calamari"];
  const DRINKS = ["House Lemonade", "Coke", "Local IPA", "House Red (6 oz)", "Spicy Margarita", "Sparkling Water", "Latte", "Aperol Spritz", "Iced Tea", "Old Fashioned"];
  const SWEETS = ["Sticky Toffee Pudding", "Crème Brûlée", "Chocolate Torte", "Ice Cream (2 scoops)"];
  const METHODS: [string, number][] = [["card", 0.6], ["debit", 0.24], ["cash", 0.12], ["gift", 0.04]];
  const pickMethod = () => {
    let r = rand();
    for (const [m, w] of METHODS) {
      if (r < w) return m;
      r -= w;
    }
    return "card";
  };
  for (let d = 29; d >= 0; d--) {
    const day = new Date(start.getTime() - d * 86400000);
    const dow = day.getDay();
    const count = d === 0 ? 0 : dow === 5 || dow === 6 ? 52 + Math.floor(rand() * 10) : dow === 0 ? 44 : 36 + Math.floor(rand() * 8);
    const times: number[] = [];
    if (d === 0) {
      // Today: spread orders from opening (or 5h ago, whichever is later) up to 4 minutes ago.
      const open = new Date(base);
      open.setHours(8, 0, 0, 0);
      const from = Math.max(open.getTime(), base - 5 * 3600000);
      const to = base - 4 * 60000;
      if (to > from) {
        const n = Math.max(6, Math.min(30, Math.round(((to - from) / 3600000) * 6)));
        for (let i = 0; i < n; i++) times.push(from + rand() * (to - from));
      }
    } else {
      for (let i = 0; i < count; i++) {
        // Lunch 11:30–14:00 (35%), dinner 17:00–21:45 (65%).
        const lunch = rand() < 0.35;
        const h = lunch ? between(11.5, 14) : between(17, 21.75);
        times.push(day.getTime() + h * 3600000);
      }
    }
    times.sort((a, b) => a - b);
    for (const t of times) {
      sale += 1;
      const guests = rand() < 0.6 ? 1 + Math.floor(rand() * 4) : 1;
      const nLines = 1 + Math.floor(rand() * 3) + (guests > 2 ? 1 : 0);
      const lines: DemoOrder["lines"] = [];
      for (let i = 0; i < nLines; i++) {
        const r = rand();
        const nm = r < 0.55 ? pick(POPULAR) : r < 0.85 ? pick(DRINKS) : pick(SWEETS);
        const it = byName(nm);
        const existing = lines.find((l) => l.name === it.name);
        if (existing) existing.quantity += 1;
        else lines.push({ name: it.name, quantity: 1, unitPrice: it.price, note: null, seat: null, allergy: null });
      }
      const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
      const discount = rand() < 0.08 ? round2(subtotal * 0.1) : 0;
      const tax = round2((subtotal - discount) * DEMO_TAX_RATE);
      const method = pickMethod();
      const tip = method === "cash" ? 0 : round2((subtotal - discount) * pick([0, 0.15, 0.18, 0.2, 0.15, 0.18]));
      const total = round2(subtotal - discount + tax + tip);
      const chRoll = rand();
      const dining = chRoll < 0.6 ? "dine_in" : chRoll < 0.8 ? "takeout" : chRoll < 0.92 ? "pickup" : "delivery";
      const channel = dining === "delivery" ? "online" : dining === "pickup" && rand() < 0.5 ? "online" : "pos";
      const srv = pick(SERVERS);
      const voided = rand() < 0.03;
      const createdAt = new Date(t).toISOString();
      const minsOld = (base - t) / 60000;
      // Today's recent off-premise orders are still being made (the Orders hub's Active list).
      const stillActive = d === 0 && dining !== "dine_in" && minsOld < 40 && !voided;
      orders.push({
        id: "demo-order-" + sale,
        saleNumber: sale,
        createdAt,
        seatedAt: dining === "dine_in" ? new Date(t - between(20, 55) * 60000).toISOString() : null,
        fulfilledAt: voided || stillActive ? null : new Date(t + between(6, 16) * 60000).toISOString(),
        status: voided ? "voided" : "paid",
        refunded: !voided && rand() < 0.025 ? round2(lines[0].unitPrice) : 0,
        channel,
        diningOption: dining,
        guests: dining === "dine_in" ? guests : null,
        customerId: rand() < 0.15 ? pick(DEMO_CUSTOMERS).id : null, // regulars: ~a dozen visits a month
        staffId: srv.id,
        serverName: srv.name.split(" ")[0],
        lines,
        subtotal,
        discount,
        tax,
        tip,
        total,
        method,
      });
    }
  }

  // Eight off-premise orders placed in the last 40 minutes and still being made —
  // the Orders hub's Active list (the time-of-day spread above rarely lands there).
  const RECENT: [number, string, string, string | null][] = [
    [3, "takeout", "pos", "Maya Richardson"],
    [6, "pickup", "online", "Owen Tremblay"],
    [9, "delivery", "online", "Fatima Al-Sayed"],
    [14, "takeout", "pos", null],
    [19, "pickup", "online", "Mei Lin"],
    [24, "delivery", "online", "Daniel Brooks"],
    [31, "takeout", "pos", null],
    [38, "pickup", "pos", "Noor Haddad"],
  ];
  for (const [minAgo, dining, channel, who] of RECENT) {
    sale += 1;
    const picks = [pick(POPULAR), pick(rand() < 0.5 ? POPULAR : DRINKS)];
    if (rand() < 0.4) picks.push(pick(SWEETS));
    const lines: DemoOrder["lines"] = [];
    for (const nm of picks) {
      const it = byName(nm);
      const ex = lines.find((l) => l.name === it.name);
      if (ex) ex.quantity += 1;
      else lines.push({ name: it.name, quantity: 1, unitPrice: it.price, note: null, seat: null, allergy: null });
    }
    const subtotal = round2(lines.reduce((x, l) => x + l.unitPrice * l.quantity, 0));
    const tax = round2(subtotal * DEMO_TAX_RATE);
    const tip = channel === "online" ? round2(subtotal * 0.1) : 0;
    const srv = pick(SERVERS);
    orders.push({
      id: "demo-order-" + sale,
      saleNumber: sale,
      createdAt: new Date(base - minAgo * 60000).toISOString(),
      seatedAt: null,
      fulfilledAt: null,
      status: "paid",
      refunded: 0,
      channel,
      diningOption: dining,
      guests: null,
      customerId: who ? DEMO_CUSTOMERS.find((c) => c.name === who)?.id ?? null : null,
      staffId: srv.id,
      serverName: srv.name.split(" ")[0],
      lines,
      subtotal,
      discount: 0,
      tax,
      tip,
      total: round2(subtotal + tax + tip),
      method: channel === "online" ? "card" : pickMethod(),
    });
  }

  // Non-table open checks (a takeout tab at the counter + a phone order).
  const checks: DemoCheck[] = [];
  let nextCheck = sale + 40;
  const mkLine = (name: string, qty: number, seat: number | null, firedMin: number | null, note: string | null = null): DemoLine => {
    const it = byName(name);
    return { catalogItemId: it.id, name: it.name, unitPrice: it.price, quantity: qty, note, seat, firedAt: firedMin == null ? null : ago(firedMin, base) };
  };
  checks.push({
    id: "demo-chk-togo-1",
    number: nextCheck++,
    label: "Takeout · Maya R.",
    ticketType: "togo",
    channel: "takeout",
    guests: 0,
    openedAt: ago(6, base),
    checkDropped: false,
    customerPhone: "(416) 555-0142",
    staffId: SERVERS[1].id,
    serverName: "Alexis",
    elementId: null,
    lines: [mkLine("Buttermilk Chicken Sandwich", 1, null, 3, "No pickles"), mkLine("Truffle Parmesan Fries", 1, null, 3), mkLine("House Lemonade", 2, null, 3)],
  });

  // Kitchen tickets for the off-premise orders being made right now.
  const kitchen: KitchenTicket[] = [];
  const kt = (id: string, label: string, elementId: string | null, firedMin: number, items: KdsItem[], opts: { doneMin?: number | null; rush?: boolean; station?: string } = {}): KitchenTicket => ({
    id,
    label,
    items,
    firedAt: ago(firedMin, base),
    fulfilledAt: opts.doneMin == null ? null : ago(opts.doneMin, base),
    stationId: opts.station ?? "demo-st-grill",
    courseId: null,
    rush: !!opts.rush,
    elementId,
  });
  kitchen.push(kt("demo-kt-togo-1", "Takeout · Maya R.", null, 3, [{ name: "Buttermilk Chicken Sandwich", quantity: 1, note: "No pickles", allergens: [] }], { station: "demo-st-grill" }));
  kitchen.push(kt("demo-kt-togo-1b", "Takeout · Maya R.", null, 3, [{ name: "Truffle Parmesan Fries", quantity: 1, note: null, allergens: [] }], { station: "demo-st-fryer" }));
  kitchen.push(kt("demo-kt-pickup-1", "Pickup · #" + (sale - 1), null, 7, [{ name: "Rigatoni Bolognese", quantity: 2, note: null, allergens: [] }, { name: "Caesar Salad", quantity: 1, note: "Dressing on the side", allergens: [] }]));
  kitchen.push(kt("demo-kt-delivery-1", "Delivery · DoorDash", null, 12, [{ name: "Fish & Chips", quantity: 1, note: null, allergens: [] }, { name: "Chicken Wings (1 lb)", quantity: 1, note: "Honey garlic", allergens: [] }], { station: "demo-st-fryer" }));
  kitchen.push(kt("demo-kt-togo-done", "Takeout · Chris O.", null, 21, [{ name: "Smash Double", quantity: 1, note: "Medium · no onion", allergens: [] }, { name: "Fries", quantity: 1, note: null, allergens: [] }], { doneMin: 9 }));

  // Reservations tonight (roll to tomorrow once a slot has passed) + the waitlist.
  const slot = (h: number, m: number) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    if (d.getTime() < base + 20 * 60000) d.setDate(d.getDate() + 1);
    return d.toISOString();
  };
  const res = (id: string, guestName: string, partySize: number, phone: string | null, email: string | null, scheduledAt: string | null, status: string, extra: Partial<ReservationRow> = {}): ReservationRow => ({
    id,
    guestName,
    partySize,
    phone,
    email,
    scheduledAt,
    quotedWaitMin: null,
    elementId: null,
    status,
    notes: null,
    pagedAt: null,
    createdAt: ago(scheduledAt ? 60 * 24 * 2 : 10, base),
    ...extra,
  });
  const reservations: ReservationRow[] = [
    res("demo-res-1", "Priya Natarajan", 4, "(416) 555-0177", null, slot(17, 30), "booked", { notes: "Birthday — candle on the dessert" }),
    res("demo-res-2", "The Okafors", 6, "(905) 555-0140", null, slot(18, 0), "booked", { notes: "One high chair" }),
    res("demo-res-3", "Daniel Brooks", 2, "(647) 555-0198", "dbrooks@example.com", slot(18, 0), "booked", { notes: "Anniversary" }),
    res("demo-res-4", "Mei Lin", 3, "(416) 555-0177", null, slot(18, 30), "booked"),
    res("demo-res-5", "Jordan & Sam", 2, "(416) 555-0163", null, slot(19, 0), "booked", { notes: "Window table if possible" }),
    res("demo-res-6", "Fatima Al-Sayed", 5, "(905) 555-0123", "fatima@example.com", slot(19, 30), "booked", { notes: "Tree-nut allergy at the table" }),
    res("demo-res-7", "Tom Reilly", 2, "(416) 555-0110", null, slot(20, 0), "booked"),
    res("demo-res-8", "Ana Castillo", 8, "(647) 555-0134", "ana.c@example.com", slot(20, 30), "booked", { notes: "Set menu · deposit paid" }),
    // Walk-ins waiting right now.
    res("demo-wait-1", "Noor Haddad", 2, "(647) 555-0151", null, null, "waitlisted", { quotedWaitMin: 15, createdAt: ago(4, base) }),
    res("demo-wait-2", "Ethan Park", 4, "(647) 555-0116", null, null, "waitlisted", { quotedWaitMin: 20, createdAt: ago(11, base), pagedAt: ago(2, base) }),
    res("demo-wait-3", "Sofia Petrov", 2, null, null, null, "waitlisted", { quotedWaitMin: 25, createdAt: ago(18, base) }),
    res("demo-wait-4", "Liam Gallagher", 3, "(416) 555-0129", null, null, "waitlisted", { quotedWaitMin: 30, createdAt: ago(26, base) }),
  ];

  const shifts: DemoShift[] = [
    { staffId: "demo-staff-jordan", name: "Jordan Lee", since: ago(5 * 60 + 2, base), onBreakSince: null },
    { staffId: "demo-staff-sam", name: "Sam Whitfield", since: ago(4 * 60 + 12, base), onBreakSince: null },
    { staffId: "demo-staff-alexis", name: "Alexis Moreau", since: ago(3 * 60 + 5, base), onBreakSince: null },
    { staffId: "demo-staff-priya", name: "Priya Natarajan", since: ago(2 * 60 + 40, base), onBreakSince: ago(6, base) },
    { staffId: "demo-staff-dana", name: "Dana Okafor", since: ago(2 * 60 + 20, base), onBreakSince: null },
    { staffId: "demo-staff-marco", name: "Marco Ruiz", since: ago(60 + 45, base), onBreakSince: null },
  ];

  return {
    base,
    checks,
    kitchen,
    orders,
    reservations,
    shifts,
    myShift: { onShift: true, onBreak: false, since: ago(3 * 60 + 10, base), onBreakSince: null },
    tablesAssigned: false,
    nextCheck,
    nextSale: sale + 1,
    seq: 0,
  };
}

// ── table assignment (needs the merchant's real table ids) ───────────────────
// Called by the demo reads once the floor elements are known. Assigns a
// believable spread of service states across the room, in sort order:
//   open 8m · sent 14m · ready 26m · payment due 47m · late 78m · available ×n
export function assignTables(tables: { id: string; label: string }[]): void {
  const s = demoStore();
  if (s.tablesAssigned || tables.length === 0) return;
  s.tablesAssigned = true;
  const base = s.base;
  const line = (name: string, qty: number, seat: number | null, firedMin: number | null, note: string | null = null): DemoLine => {
    const it = byName(name);
    return { catalogItemId: it.id, name: it.name, unitPrice: it.price, quantity: qty, note, seat, firedAt: firedMin == null ? null : ago(firedMin, base) };
  };
  const mk = (t: { id: string; label: string }, srv: (typeof SERVERS)[number], guests: number, openedMin: number, lines: DemoLine[], checkDropped = false): DemoCheck => ({
    id: "demo-chk-" + t.id,
    number: s.nextCheck++,
    label: t.label,
    ticketType: "table",
    channel: "dine_in",
    guests,
    openedAt: ago(openedMin, base),
    checkDropped,
    customerPhone: null,
    staffId: srv.id,
    serverName: srv.name.split(" ")[0],
    elementId: t.id,
    lines,
  });
  const items = (label: string, elementId: string, firedMin: number, kds: KdsItem[], opts: { doneMin?: number | null; rush?: boolean; station?: string } = {}): KitchenTicket => ({
    id: "demo-kt-" + elementId + "-" + (opts.station ?? "grill") + "-" + firedMin,
    label,
    items: kds,
    firedAt: ago(firedMin, base),
    fulfilledAt: opts.doneMin == null ? null : ago(opts.doneMin, base),
    stationId: opts.station ?? "demo-st-grill",
    courseId: null,
    rush: !!opts.rush,
    elementId,
  });

  const [t0, t1, t2, t3, t4] = tables;
  const [sam, alexis, priya, marco] = SERVERS;

  // Table A — just seated, drinks in, order being built (nothing fired).
  if (t0) s.checks.push(mk(t0, sam, 2, 8, [line("Spicy Margarita", 1, 1, null), line("Local IPA", 1, 2, null)]));
  // Table B — order sent, cooking for 9 minutes.
  if (t1) {
    s.checks.push(mk(t1, alexis, 4, 14, [line("Classic Burger", 2, null, 9, "One medium, one well done"), line("Caesar Salad", 1, 1, 9, "Add chicken"), line("Kale & Quinoa Salad", 1, 2, 9), line("House Lemonade", 2, null, 13), line("Sparkling Water", 1, null, 13)]));
    s.kitchen.push(items(t1.label, t1.id, 9, [{ name: "Classic Burger", quantity: 2, note: "One medium, one well done", allergens: [] }], { station: "demo-st-grill" }));
    s.kitchen.push(items(t1.label, t1.id, 9, [{ name: "Caesar Salad", quantity: 1, note: "Add chicken", allergens: [] }, { name: "Kale & Quinoa Salad", quantity: 1, note: null, allergens: [] }], { station: "demo-st-salad" }));
  }
  // Table C — everything bumped 3 minutes ago: run the food.
  if (t2) {
    s.checks.push(mk(t2, sam, 2, 26, [line("Pan-Seared Salmon", 1, 1, 19), line("Mushroom Risotto", 1, 2, 19), line("House White (6 oz)", 2, null, 25)]));
    s.kitchen.push(items(t2.label, t2.id, 19, [{ name: "Pan-Seared Salmon", quantity: 1, note: null, allergens: [] }, { name: "Mushroom Risotto", quantity: 1, note: null, allergens: ["Milk"] }], { doneMin: 3 }));
  }
  // Table D — check presented, waiting on payment.
  if (t3) s.checks.push(mk(t3, priya, 3, 47, [line("10 oz Striploin", 1, 1, 38, "Medium rare"), line("Half Roast Chicken", 1, 2, 38), line("Fish & Chips", 1, 3, 38), line("Truffle Parmesan Fries", 1, null, 38), line("House Red (6 oz)", 2, null, 46), line("Crème Brûlée", 1, 1, 12)], true));
  // Table E — the one genuinely late table: a rush ticket still cooking after 41 minutes.
  if (t4) {
    s.checks.push(mk(t4, marco, 4, 78, [line("Braised Short Rib", 2, null, 41), line("Smash Double", 1, 3, 41, "No cheese"), line("Veggie Burger", 1, 4, 41), line("Old Fashioned", 2, null, 74), line("Aperol Spritz", 2, null, 74), line("Crispy Calamari", 1, null, 74)]));
    s.kitchen.push(items(t4.label, t4.id, 41, [{ name: "Braised Short Rib", quantity: 2, note: null, allergens: [] }, { name: "Smash Double", quantity: 1, note: "No cheese", allergens: [] }, { name: "Veggie Burger", quantity: 1, note: null, allergens: [] }], { rush: true }));
  }
}

// ── helpers shared by the demo reads + api shims ─────────────────────────────
export function checkSubtotal(c: DemoCheck): number {
  return round2(c.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
}
export function checkItemCount(c: DemoCheck): number {
  return c.lines.reduce((s, l) => s + l.quantity, 0);
}
export function checkNumberCode(id: string): string {
  const c = demoStore().checks.find((x) => x.id === id);
  return c ? "#" + c.number : "";
}
export { stationFor, round2 };
