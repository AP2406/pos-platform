# Overview dashboard — data-source audit

An approved mockup for `/app` names fourteen distinct pieces of information.
Before any of it was built, each one was checked against the schema and the
existing pages. This document is that check.

The rule it was written under: **a number with no source does not get rendered.**
Not as a placeholder, not as a zero, not as a plausible-looking constant. Either
there is a query behind it or it is not on the page, and if it is not on the page
this file says why.

Read alongside `docs/competitor-dashboard-study.md`, which is what decided that
the attention rail and the written zero states survive the rebuild intact.

---

## Verdict table

| Mockup element | Real? | Source | What shipped |
| --- | --- | --- | --- |
| `Overview` + long date | yes | `business.timezone`, scoped day | shipped |
| `Today ⌄` scope control | yes | existing `?day=` link pair | shipped, unchanged semantics |
| `Export ↓` | partly | `/app/reports` client CSV | shipped as a link to the day-scoped report, **not** a download button |
| KPI · `Net sales` | yes, after a fix | `orders.total` − `refunds.amount` | shipped — and the old "net of refunds" claim was false |
| KPI · `Completed orders` + count delta | yes | `orders` count, same weekday last week | shipped |
| KPI · `Average order` | yes | derived | shipped |
| KPI · `Labour cost %` | yes | `time_clock_entries` × `staff_members.pay_rate` | shipped, gated |
| KPI · `Within target` / `Below 28%` | yes | `settings.labor_target` | shipped, only when a target is actually set |
| `Hourly \| Daily` toggle | yes | both series already in hand | shipped |
| Bar chart with `$0…$1k` y-axis | yes | `niceCeiling()` | shipped |
| `Highest sales hour 8–9 PM · $820` | yes | hourly buckets | shipped |
| `Occupied tables 12 / 24` | yes | `floor_elements` + `open_tickets.element_id` | shipped, full-service only |
| `Open orders` | yes | `open_tickets` / `kitchen_tickets` | shipped |
| `Average prep time 14 min` | yes | `kitchen_tickets.fired_at → fulfilled_at` | shipped, kitchen only |
| Channel split `Dine-in / Takeout / Delivery` | yes, but not three-way | `orders.channel` + `snapshot.dining_option` | shipped with **five** real buckets |
| `Top-selling items` | yes | `order_items` | shipped, reusing the report's aggregate |
| `Needs attention` | yes | `lib/services/dashboard-signals.ts` | restyled, signals unchanged |
| `Last synced at 10:04 PM` | **no** | — | **omitted**; replaced with the render time |
| `Systems operational` | **no** | — | **omitted** (already true of the top bar) |
| `Surge Admin / Sample data` | partly | `businesses.is_demo` | shipped only for demo tenants |

---

## 1 · Labour cost, and the target threshold

**Both are real.** This was the element most likely to be roadmap, and it isn't.

`businesses.settings.labor_target` holds `{ enabled, targetPct, alerted_on }`.
It is written by `app/app/settings/labor-target-actions.ts` (`setLaborTarget`,
owner/manager only, clamped 1–100), surfaced by
`app/app/settings/labor-target-card.tsx`, read by `app/app/labor/page.tsx` to
decide `overTarget`, and it fires the once-a-day "Labor over target" push in
`app/app/m/actions.ts`. It also has an entry in the newer config registry as
`labor.target_pct` (`lib/services/config/registry.ts`). So the mockup's
"Within target / Below 28%" is a real pair of facts.

One correction to the mockup: the default target is **30%, not 28%**. The card
ships `targetPct = 30`. The dashboard prints whatever the merchant actually set.

The cost side is `time_clock_entries` (actual punches, break-deducted) joined to
`staff_members.pay_rate`, which migration `0045_staff_pay_rate.sql` added and
which is the only wage column in the schema.

### The problem worth naming: there are four implementations

| Where | Basis | Overtime |
| --- | --- | --- |
| `app/app/labor/page.tsx` | clocked hours, per-ISO-week OT split | **yes**, `splitOtHours` at 1.5× over 44h |
| `app/app/accounting/cost.ts` → `laborForPeriod` | clocked hours, prorated to the window | no |
| `app/app/schedule/page.tsx` | **scheduled** shifts vs a 4-week sales average | no — it is a forecast |
| `app/app/m/actions.ts` | today's clocked hours | no |

A fifth would be a fifth number to disagree with. So the dashboard does not write
its own: `laborForPeriod` is now exported from `app/app/accounting/cost.ts` and
called directly, which puts the dashboard on the same figure as `/app/accounting`,
`/app/locations`, the consolidated export and the scheduled-report email.

