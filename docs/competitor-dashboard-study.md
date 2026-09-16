# Restaurant POS back-office dashboards — a design study

**Researched:** 10 September 2026. **Method:** public support documentation, vendor
product pages, and vendor-supplied screenshots on Gartner Digital Markets
(Software Advice). No merchant account was signed into, and no credentials were
used. Every claim below is tied to a URL and to something actually visible in a
screenshot.

**Screenshots:** the workspace shell ran out of disk during this session, so I
could not write image files to `docs/competitor-screens/`. Instead there is
`docs/competitor-screens/index.html` — open it in a browser and it loads every
piece of evidence referenced here, captioned, straight from the vendors' own
CDNs. Direct URLs are also inline in each section below, so nothing is lost.

**Measurement caveat.** Type sizes below are estimated from scaled screenshots.
The *ratios* (number vs. label vs. heading) are reliable; the absolute pixel
figures are ±2px and should be read as "about". Where I could not verify
something I say so rather than guessing.

---

## Part 1 — Synthesis

### 1.1 The industry grammar (where 3 or 4 of 4 converge)

These are the conventions. Departing from them costs familiarity and buys
nothing.

| # | Convention | Toast | Square | Lightspeed | TouchBistro |
|---|---|---|---|---|---|
| 1 | Left sidebar nav, icons + labels, 10–16 visible items | ✓ | ✓ | ✓ | ✓ |
| 2 | A **global scope/date control strip** immediately under the page title | ✓ | ✓ | ✓ | ✓ |
| 3 | Every metric carries a **named comparison** to a prior period | ✓ | ✓ | ✓ | ✗ |
| 4 | Sales views **lead with a chart**, above or beside the numbers | ✓ | ✓ | ✓ | ✓ |
| 5 | Cards have a **titled header zone**, visually distinct from the body | ✓ | ✓ | ✓ | ✓ |
| 6 | A **caret / "›" affordance** on each card that drills to the full report | ✓ | ✓ | ✓ | ✗ |
| 7 | Tables have an explicit **header row**; numerics right-aligned; totals bold | ✓ | ✓ | ✓ | ✓ |
| 8 | Colour is **one brand hue + green/red for deltas**; everything else greyscale | ✓ | ✓ | ~ | ✗ |
| 9 | Filters are a **horizontal row of pill dropdowns**, not a sidebar | ✓ | ✓ | ✓ | ~ |
| 10 | Export / email lives **top-right of the content area** | ✓ | ✓ | ✓ | ✓ |

Two of these deserve emphasis because they are the ones we are missing entirely:

