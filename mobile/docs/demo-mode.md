# Demo restaurant mode

A switch that fills every screen of the iPad app with one believable evening of
service, for showing Surge to a prospective restaurant. It exists because a real
dev database fills up with stale test rows (43-hour-old checks, "Smoke Test
Party") and a brand-new merchant account is, correctly, empty.

## What it does

- **Availability:** development builds only (`__DEV__`), or a build made with
  `EXPO_PUBLIC_ALLOW_DEMO=1`. Merchant builds never show the toggle.
- **Where:** Staff tools → Device settings → *Demo restaurant* (managers only).
  The choice is stored in the device profile, and the Floor header shows a
  **DEMO** tag while it's on.
- **Reads:** every function in `src/lib/reads.ts` is guarded with
  `if (demoOn()) return demo.…` and served from `src/lib/demo/`. The floor
  **layout** (plans, elements, sections) still comes from the merchant's real
  room; the demo only synthesizes what's live on it.
- **Writes:** every v1 API call in `src/lib/api.ts` (fire, bump, mark ready,
  seat, text guest, clock in/out, move item, quote) is shimmed to mutate the
  in-memory store instead — nothing reaches Supabase or the API.
- **Time:** all timestamps are relative to the moment the store was built, so
  tables read "8 min" whenever the demo is given. The store rebuilds itself
  after 75 minutes.

## What's in it (`src/lib/demo/store.ts`)

| Screen | Content |
| --- | --- |
| Floor / Board | Open 8 min · Sent 14 min · Ready 26 min · Payment due 47 min · **one** late table (1h 18m) · rest available, plus a takeout tab |
| Register | 53-item menu across 10 categories with required/optional modifier groups, allergens, one sold-out item, two upsell prompts; HST 13% |
| Kitchen | Grill / Fryer / Salad & Dessert / Bar stations; five tickets cooking (one rush, one late) and two ready to recall |
| Orders | ~8 active off-premise orders (3–38 min old), today's completed and a few voided |
| Sales | 30 days of closed checks (lunch + dinner curves, Fri/Sat busier), tips, refunds, voids |
| Reservations | 8 bookings tonight with notes; slots roll to tomorrow once they've passed |
| Waitlist | 4 parties with quotes, one already texted |
| Customers | 16 profiles with contact details, notes, loyalty points, visit history |
| Time clock | 6 staff on the clock (one on break); you are clocked in |

Deterministic (seeded PRNG): the same demo tells the same story every time.