**It can still differ from `/app/labor`**, because that page applies an overtime
multiplier and this one does not. Over a single business day the two converge in
practice — `splitOtHours` buckets by ISO week and one day of hours rarely crosses
44 — but they are not guaranteed identical, and the honest fix is one shared
service that both call. That is a separate change; it touches payroll maths and
the tips/payroll exports, so it is not this one.

### Honesty guards actually implemented

- no clocked hours in the window → the cell says so, it does not print `0.0%`
- hours logged but **no pay rates on file** → the cell says the rates are missing,
  because `Σ hours × null` is `$0` and `$0 / sales` is `0.0%`, which would read as
  a restaurant running on volunteers
- `settings.labor_target.enabled !== true` → the percentage is shown with
  "No target set", never with a fabricated threshold
- no sales in the window → a percentage of zero is undefined, so it is withheld
- gated on `canAccess(role, "access_reports")` — the same permission
  `ROUTE_PERMISSIONS` puts on `/app/labor` — and on the `staff` module

---

## 2 · Average prep time

**Real, and measured, but it had to be built here.**

`catalog_items.prep_minutes` (migration `0040`) is a **target**, not a
measurement. It is copied into `kitchen_tickets.items[]` at fire time by
`app/app/pos/ticket-actions.ts`, and it is used for exactly two things: colouring
a ticket on the KDS (`ticketTarget()` in `app/app/kitchen/kitchen-client.tsx`)
and printing on a chit. It is **never compared to elapsed time anywhere.**

Actual elapsed prep is recoverable: `kitchen_tickets` carries both `fired_at` and
`fulfilled_at` (migration `0002`), and bumping sets `fulfilled_at` rather than
deleting the row, so history survives.

It is already aggregated in exactly one place — `app/app/insights/page.tsx`,
"Kitchen speed", which averages `fulfilled_at − fired_at` over a 7- or 30-day
window with a `0 < mins < 240` outlier guard. That page is **gated to
full-service** (`hasFloorService`, hard redirect) and is not scoped to a day, so
it could not simply be read.

What shipped is the same arithmetic and the same outlier guard, over the tickets
fulfilled **within the scoped day**, gated on the `kitchen` module rather than on
full service. It is labelled with its window and its sample size, because "14 min"
off three tickets and "14 min" off ninety are different claims.

Known limits, stated on the card or here:
- it measures the whole ticket, so the slowest item sets the number
- takeout and online orders bumped through `orders.fulfilled_at`
  (`lib/services/order-fulfill.ts`) are **not** in it — it reads `kitchen_tickets`
  only, exactly as `/app/insights` does
- it is not compared against `prep_minutes`; the timing query does not select
  `items`, which is where the target lives

---

## 3 · Occupied tables

**Real, for full-service.**

There is no `tables` table. The concept is `floor_elements` with
`kind = 'table' | 'booth'` (migration `0002`, extended by `0005`/`0015`).
Occupancy is not a status column — it is derived from the existence of an
`open_tickets` row with `element_id` pointing at the element, which is exactly
how `listTableMoveTargets` and the floor plan's lock check already do it. A
partial unique index (`open_tickets_one_per_element`) guarantees at most one open
ticket per element, so a count is safe.

Two filters are load-bearing and both are applied:
- `parent_ticket_id is null`, to exclude split children, which would double-count
- `kind in ('table','booth')` on the denominator, because seats, counters and
  stations are also ringable and would inflate the total

Gated on `hasFloorService`. A counter-service business has no floor plan; showing
it `0 / 0` would be a true statement about a question it never asked.

---

## 4 · The channel split

**Real, but the mockup's three buckets are not the product's buckets.**

There are two fields and neither alone is enough:

- `orders.channel` — plain `text`, no enum, no CHECK. Written as `kiosk`
  (`0071`), `online` (`0072`, `0096`), `qr` (`0073`), and
  `doordash | ubereats | grubhub | delivery` (`0074`). `NULL` means a counter sale.
- `snapshot.dining_option` — JSONB only, **never a column**; selecting it as one
  errors the whole PostgREST query, which is the bug that broke the Orders hub and
  is warned about in three separate files. Values: `dine_in | takeout | delivery |
  pickup`, set by the register (`app/app/pos/actions.ts`).

`/app/reports` already merges the two into five buckets — `dine_in, takeout,
pickup, delivery, in_store`. Rather than write a sixth variant, that function has
been lifted into `lib/services/order-channel.ts` and both pages now import it, so
the dashboard and the report can no longer drift apart.

The dashboard renders **all five** buckets that have volume, not three. `Pickup`
is a first-class dining option and folding it into Takeout would be a silent
reclassification of real money. Where the mockup says three tones, the bar draws
as many flat rungs of the blue ramp as there are non-empty buckets.

### A real bug found and deliberately not fixed here