**The control strip (#2) is the strongest convention in the category.** Toast
puts "🕐 Edit time filter" top-right of the home content and a "Compared to"
selector beside it
([source](https://support.toasttab.com/en/article/Reporting-Best-Practices-Reports-to-Use-After-Your-First-Day-on-Toast)).
Square puts a `Location Chicago` chip above the greeting and `Date Today` /
`Checks Closed` chips inside the Performance group. Lightspeed puts a five-way
segmented control — `Today, Dec 10 | Yesterday | This week | This month | This
year` — as the first thing under the greeting. TouchBistro puts a single date
range picker top-right. **Four out of four.** A back-office page with no visible
scope control reads as unfinished even to someone who cannot say why, because
every other back office they have used has one.

**The named comparison (#3).** Nobody shows a bare number. Toast: `Today
$5,359.15` with `Yesterday ▲20%` in a tinted pill on the same row. Square: card
subtitle `vs Prior Wednesday` and a green/red pill per metric. Lightspeed: card
subtitle `vs. Sunday, Jan 1, 2023` and, under each value, **both** the absolute
and the percentage delta — `-$63,956.70 (-19%)` — in plain red or green text.
TouchBistro shows no comparison at all, and its dashboard is the weakest of the
four largely because of it.

### 1.2 Where they differ, and the tradeoff

**Hero number vs. flat metric grid.** Toast is the only one with a single
dominant figure per card, and even there the ratio is modest (~2.2× the label).
Square's Home is deliberately *flat*: the metric value (~19px semibold) is
essentially the same size as the card title (~20px bold), and the hierarchy is
carried by whitespace and a strong title instead of by scale. Lightspeed sits
between (label ~13px / value ~23px / delta ~11px, ratio 1.75). *Tradeoff:* a hero
number answers one question fast; a flat grid presents six equal questions and
lets the operator choose. Square can afford flat because it has a hero
*sentence* — "Hello! You have $384.23 available." — doing the focusing job.

**Chart-first vs. number-first.** Square's Sales Summary opens with a full-width
area chart, then a ledger table, and has **no KPI tiles at all**. Toast's Sales
Summary opens with three bar charts ("Sales by day", "Day of week", "Time of
day") pinned to the top and explicitly not reorderable, then 17 label/value
cards. Lightspeed nests the chart *inside* the metrics card so the numbers and
their shape are one object. TouchBistro leads with three number cards and then
six donuts. *Tradeoff:* chart-first suits weekly/monthly review; number-first
suits the mid-service glance. Lightspeed's nesting is the most economical answer
and the one most transferable to us.

**Nav chrome.** Lightspeed uses a black sidebar with a purple active pill, a
location switcher, and `Search ⌘K`, with 16 items in three divider-separated
groups. Square uses a white sidebar, 10 flat items, "Search or ask AI" at the
top, utility icons at the bottom. TouchBistro uses a light sidebar with a
three-level accordion (Reports → Dashboards → Sales Dashboard) and ~10px labels.
*Tradeoff:* deep accordions scale to 50+ reports but make everything feel far
away; flat lists feel calm but cap out. Our dark rail (`--sidebar` 0.18/0.115)
is the Lightspeed answer and is fine.

**Surface strategy.** Toast: light grey canvas, white cards, hairline border,
**no shadow**, ~4px radius. Square: white page → light grey *group container* →
white cards inside it, ~12px radius, no border, no shadow — a ladder built by
nesting rather than by elevation. Lightspeed: light grey canvas, white cards,
hairline border, ~8px radius. TouchBistro: **white** canvas with **light grey**
cards — inverted, and the reason its dashboard reads as a wireframe. Ours (grey
canvas 0.965 → white card → shadow → 17px radius) is closest to Lightspeed with
more elevation, which is a defensible modern choice.

### 1.3 What is genuinely good vs. merely common

**Genuinely good, worth stealing:**

- **Square's `Location Chicago` / `Date Today` chip** — a single control that
  shows its label in grey and its value in near-black inside one bordered pill.
  It states the scope and offers to change it in the same object. Far better
  than a bare dropdown.
- **Lightspeed's dual delta** — `-$63,956.70 (-19%)`. The percentage is for
  comparison, the dollar figure is what an owner actually feels. Giving both
  costs one line.
- **Toast's card caret** — a small circular ghost button, top-right of every
  card, tooltip "Cash activity audit", that drills to the full report. Consistent
  on all 17 cards. It makes a summary card feel like a door rather than a
  dead end.
- **Lightspeed's saved views as tabs** — `Original view | Weekends this year |
  Weekends vs. previous year | Compared to last year | More ⌄` as underline tabs
  above the report. Better than a saved-filter dropdown.
- **Lightspeed's inline card nudge** — inside the (empty) Shifts card: a tinted
  row `ℹ Set up more shifts` … `Go to shifts` `✕`. A dismissible setup hint that
  lives where the missing thing would be, not in a page-level banner.
- **Toast's uppercase micro-eyebrow + rule** as a card header (`NET SALES`,
  `CASH ACTIVITY`, `SALES TRENDS`, ~11px, letterspaced, grey, with a hairline
  under it). It separates header from body by *contrast of treatment* rather than
  by size, so it works even in a small card.

**Merely common, or actively dated:**

- **TouchBistro's six donut charts.** Donuts for "Top Sales Categories", "Top
  Shifts", "Tender Types", "Top Menu Categories", "Top Discounts & Voids", "Top
  Menu Items" — each with a legend table underneath that carries all the real
  numbers. The donut adds nothing the legend doesn't; it just costs 200px.
- **TouchBistro's decorative colour.** `Net Sales $12,731.79` in teal,
  `Average Spend $10.23` in orange, on adjacent cards, for no semantic reason.
  Colour that means nothing trains people to ignore colour that does.
- **Marketing inside the dashboard.** Toast's home has a QR-code card promoting
  the Toast Now app sitting in the same grid as Net Sales. Lightspeed's home
  ends in a "Grow your business" carousel of add-on promos, plus a
  "Welcome to your new homepage… Switch back / Give feedback" migration banner
  above everything. Both are a tax the merchant pays for being a customer.
- **Lightspeed's chart axis ticks:** `$64,124 / $54,963 / $45,803 / $36,642…` —
  auto-generated from the max instead of snapped to round numbers. Small, but it
  is the difference between a chart that looks designed and one that looks
  emitted.
- **Lightspeed's weather.** The home header reads `San Francisco · Dec 10 ·
  16:26 · 32.5°F · Boston` — including a temperature, and a city that doesn't
  match the location selector. Decoration masquerading as context.
- **TouchBistro's ~10px sidebar labels and three-level accordion.** Cramped in
  the way 2015 enterprise software was cramped.
- **Clover's gauge.** Vendor screenshots (which are visibly from 2013 — the
  screenshot literally reads `TODAY: MAY 31, 2013`) show a hero *arc gauge* with
  `THIS WEEK $96,128` inside it and an orange goal figure below, above a row of
  four icon tiles. I could not verify Clover's current dashboard; treat this as
  historical only. But the pattern — radial gauge as hero metric — is dead and
  should stay dead.

**The most useful finding of the whole study:** *none of the four back-office
homes has an exception rail.* Not one surfaces "here is what is wrong right
now". Toast's home is three KPI tiles plus a link list. Square's is a balance
sentence plus action buttons plus a metric grid. Lightspeed's is a metric grid
plus best-sellers plus payment methods. TouchBistro's is three tiles plus six
donuts. Our "Needs you now" rail has no equivalent in the category. That is a
genuine differentiator and it should be treated as the page's second-most
important object, not as one card among four.

---

## Part 2 — Prioritised recommendations for our dashboard

Referenced against `app/app/pos-dashboard.tsx`, `app/app/dashboard-modules.tsx`
and the `:root` / `.dark` blocks in `app/globals.css`.

The owner's complaint ("too simple — flat and unfinished rather than deliberately
minimal") is, on this evidence, four specific deficits: **no scope control, no
chart, no interior structure inside cards, and a type scale whose steps are too
small to read as hierarchy.** Fix those four and the page will read as
deliberate. Nothing below asks us to abandon the exception-first thesis.

---

### 1. Widen the type steps so hierarchy is legible (SMALL — highest value per hour)

**The specific defect.** In `AttentionRail` and `ChecksTable` the card heading is
`text-sm font-semibold` (14px/600) and the row title immediately below it is
`text-sm font-medium` (14px/500). **Those differ by 100 weight units and nothing
else.** That is the flatness, precisely located. In `OpsBlock` the value is
`text-xl` (20px) against a `text-[11px]` label — 11px is below every competitor's
floor.

**What the competitors do.**

| | card title | metric label | metric value | ratio (value : label) |
|---|---|---|---|---|
| Square Home | ~20px bold | ~14px | ~19px semibold | 1.36 |
| Lightspeed Home | ~16px semibold + ~11px subtitle | ~13px | ~23px bold | 1.75 |
| Toast Home | ~11px uppercase, letterspaced, grey, + rule | ~13px | ~24px bold | ~1.8 |
| **Ours (OpsBlock)** | **13px semibold** | **11px** | **20px bold** | 1.8 |
| **Ours (Today)** | **13px medium** | — | **36/48px bold** | 2.8–3.7 |

Note what this table says: our *hero* number is more dramatic than anyone's
(36–48px against a 13px label — Toast's is 24px against 13px). The hero is not
the problem. The problem is everything below the hero, where our steps are
14 → 14 → 12 → 11 and the page has nothing between 14px and 20px.

**Concrete changes:**

- `AttentionRail` / `ChecksTable` `<h2>`: `text-sm` → `text-[15px]`, keep
  `font-semibold tracking-tight`. Now 15/600 against a 14/500 row title — a
  readable step.
- `OpsBlock` `<h3>`: keep `text-[13px] font-semibold` but add
  `uppercase tracking-wide text-muted-foreground` (Toast's eyebrow treatment) —
  contrast by *treatment*, which works better than size at 13px. This is a taste
  call between two verified conventions; the alternative is `text-[15px]
  font-semibold text-foreground` (Square's).
- `OpsBlock` stat label: `text-[11px]` → `text-xs` (12px). Value: `text-xl` →
  `text-2xl` (24px). Ratio 2.0, matching Toast and Lightspeed, and 12px is inside
  everyone's floor.
- Add a **subtitle line** under card titles. Square (`vs Prior Wednesday`) and
  Lightspeed (`vs. Sunday, Jan 1, 2023`) both do; Toast puts it inline. Ours has
  none anywhere. Cheapest version: in `TodayModule`, move
  `"{saleCount} sales · net of refunds, training excluded"` up to sit directly
  under a `Sales today` title as an 11–12px grey subtitle, so the header zone is
  two lines like everyone else's.

*Evidence:* Square Dashboard Home render; Lightspeed Sales metrics card
(`article_attachments/31742098425115`); Toast home
(`0EMPV00000hxI8D`) and Toast card header (`0EM4W000008gHm8`).

---

### 2. Add a scope/control strip under the page title (MEDIUM)

**Convention strength: 4 of 4.** This is the most-violated convention we have.
Our page header is a business name, a date sentence, and two buttons — no
indication that the numbers are scoped, and no way to change the scope.

**Minimum viable version, and it should be real, not decorative:** a row directly
under the `<h1>` containing

- a Square-style scope chip: bordered pill, grey label + near-black value —
  `Today  Wed, Sep 10` — which opens Today / Yesterday / This week;
- a comparison chip — `Compared to  Last Wednesday` (Toast has exactly this
  control, labelled "Compared to", offering previous day / same day last week /
  same day last year);
- right-aligned, the existing `Live ops` and `New sale` actions.

Even shipping only `Today | Yesterday` behind it is worth doing: the control's
*presence* is most of its value, and both are cheap because
`getDayBoundsUTC(tz)` already exists and the benchmark query already runs for an
arbitrary day.

**Do not** put a date control on individual cards. All four vendors keep it
global; Toast's per-report gear icon is for card *ordering*, not scoping.

*Evidence:* Toast "Edit time filter" + "Compared to"
([article](https://support.toasttab.com/en/article/Reporting-Best-Practices-Reports-to-Use-After-Your-First-Day-on-Toast));
Lightspeed segmented control (`31742059971227`); Square `Location` / `Date` /
`Checks` chips; TouchBistro date-range picker top-right
(`ProductScreenshot/2e38cbfd…`).

---

### 3. Put one chart in the Today card (MEDIUM — biggest "looks finished" delta)

**The page currently contains zero data visualisations** other than an 8px
progress bar. All four competitors lead their sales view with a chart. This is
the single largest reason a back office "looks too simple".

**The right chart for us is not a dashboard of charts — it is one.** Follow
Lightspeed's pattern and nest it *inside* the Today card, under the existing
number and pace bar: **cumulative sales through the day, today vs. the same
weekday last week**, as a two-line area/line chart with the current time marked.

Why this one:

- It is the visual form of the pace comparison we already compute, so it adds no
  new concept.
- The data is nearly free: `benchRes` already selects `created_at`. Only
  `todayRes` needs `created_at` added to its select (currently
  `"total, is_training"` in `pos-dashboard.tsx`).
- It answers "am I on track" continuously, where the current bar answers it once.
- It uses `--chart-1` (our blue) and `--chart-2`, which are defined in
  `globals.css` and **currently used nowhere on this page**.

Keep it small — ~120–140px tall, no y-axis chrome, at most three x labels, and
snap any tick to a round number (Lightspeed's `$64,124 / $54,963` ticks are a
worked example of what not to do). Replace the `h-2` progress bar with it; do not
ship both.

*Evidence:* Toast Sales Trends pinned above all cards (`0EM4W000009g86q`);
Square Sales Summary leads with an area chart and has no KPI tiles at all;
Lightspeed chart nested in the Sales metrics card (`31742098425115`).

---

### 4. Give `ChecksTable` an actual table header (SMALL)

Our register is a stack of `<Link>` rows with no column labels — the time column
is `w-16`, the amount column is `w-24`, and neither is named. Every competitor's
table has an explicit header row: Square (`Sales | Returns | Net`, right-aligned,
bold totals row), Lightspeed (sticky header, sort carets, per-column `⋮` menu,
column-picker icon, bold `Total` row), Toast (label/value rows with a rule under
the header and **zebra striping**), TouchBistro (`Total | %`).

**Change:** add a header row on `bg-raised` (the token exists, at 0.972 light /
0.245 dark, and is barely used on this page) with `Time · Check · Status ·
Amount`, 11–12px, uppercase or medium grey, columns aligned to the existing
`w-16` / `flex-1` / `w-24` tracks, numerics right-aligned. Reuse the same
treatment on the `AttentionRail` header band so cards share one header language.

This is the cheapest change on the list that makes a card read as an *object with
internal structure* rather than a white rectangle — which is the literal content
of "flat and unfinished".

*Taste call:* zebra striping. Toast and Lightspeed zebra; Square does not. Our
rows are two-line and already divided by `divide-line`, so zebra would be
redundant. I would not add it.

*Evidence:* Toast zebra rows (`0EM4W000008gHm8`); Square ledger table;
Lightspeed Sales report table (`51729483217051`).

---

### 5. Break the single-column stack; widen the container (MEDIUM)

Right now the page is `max-w-5xl` (1024px) with `space-y-4`: five full-width
bands, identical width, identical 16px gap. It has no silhouette. Lightspeed uses
a wide primary column (Sales metrics + chart) beside a narrow secondary column
(Best sellers, Top payment methods). Toast uses three columns. Square wraps
related cards in a titled grey group container so the page has two levels of
structure, not one.

**Change:**

- `max-w-5xl` → `max-w-7xl` (1280px). 1024px is narrow for a back office; Square
  and Lightspeed both render around 1200–1400.
- At `lg`: two columns, ~62/38. Left: Today (with the chart) then the check
  register. Right: "Needs you now" then the three ops blocks stacked. On
  `sm`/`md` it collapses to the current order, which is already correct.

This is the change most likely to draw an "oh, it looks designed now" reaction,
because it is the one that changes the page's shape rather than its details.

*Evidence:* Lightspeed home two-column (`31742059971227`); Square nested
`Performance` grey group; Toast three-column home.

---

### 6. Show the dollar delta, not only the percentage (SMALL)

`PaceChip` renders `18% behind last Wednesday`. Lightspeed shows **both**:
`-$63,956.70 (-19%)`. Toast shows a % pill but pairs it with the prior-period
value on the same row. An owner converts "18% behind" into dollars in their head
anyway; do it for them.

**Change:** in `TodayModule`, under the pace chip (or as the chip's second line),
add `$412 behind last Wednesday at this time` using
`pace.today - pace.benchmarkSoFar` — a value we already have. Costs one line and
no new query.

*Evidence:* Lightspeed Sales metrics card, six metrics each with absolute + %
delta in red/green plain text.

---

### 7. Make "Needs you now" visually outrank its neighbours (SMALL — taste call)

`AttentionRail`, `TodayModule`, `OpsBlock` and `ChecksTable` all render
`rounded-xl bg-card ring-1 ring-line shadow-elevation`. Identical treatment.
Since **no competitor has an exception rail at all**, there is no convention to
follow here — this is our idea and it should look like it.

Options, in order of restraint:

- a 3px left accent bar in the severity colour of the top signal (red if any
  `blocked`, amber otherwise, neutral when clear) — echoes our own
  `ReadinessPanel`, which already differentiates itself with
  `ring-amber-500/25`;
- `ring-line-strong` instead of `ring-line` when signals exist;
- a count badge in the header band rather than the current
  `{n} open` grey text.

Flagging clearly: **this is a taste call, not a convention.** The evidence
supports *having* the rail (nobody else does, and it is the reason to buy Surge);
it does not tell us how loud it should be.

---

### 8. Add a card-level drill affordance (SMALL — taste call)

Toast puts a small circular ghost caret top-right on all 17 summary cards,
tooltipped with the destination ("Cash activity audit"). Lightspeed puts a blue
`›` top-right on Sales metrics, Best sellers and Top payment methods.
TouchBistro has none — and its cards feel like dead ends.

We are inconsistent: `ChecksTable` has `All orders →` top-right, `AttentionRail`
has nothing, `OpsBlock` has a bottom-left text link, `TodayModule` has no way to
reach `/app/reports`. Pick one and use it everywhere. The Toast/Lightspeed
top-right caret is the convention (3 of 4 in some form) and it frees the bottom
of each card.

Specifically: `TodayModule` should link to `/app/reports` — right now the most
important number on the page cannot be drilled into.

---

### Explicitly do **not** change

- **The written zero states.** Lightspeed's empty home repeats "No data found /
  Try adjusting the date range for more results" across five cards and reads like
  a broken page (`article_attachments/47990521074843`). Our per-module sentences
  — "Nothing to sell yet — add your first item", "No till open yet. Open one to
  start tracking cash." — are better than anything in the category. Keep them.
- **The failed-vs-empty distinction.** No competitor distinguishes "query failed"
  from "no data" anywhere I could see; Lightspeed shows `€0.00` with `No data`
  beneath, which is the closest, and it is a display convention rather than an
  error path. Our `degraded[]` rail footer and per-module `failed` copy are
  unique. Keep.
- **The colour discipline.** Our rule ("colour never carries meaning alone") is
  stricter than Toast's and far stricter than TouchBistro's, which colours
  adjacent metrics teal and orange for decoration. Keep.
- **Week/month totals staying out of the dashboard.** Toast's home shows three
  metrics; Square's Key metrics shows five; Lightspeed's shows six. None shows
  week-to-date and month-to-date alongside today. Our decision to send those to
  `/app/reports` is consistent with the category, not eccentric.

---

## Part 3 — What NOT to copy

1. **Toast's 17-card Sales Summary as a home page.** It is a *report*, and Toast
   knows it — the home page is deliberately three metrics. Do not confuse the two
   surfaces. Our dashboard should never grow toward 17 cards.
2. **Toast's drag-to-reorder "Customize layout" modal.** Toast ships it because
   17 fixed cards serve nobody; the customisation is an apology for the layout.
   The article even admits the order "will not be maintained across browsers,
   devices, or exports". An independent operator will never use it.
3. **In-product upsell in the dashboard grid.** Toast's QR-code "Toast Now" card
   sits in the same three-column grid as Net Sales. Lightspeed ends its home with
   a "Grow your business" promo carousel and heads it with a
   "Welcome to your new homepage… Switch back" migration banner. This is the most
   visible way in which these are vendor dashboards rather than operator
   dashboards.
4. **Donut charts with a legend table underneath.** TouchBistro does this six
   times on one screen. The legend carries every number the donut encodes.
5. **Colour as decoration.** TouchBistro's teal `$12,731.79` next to orange
   `$10.23`, on adjacent cards, meaning nothing.
6. **Radial gauges as the hero metric.** Clover's (2013-era, unverified for
   current builds) hero arc with the week's total inside it and an orange goal
   figure below. A gauge encodes one number in the least legible possible way.
7. **Three-level nav accordions with ~10px labels.** TouchBistro:
   Reports → Dashboards → Sales Dashboard. Our flat dark rail is better; do not
   let it grow accordions.
8. **Auto-computed chart axis ticks.** Lightspeed's `$64,124 / $54,963 /
   $45,803`. Snap to round numbers.
9. **Ambient decoration in the header.** Lightspeed's `32.5°F · Boston` on a
   dashboard scoped to San Francisco.
10. **Dashboards that only read well on a busy Friday.** Every one of these four
    was documented with a full-service, high-volume dataset. Lightspeed's empty
    state, the one screenshot I found of a real zero day, is five identical
    "No data found" messages. Our `pos-dashboard.tsx` header comment already
    names this as the design case; that instinct is correct and is not shared by
    the market.

---

## Part 4 — Per-competitor evidence

### Toast (Toast Web)

**Sources**
- Home page description + screenshot: <https://support.toasttab.com/en/article/Reporting-Best-Practices-Reports-to-Use-After-Your-First-Day-on-Toast>
  (image `https://dwvhey99m5tyy.cloudfront.net/images/ka2PV000000P0UnYAK/0EMPV00000hxI8D`, 1832×656)
- Sales Summary report: <https://central.toasttab.com/s/article/Sales-Summary-Report>
  (redirects to `support.toasttab.com`); images
  `.../ka2PV000000LRtFYAW/0EM4W000009g86q` (Sales Trends),
  `.../0EM4W000008gHm8` (card header + zebra rows),
  `.../0EM4W000008gHlj` (Customize layout modal),
  `.../0EM4W000008gHlF` (date + location filters),
  `.../0EM4W000008gHlU` (filter drawer)

**Landing/home layout.** Light grey canvas. A full-width search field
("What are you looking for…") across the top-left, `🕐 Edit time filter` as a
blue text-link top-right. Below, a **three-column card grid**:

- col 1 — `QUICK ACTIONS`: a card containing seven blue text links with small
  blue icons (Sales summary, Labor summary, Edit menus, Refund check, Employees,
  Time entry management, Instant deposit). No numbers.
- col 2 — `NET SALES`: `Today` / `$5,359.15` / `Real time`, with `Yesterday` and
  a green `▲ 20%` pill right-aligned on the value's row. Below it `DISCOUNTS`,
  same anatomy, `$51.25`, `▲ 15%`.
- col 3 — `LABOR COST % OF NET SALES`: `15.91%`, red `▼ -14%` pill. Below it a
  **QR-code promo card** for the Toast Now app with `Skip` / `Learn more`.

So: **three metrics, equal weight, no hero.** The three metrics chosen are
telling — sales, labour %, discounts — i.e. revenue, its largest cost, and its
largest leak.

**Type scale.** Card eyebrow ~11px uppercase, letterspaced, grey, with a hairline
rule under it. Metric label (`Today`) ~13px grey. Value ~24px bold. Footnote
(`Real time`) ~12px grey. Value:label ≈ 1.8; value:eyebrow ≈ 2.2. Modest.

**Density.** Card padding ~16–20px. Radius ~4px — small, and the most dated thing
about the visual language. Hairline border, **no shadow**. In the Sales Summary,
label/value rows are ~46px tall with **zebra striping**.

**Charts.** `SALES TRENDS` sits at the top of the Sales Summary and is explicitly
pinned ("cannot be moved"): three bar charts — Sales by day (full width), then
Day of week and Time of day side by side. Flat orange bars, no rounding, light
horizontal gridlines only, small grey axis labels, hover tooltip. The **home page
has no chart at all** — the split is deliberate: home = numbers, report = charts.

**Colour.** Toast orange used **only** for chart data. Blue for actions and
links. Green/red only in delta pills. Everything else greyscale. Disciplined.

**Navigation.** Left-hand nav (referenced throughout the docs — "navigate to
Toast Web > Menus using the left-hand navigation"). I could not find a public
screenshot of the full sidebar and am not going to describe one I did not see.

**Date/location controls.** Global. On the home page, `Edit time filter`
(today/yesterday) plus a `Compared to` selector (previous day / same day last
week / same day last year), with "Red and green indicators show growth or
decline". On reports, a date drop-down with presets + `Custom date`, a location
drop-down, `More filters` opening a right-side drawer (hours, days of week,
revenue centres, service areas) with `Apply filters` / `Clear all`, plus a gear
icon for card order and email/download icons — all top-right of the content.

**Tables.** Header = uppercase eyebrow + rule. Body = left label, right-aligned
value, zebra, inline `ⓘ` icons for definitions, a `Columns` button on the
Payments card. Bold totals. Card-level `›` caret drills to the detailed report.

**Empty/zero states.** Not found in public docs.

---

### Square (Square Dashboard / Square for Restaurants)

**Sources**
- Dashboard Home render: <https://squareup.com/us/en/point-of-sale/features/dashboard>
  (image `https://images.ctfassets.net/2d5q1td6cyxq/11zJd5cQixpOn3MoIHN01C/f3e5e5777b917e6e8217c2c82adfc1e2/PD07415_-_USEN_Dashboard_Home.png`)
- Sales Summary render: <https://squareup.com/us/en/point-of-sale/features/dashboard/analytics>
  (image `https://images.ctfassets.net/2d5q1td6cyxq/1PztpcYXZGq9xvAmgPKtZJ/7c502b05f8f46bbd0a2a3630a4837abc/Dashboard_USEN_Macbook_Sales-Summary.png`)
- Text-only articles: <https://squareup.com/help/us/en/article/8579-review-daily-sales-for-your-restaurant>,
  <https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard>,
  <https://squareup.com/help/us/en/article/6433-reporting-with-square-for-restaurants>

**Note:** Square's help centre contains **no UI screenshots at all** — every
article I opened was pure prose. The two images above are marketing renders of
the shipping product, not mockups. Everything visual below comes from them.

**Landing/home layout.** White page. Left sidebar (white, ~220px): `Search or
ask AI` field, then ten flat items with icons + labels (Home, Items & menus,
Orders & payments, Online, Customers, Reports, Staff, Banking, Settings,
`⋯ Add more`), then four utility icons, then an account chip
(`Maison Doux ›`). No group headers, no accordions.

Content, top to bottom:
1. `Location  Chicago` — a bordered chip, grey label + dark value.
2. **A hero *sentence*, not a hero number:** `Hello! You have $384.23 available.`
   (~22–24px semibold).
3. An action row: one filled blue primary `Transfer $384.23 now`, then
   pale-blue-tinted secondaries `Send an invoice` / `Add an item` /
   `Take a payment`, then `⋯`.
4. A **light grey group container** titled `Performance`, holding filter chips
   `Date Today` and `Checks Closed`, and inside it white cards.
5. `Key metrics` card, subtitle `vs Prior Wednesday` — a 2-column grid of five
   metrics (Net sales `$34,038.58` ▲3.48%, Transactions `1,494` ▲1.89%,
   Gross sales ▲3.48%, Returns `$128.40` ▼1.89% in red, Average sale `$49.50`
   ▲1.43%), each with a tinted green/red pill right-aligned.
6. Two cards side by side: `Payment types` (subtitle `by Gross sales`) rendering
   a **single horizontal stacked bar** — blue / pale blue / grey, with
   `75% 13% 12%` beneath — and `Customers`, a label/value list with right-aligned
   values.

**Type scale (measured, ±2px).** Card title `Payment types` ~20px bold; card
subtitle ~13px grey; metric label ~14px grey; metric value ~19px semibold.
**Value : label ≈ 1.36 — the flattest scale of the four**, and it works, because
the card title is doing the hierarchy and there is a lot of air.

**Density.** The most generous of the four. Card padding ~20–24px, gap between
cards ~16px, radius ~12px, **no border and no shadow** — separation comes purely
from the white-on-grey nesting.

**Charts.** Home: one stacked bar, minimal. Sales Summary: leads with a
full-width **area chart** (blue line, pale blue fill, circular point markers),
then `DAY OF WEEK` (bars) and `TIME OF DAY` (area) side by side under uppercase
letterspaced eyebrows. **No KPI tiles anywhere on the Sales Summary** — charts,
then a ledger table.

**Colour.** One hue (Square blue) for data, links and active nav; tinted
green/red pills for deltas; everything else greyscale. The most restrained
palette of the four.

**Navigation.** Left sidebar as above. On Reports, a **secondary left nav**
replaces it: labels only, no icons, tight (~22px rows, ~12–13px type), grouped
under a collapsible `Reports ^`, with 14 items (Sales Summary, Sales Trends,
Payment Methods, Item Sales, Category Sales, Employee Sales, Labor vs Sales,
Discounts, Modifier Sales, Comps, Voids, Taxes, Transaction Status, Gift Cards,
Custom Reports) plus `Disputes` and `Cash Drawers`. Active = blue text on a pale
blue row with a blue left bar. Top bar: hamburger + section title left, Square
logo centred, four icons right (search, chat, bell, help).

**Date/location controls.** Global, as a horizontal row of rounded dropdown
buttons at the top of the content: `‹ 07/07–07/13 ›`, `All Day ⌄`,
`All Locations ⌄`, `Summary ⌄`, then `Advanced Options` as a text link, and
`Export ⌄` right-aligned. On Home the same idea appears as label+value chips.

**Tables.** Column headers right-aligned above numeric columns
(`Sales | Returns | Net`); row labels left; **totals rows bold**
(`Gross Sales`, `Net Sales`), components regular; hairline dividers; **no zebra**;
row height ~40px.

**Empty/zero states.** Not found — no screenshots in the help centre.

---

### Lightspeed Restaurant K-Series (Back Office)

**Sources**
- <https://k-series-support.lightspeedhq.com/hc/en-us/articles/4403208456603-Understanding-the-Dashboard-page>
  (images `article_attachments/31742059971227` full home, `31742098425115`
  Sales metrics card, `31742098427291` Best sellers, `31742059979035`
  Top payment methods)
- <https://k-series-support.lightspeedhq.com/hc/en-us/articles/360054950934-Introduction-to-the-Back-Office>
  (image `article_attachments/47990521074843` — sidebar **and a real empty
  state**)
- <https://k-series-support.lightspeedhq.com/hc/en-us/articles/35539237853467-Understanding-the-Sales-Report-dashboard>
  (image `article_attachments/51729483217051` — report table)

Lightspeed's help centre is the **best public source in the category** — real,
current, annotated screenshots including empty states.

**Landing/home layout.** Black sidebar. Thin white top bar with only
`Help | English | Lightspeed AI | ▦` on the right. Content on a light grey
canvas:

1. A blue migration banner (`Welcome to your new homepage. The old homepage will
   be deactivated soon.` + `Switch back` / `Give feedback`).
2. Greeting `Good afternoon, Stef` left; right, a metadata strip
   `San Francisco · Dec 10 · 16:26 · 32.5°F · Boston`.
3. A **segmented control**: `Today, Dec 10 | Yesterday | This week | This month |
   This year`, active segment a solid black pill.
4. Two columns. Left (wide): `Sales metrics`. Right (narrow): `Best sellers`,
   `Top payment methods`.

`Sales metrics` card: title ~16px semibold, subtitle `vs. Sunday, Jan 1, 2023`
~11px grey, blue `›` top-right. **Six metrics in a 2×3 grid** — Gross sales, Net
sales, Orders, Order average, Covers, Cover average — each rendered as
label / value / **absolute + % delta in red or green plain text**
(`-$63,956.70 (-19%)`, `+$9.29 (+13%)`). Then, *inside the same card*, a
`Gross sales` grouped bar chart with a custom legend that names both periods and
their totals.

**Type scale (measured, ±2px).** Label ~13px grey; value ~23px bold; delta ~11px
coloured; card title ~16px semibold; card subtitle ~11px. Value : label ≈ 1.75.

**Density.** Moderate. Card padding ~20px, radius ~8px, hairline border, minimal
shadow. Report tables ~32–34px rows, zebra-striped.

**Charts.** Grouped vertical bars (blue = current period, orange = comparison) in
the metrics card; a horizontal stacked bar for payment methods with a colour-swatch
legend table. Axis ticks are auto-computed and ugly (`$64,124`, `$54,963`).

**Colour.** The most colourful of the four: blue + orange as a two-series data
pair; blue/orange/purple/green/red as a categorical payment palette; red/green
for deltas; purple for active nav and AI. Legible, but more hues than Toast or
Square.

**Navigation.** Black sidebar: wordmark, location switcher select
(`San Francisco *`), `🔍 Search  ⌘K`, then **16 items in three
divider-separated groups** with icons + labels and `›` chevrons on expandable
ones — Home (active = solid purple pill), Reports, Analytics `New` — / Menu, POS,
Business, Hardware, Operations, Payment, Customers — / Order Anywhere,
Lightspeed Reservations, Inventory, Integration Hub, Financial services.
Expanding `Reports` inserts its children inline (All reports, Sales summary,
Staff performance, Location summary, Sales report, Hourly sales, Reporting
shifts, Reporting automation) rather than opening a second panel.

**Date/location controls.** Global. Home = segmented preset control. Reports = a
horizontal row of pill dropdowns: `📅 Last 7 days ⌄`, `⇄ Compare with ⌄`,
`Day of week ⌄`, `POS users and groups ⌄`, `Shifts ⌄`, `⇄ All filters`. Location
lives in the sidebar switcher, not in the content.

**Tables.** Sales report: H1 + a one-line subtitle with inline glossary links
("Understand terms like Gross sales and Net sales"); **saved views as underline
tabs** (`Original view | Weekends this year | Weekends vs. previous year |
Compared to last year | More ⌄`); a grey toolbar band with `More actions ⌄` and
`Download ⬇`; then the filter pill row; then a second tab strip inside the table
card (Accounting groups | Statistics group | Order profiles | Floor plans |
Configurations | Devices | Payments | Shifts). The table itself has a sticky
header with sort carets and per-column `⋮` menus, a column-picker icon at far
right, zebra rows, right-aligned numerics, and a bold `Total` row.

**Empty/zero states — the most useful screenshot in the study
(`47990521074843`).** With no data, `Sales metrics` shows `€0.00` under each
label with the word `No data` beneath — so a real zero and a missing value are
distinguished. But every other card shows the *same* sentence: `No data found /
Try adjusting the date range for more results` (Shifts),
`No data for yesterday.` (Best sellers), `No data for yesterday.` (Top payment
methods), `No data found / Try adjusting your filters to have more results.`
(chart). Five near-identical messages down one page reads as a broken product
rather than a quiet day. **This is the failure mode our written zero states
already avoid.** The one good touch: an inline tinted nudge row inside the empty
Shifts card — `ℹ Set up more shifts` … `Go to shifts` `✕`.

---

### TouchBistro (TouchBistro Cloud)

**Sources**
- <https://www.touchbistro.com/features/reporting-analytics/> — marketing page.
  Its four "screenshots" are **stylised illustrations with grey placeholder
  bars**, not real UI. Not usable as layout evidence.
- **Real product screenshot** (vendor-supplied, showing
  `cloud.touchbistro.com/reporting/dashboard#start` in the URL bar):
  `https://gdm-catalog-fmapi-prod.imgix.net/ProductScreenshot/2e38cbfd-ca1d-419e-a09b-76053cd05405.png`,
  via <https://www.softwareadvice.com/restaurant/touchbistro-profile/>
- <https://help.touchbistro.com/s/article/sales-statistics-charts> — public but
  screenshot-free.

**Could not verify:** `help.touchbistro.com/s/article/cloud-reporting-site-basics`
and every `touchbistro.com/help/articles/...` URL now **redirect to a customer
login wall**. I did not attempt to sign in. The screenshot above is dated (the
sample data reads 2020-06-15 – 2020-06-21) and TouchBistro may have redesigned
since; **treat this section as the most likely to be stale.**

**Landing/home layout.** Light sidebar, white content canvas. A **single control**
top-right: `📅 2020-06-15 - 2020-06-21 ⌄`. Nothing else in that bar — no
comparison selector, no export, no location switcher.

Row 1 — three summary cards of equal weight: `Net Sales`
(Sales Total `$12,731.79` / Tips `$1,063.77` / Gratuities), `Average Spend`
(Per Seat `$10.23`), `Customers` (Parties / Bills / Seats, all `1,245`).

Rows 2–3 — six cards, **each a donut chart with a legend table beneath**: Top
Sales Categories, Top Shifts, Tender Types, Top Menu Categories, Top Discounts &
Voids, Top Menu Items. The legend carries category, total and % — every number
the donut encodes.

**No comparison to any prior period anywhere on the page.** The only one of the
four with no delta at all.

**Type scale.** Card title ~13px dark; sub-labels ~9–10px grey; values ~18–20px.
Legend text ~9px. The smallest type of the four and the flattest hierarchy.

**Density.** Tight. Small padding, ~2–3px radius, hairline border, no shadow.
Roughly nine cards visible in one viewport.

**Colour.** Teal ramp + orange + navy, applied categorically in the donuts —
fine — and **decoratively in the summary cards**: `Net Sales` in teal,
`Average Spend` in orange, adjacent, meaning nothing. Also note the **inverted
surface treatment**: the canvas is white and the cards are light grey, so cards
recede instead of lifting. This single choice is most of why the page looks like
a wireframe.

**Navigation.** Light sidebar (~200px), logo top, then icons + labels: `Admin`,
`Reports` (active — a solid **teal filled row**, white text), then a nested,
expanded group `Dashboards ▾` with children `Sales Dashboard` (active, teal
text + teal left bar) and `Weekly Targets`, then collapsed accordions `Sales`,
`Labor`, `Menu`, `Audit`, `Staff`, `Discounts and Voids`, `Scheduled Reports`,
then `Partners`, `Settings`, `Help`. **Three levels of hierarchy, ~10px labels.**

**Tables.** Legend tables only on this screen: tiny grey column headers
(`Sales Category | Total | %`), right-aligned numerics, no dividers, no zebra,
coloured legend dots.

**Empty/zero states.** Not found.

---

### Clover — historical only, unverified

Vendor screenshots via <https://www.softwareadvice.com/retail/clover-profile/>
(`ProductScreenshot/bfa2d4bb-…` and `3ec3c3ea-…`) show a dashboard whose sample
data reads `TODAY: MAY 31, 2013`: a hero **arc gauge** with `THIS WEEK $96,128`
inside it and an orange goal figure `$127,269` beneath, a `‹ PREVIOUS WEEK`
control, then a `PROGRESS THIS WEEK` row of four icon tiles (Revenue, Ticket
Size, New Customers, Returning Customers) and a `STORIES FOR WEEK OF MAY 26`
section with two auto-generated insight cards. The second image shows
`Clover Home` as a grid of large skeuomorphic app icons (Orders, Customers,
Reporting, Cash Log, App Market, Help, Printers, Inventory, Employees, Setup)
with a `More Apps` upsell panel.

`clover.com/pos-systems/reporting` redirects to the marketing home page, so I
**could not verify Clover's current dashboard**. Do not treat the above as
evidence of what Clover ships today. SpotOn and Revel were not researched — out
of scope once the four primaries were covered in depth.

---

## Part 5 — Things I could not verify

- **Toast's left navigation.** Described repeatedly in Toast's docs ("left-hand
  navigation", "select Support Center from the left menu") but I found no public
  screenshot of it. Item count, grouping and treatment are unknown.
- **Toast and Square empty/zero states.** Neither documents them publicly.
  Square's help centre carries no screenshots at all.
- **TouchBistro's current cloud dashboard.** The help centre is behind a customer
  login as of this session; the screenshot analysed is vendor-supplied with 2020
  sample data.
- **Clover's current dashboard.** See above.
- **Exact pixel type sizes.** Derived from scaled screenshots; ratios are sound,
  absolutes are approximate.
- **Interaction behaviour** — hover, focus, loading and skeleton states, motion.
  Static screenshots cannot show these, and none of the four documents them.