`channelOf` matches delivery with `c.includes("delivery")`. So an order whose
`channel` is literally `doordash`, `ubereats` or `grubhub` **falls through to
`in_store`**. Only the `delivery` fallback slug — which `0074` uses for *unknown*
platforms — is classified correctly. `kiosk`, `online` and `qr` also land in
`in_store`.

This is wrong in `/app/reports` today and it is wrong on the dashboard now, in
exactly the same way, because they share one function. It was left alone on
purpose: correcting it changes the numbers on a financial report nobody asked to
have changed, and doing that inside a dashboard restyle is how a reporting
discrepancy gets shipped without anyone noticing. It should be its own change,
with its own before/after.

Second, smaller mismatch: `/app/insights` has its own, *correct* channel map
(`kiosk/online/qr/doordash/ubereats/grubhub`) that ignores `dining_option`
entirely. Three channel views, three answers. Also its own change.

---

## 5 · Top-selling items

**Real, and deliberately not re-derived.**

Both existing implementations read `order_items` (`catalog_item_id, name,
unit_price, quantity`) and both are inline in a page component:

- `app/app/reports/page.tsx` — keys on `"id:"+catalog_item_id` or `"name:"+name`,
  normalises through `displayItemName()` to collapse split `X (shared)` rows,
  sorts by revenue, takes 20
- `app/app/insights/page.tsx` — keys on the normalised name, adds recipe plate
  cost for margin, gated to full-service

The brief was explicit that a new aggregate must not be written. The reports pass
has been extracted verbatim into `lib/services/product-mix.ts`
(`aggregateItemSales`), reports now calls it, and the dashboard calls the same
function over the scoped day's orders. Identical keying, identical normalisation,
identical sort — a unit test pins the tie-break order, which is insertion order
and was previously an accident of `Object.keys`.

**The column is labelled `Item sales`, not `Net sales`.** `unit_price × quantity`
is gross line revenue: it does not prorate a check-level discount or comp, and it
is not reduced by a refund. `/app/reports` disclaims exactly this at the foot of
its own table. Putting the mockup's `NET SALES` heading over this column would
make the dashboard state something the number does not support.

---

## 6 · The Hourly | Daily toggle

**Both series are real, and neither costs a query.**

- **Daily** is the existing 14-day window (`windowRes`), already fetched, already
  bucketed by the business's local date.
- **Hourly** is `dayRows` — the page's must()-guarded primary query — bucketed by
  local hour instead of accumulated. The rows were already in hand for the hero
  figure; the only new thing is a pure function, `hourlyBuckets()`, added beside
  `cumulativeCurve()` in `lib/services/dashboard-signals.ts` and unit-tested.

The pre-existing hourly series in `/app/insights` was **not** reused: it is a
24-hour-of-day histogram summed across 7 or 30 days, gated to full-service. That
is a different quantity from "today, hour by hour", and reusing it would have
meant a bar labelled `8 PM` that is an average of four Fridays.

`cumulativeCurve` is untouched and still cumulative, which its own doc comment
explains at length. The toggle rides the URL (`?chart=hourly`) the same way the
scope control rides `?day=`, so it stays server-rendered — no client component,
and both states are links a manager can bookmark.

### What this replaced

The cumulative pace curve and the 64px hero figure are gone from the page body;
the mockup moves net sales into the KPI band and gives the wide slot to a bar
chart. **The pace comparison itself survives** — it is the delta line under
`Net sales`, still computed by `computePace()`, still against the same weekday
last week.

The mockup's delta reads `vs. yesterday`. Ours does not, and will not.
`computePace`'s entire design note is that a Tuesday measured against a Monday
reports a crisis every Monday, and that the benchmark must be truncated to the
same time of day. That is the better comparison, it is already built, it is
already tested, and switching to yesterday would cost a query to get a worse
answer.

---

## 7 · "Last synced at 10:04 PM" — no source. Omitted.

There is no sync timestamp anywhere in this product.

- no `/api/health`, no status route, no heartbeat table, no `synced_at` column
  (the only `last_synced_at` in the codebase belongs to the Google Ads
  integration)
- no offline queue, no outbox, nothing to flush and therefore nothing to have
  last flushed; the only offline persistence is a draft cart in `localStorage`
- `public/sw.js` handles `install`/`activate`/`push`/`notificationclick` only —
  no `fetch` handler, no Cache API, no `sync` or `periodicsync`
- the top bar's dot is `navigator.onLine` and nothing else, and it already says
  "Connected" rather than the mockup's "Systems operational" precisely because
  that would be an infrastructure claim the client cannot check
  (see the comment above `ConnectionDot` in `app/app/_components/top-bar.tsx`)

What the footer says instead is `Figures as of 10:04 p.m.` — the time the server
rendered the page, which is the moment the queries ran and is the only thing on
the page that is both true and useful. It is not a sync claim and it is not
dressed up as one.

Worth flagging for later: the till (`app/app/pos/use-online.ts`) explicitly
distrusts `navigator.onLine` — it polls `/favicon.ico` every 30s because
`navigator.onLine` gives "frequent false negatives" — while the admin top bar
trusts nothing else. Two answers to one question, and the till's is the better
one. Not this change.

---

## 8 · Export

**Half real, and the half that exists is broken.**

`/app/exports` is three buttons. All three point at `/api/export/...` (singular).
The handlers live at `/api/exports/...` (plural). **Every button on that page is a
404** and has been since it shipped. Separately, the page admits anyone with
`export_data` — which includes `bookkeeper` — while every handler hard-codes
`role !== "owner" && role !== "manager" → 403`, so a bookkeeper would get a 403
even once the URL is fixed.

Neither was fixed here. The first is a three-character href change in a page this
work has no other business touching; the second is a permissions decision, and the
brief rules permission changes out. Both belong in a change that says so in its
title.

The dumps are also not what the mockup means: they are whole-table exports
(`.limit(10000)`, no date parameters at all), not an export of the day you are
looking at.

The one export in the product that **is** day-scoped and **does** work is on
`/app/reports`: `ExportButton` builds a transaction-level CSV in the browser from
the rows already rendered, and `?range=today` scopes it to one day.

So the header's `Export` is a **link to that**, carrying the current scope
(`/app/reports?range=today`, or explicit `from`/`to` for yesterday), gated on
`canAccess(role, "export_data")`. It is styled as a secondary button and labelled
`Export`, with no download glyph — because it opens a page, and an arrow pointing
into a tray would promise a file that does not arrive until you click again.

---

## 9 · What the mockup got right that we were getting wrong

Two things, found while checking rather than while building.

**`Net sales` was a lie by omission.** The hero card's subtitle read "Net of
refunds · training excluded". Training was excluded; refunds were not. Refunding
a sale sets `orders.status` to `refunded` or `partially_refunded` and writes a row
to `refunds` — it **does not reduce `orders.total`**
(`app/app/pos/sales/refund-actions.ts`). So the figure was gross, under a label
that said net.

The mockup's insistence on the words "Net sales" is what surfaced it. It is now
actually net: `Σ orders.total − Σ refunds.amount` over the scoped day's orders,
the same definition `/app/reports` uses for its `net` line. The refunds read is a
`soft()`, and if it fails the card falls back to the gross figure **and relabels
itself**, because a number labelled "net" that quietly isn't is the exact class of
lie this page keeps being rebuilt to stop telling.

**A status phrase beats a delta for a bounded ratio.** The mockup's fourth KPI
does not carry `↗ 2.4%`; it carries `Within target · Below 28%`. That is the right
shape and it is not only right for labour: a percentage-of-sales figure moving 2%
is noise, whereas "over the number you set" is a thing an owner stands up for.
`KpiDelta` now has a second variant for it.

---

## 10 · Preserved, deliberately

- **`must()` / `soft()`.** The day's orders are still `must()` — a failed select
  can never render as a healthy `$0.00`. Every new read added here is `soft()`
  with its own failure flag, and every module that depends on one can say
  "couldn't load" instead of showing a zero.
- **The attention rail.** `lib/services/dashboard-signals.ts` is unchanged. Every
  signal, every threshold, `rankSignals`, the `degraded[]` footer that stops an
  empty rail reading as "all clear" when a check did not run — all identical.
  Only the row's anatomy changed, to the mockup's circled mark / bold title /
  muted second line / chevron.
- **The written zero states.** The study found ours beat all four competitors and
  that Lightspeed's five-identical-"No data" home reads as a broken product. Every
  module here still has its own sentence, and the new modules were given theirs
  before they were given their charts.
- **`canAccess` / `enabledModules` / `hasFloorService`.** Unchanged, and three new
  gates added in the same style: labour on `access_reports`, tables on
  `hasFloorService`, prep time on the `kitchen` module.
- **The launch-readiness panel.** Unchanged, still first, still suppressed when
  the catalog or drawer query failed, still hidden from anyone who cannot act on it.

## 11 · Omitted, and why

| Omitted | Why |
| --- | --- |
| `Last synced at …` | no sync timestamp exists anywhere in the product |
| `Systems operational` | no status endpoint; would be an unverifiable infrastructure claim |
| `↓` on Export | it opens a page, not a file |
| Three-way channel split | the real bucket set is five; folding Pickup into Takeout reclassifies money |
| `NET SALES` on the item table | `unit_price × quantity` is gross of discounts and refunds |
| `vs. yesterday` | same-weekday-last-week is the comparison this product already computes, and it is the better one |
| Refunds KPI (when labour is available) | four columns, and labour is the more actionable of the two; refunds still show as `notable` rows in the register |
