# Site audit — repositioning the marketing site POS-first

Owner instruction: *"fix up the website for now remove the payment terminals and
list that as coming soon and target the site to showcase our point of sale mainly"*

Written before any code changed, on `site-pos-first` (cut from `admin-redesign`).

---

## 1. What actually ships today

The marketing site is not the product. Before deciding what the site may claim,
here is what is really in the repo. Every row below was read in the code, not
assumed.

| Claim the site could make | Verified in |
| --- | --- |
| Register / ring up a sale | `app/app/pos/` |
| Floor plan + table service | `app/app/floor/`, `app/app/pos/floor-client.tsx` |
| Kitchen display (KDS) + stations | `app/app/kitchen/` (`kitchen-client.tsx`, `stations-actions.ts`) |
| Menu / catalog builder | `app/app/catalog/`, `docs/menu-builder-audit.md` |
| Orders hub | `app/app/orders/` |
| Reports + exports | `app/app/reports/`, `app/app/exports/` |
| Inventory, purchasing, waste, recipes | `app/app/inventory/`, `purchasing/`, `waste/`, `recipes/` |
| Barcode scanning + low-stock warnings | `app/app/pos/barcode-scanner.tsx`, `app/app/inventory/`, `app/app/pos/register-client.tsx` |
| Staff, scheduling, time clock, attendance | `app/app/staff/`, `schedule/`, `clock/`, `attendance/`, `labor/` |
| Reservations **and waitlist** | `app/app/reservations/`, `lib/services/reservations.ts` |
| Online ordering | `app/order/[businessId]/online-order-client.tsx` |
| QR order + pay at table | `app/order/[businessId]/[elementId]/`, `app/app/floor/qr-codes/` |
| Self-serve kiosk | `app/kiosk/[businessId]/` |
| Customer-facing display | `app/cfd/[businessId]/` |
| Digital menu board | `app/menu/[businessId]/` |
| Multi-location roll-up | `app/app/locations/` |
| Roles / permissions / audit | `lib/services/permissions.ts`, `route-access.ts`, `app/app/audit/` |

**Card processing.** There *is* a processor integration — `lib/services/finix.ts`
— but it is env-gated (`isFinixConfigured()`), and `sandboxFallbackMerchantId()`
returns `null` in live, i.e. every business needs its own approved merchant
before it can charge a card. Nothing in the repo establishes that we are a live,
board-approved processor with a published rate card. That is exactly the state
the owner described as "coming soon", and it is why the whole rate story has to
come off the site rather than be softened.

### Claimed on the old site, could NOT verify

* **`2.5% + 15¢` / `$0.30 Interac` / `2.9% + $0.30` online** — no rate table,
  pricing config or interchange model anywhere in the repo. These are commercial
  numbers that exist only in marketing copy.
* **`$10 one-time setup` and `$35 dispute fee`** — same; no billing code.
* **`Advanced $29/month`, `30-day free trial`** — no plan/billing/entitlement
  code found. The tier names do not map to anything in `lib/modules/registry.ts`.
* **"Appointments & bookings"** (claimed on `/pos` and `/pricing`) — no
  appointments module exists. `lib/modules/modes.ts` declares the
  `appointments` mode with **`status: "soon"`**, so the product itself already
  calls this unbuilt and only the marketing site disagreed.
  `app/app/reservations/` is restaurant covers + a waitlist, which is a
  different feature; the pages now name that instead.

*(Corrected after first pass: **barcode scanning** and **low-stock warnings**
were briefly listed here as unverifiable. They are real —
`app/app/pos/barcode-scanner.tsx` plus the low-stock path in
`app/app/inventory/` and `app/app/pos/register-client.tsx` — and both claims
were restored to `/pos`, `/pos-for-retail` and `/pricing`. The first search
missed them because of a shell-quoting error, which is the argument for
verifying a removal as carefully as an addition.)*
* **"We supply terminals / thermal printers / in-person terminal setup"** — a
  hardware sourcing doc exists (`docs/hardware-sourcing.md`) but nothing ships.
* **"Custom CRM / SaaS builds"** — an agency service line, unverifiable from
  code. Left alone; it is a services claim, not a product claim.

All of the above are reported to the owner rather than silently kept.

---

## 2. Route inventory and the decision for each page

No page is deleted. No redirect is added. Every URL in the sitemap still
returns 200 — the SEO value of a ranking landing page is in the URL, and
deleting one throws away the traffic and leaves a 404. Every page here is
handled by **(a) reposition the content to lead with POS while keeping the
page's keyword intent**, and several are additionally **(b) demoted in
navigation and internal linking**. Option (c), 301 to the nearest survivor, was
not needed for any page.

| Route | Old H1 | Target keyword | Subject | Decision |
| --- | --- | --- | --- | --- |
| `/` | Stop overpaying to get paid. | payment processing + POS GTA | both | **(a) Reposition.** New POS-led hero, section order rebuilt around the register. Savings calculator removed. Payments become a labelled "coming soon" band. |
| `/pricing` | One rate. No surprises. | payment processing rates | payments | **(a) Reposition.** Rate card, rate comparison table and payments FAQ removed. Page now prices the POS software. Payments priced "not yet — coming soon". |
| `/pos` | A full register, built into your payments. | free POS system small business | POS | **(a) Reposition + promote.** Becomes the flagship. Rewritten against what actually ships (floor plan, KDS, menu, orders, reservations/waitlist, online + QR ordering, staff/time clock, reports). Unverifiable claims (appointments, barcode) removed. |
| `/pos-for-restaurants` | A restaurant POS that keeps up with the rush. | POS for restaurants | POS | **(a) Reposition (light) + promote to nav.** Already POS-first; strip "built into your payments" and the rate paragraph. |
| `/pos-for-retail` | A retail POS that keeps your shelves honest. | POS for retail | POS | **(a) Reposition (light) + promote to nav.** Same treatment; drop barcode claim. |
| `/payment-processing-toronto` | Payment processing in Toronto, without the junk fees. | payment processing toronto | payments | **(a) Reposition + (b) demote.** Keyword kept in title and H1 ("Point of sale in Toronto — payment processing coming soon"), body leads with POS for Toronto shops, estimator replaced with the coming-soon panel. Sitemap priority dropped 0.8 → 0.6. |
| `/payment-processing-mississauga` | Payment processing in Mississauga, minus the junk fees. | payment processing mississauga | payments | **(a) + (b)**, identical treatment. |
| `/merchant-services-durham` | Merchant services for Durham Region, done straight. | merchant services durham | both | **(a) + (b).** "Merchant services" is broad enough to carry POS honestly; H1 leads with the POS, payments labelled coming soon. |
| `/square-alternative` | A Square alternative with a lower rate and a local human. | square alternative | both | **(a) Reposition.** Square is a processor *and* a POS, so this converts naturally into a POS-vs-POS comparison. Rate rows out, capability rows in. |
| `/clover-alternative` | A Clover alternative without the app fees or lock-in. | clover alternative | both | **(a) Reposition.** Same as Square — Clover is a POS. App-fee/lock-in angle survives intact as a software argument. |
| `/moneris-alternative` | A Moneris alternative built for local business — not lock-in. | moneris alternative | payments | **(a) Reposition + (b) demote.** See §3. |
| `/stripe-alternative` | A Stripe alternative made for in-person business. | stripe alternative | payments | **(a) Reposition + (b) demote.** See §3. |
| `/td-merchant-solutions-alternative` | A bank-processor alternative without the contract or rental fees. | td merchant solutions alternative | payments | **(a) Reposition + (b) demote.** See §3. |
| `/contact` | Let's talk. | contact | both | **(a) Light.** Metadata and hero sub lead with the POS. |
| `/book` | Book your free savings call. | book a call | payments | **(a) Reposition.** "Savings call" → POS demo. Wizard field keys untouched so the server action keeps working. |
| `/guides` | Straight answers on payments & POS. | payments guides | payments | **(b) Keep, demote.** Educational fee content, not a product claim. Stays indexed, moves down the footer. |
| `/guides/lower-credit-card-processing-fees-ontario` | (guide title) | lower processing fees ontario | payments | **Keep.** One present-tense Surge rate claim removed (§4). |
| `/guides/interac-vs-credit-card-fees` | (guide title) | interac vs credit card fees | payments | **Keep.** One present-tense claim removed (§4). |
| `/guides/how-to-read-your-merchant-statement` | (guide title) | read merchant statement | payments | **Keep unchanged.** Its `2.5% + 15¢` is hypothetical ("if a processor offers…"), not a Surge claim. |
| `/guides/what-is-a-junk-fee-on-a-merchant-account` | (guide title) | merchant account junk fee | payments | **Keep unchanged.** No Surge rate claim. |
| `/guides/flat-rate-vs-interchange-plus-pricing` | (guide title) | flat rate vs interchange plus | payments | **Keep unchanged.** Same — illustrative number only. |

Non-page routes in the group: `opengraph-image.tsx` (root; every other segment
re-exports it), `twitter-image.tsx`, `layout.tsx`, `site-nav.tsx`, `ui.tsx`,
`local-landing.tsx`, `jsonld.tsx`, `reveal.tsx`, `surge-mark.tsx`,
`savings-estimator.tsx`, `shared-metadata.ts`, `actions.ts`.

---

## 3. The three pure-processor comparison pages

`square-alternative` and `clover-alternative` are comparisons against products
that are both processors and POS systems, so they reposition with no strain —
the reader is already shopping for a till.

`moneris-alternative`, `stripe-alternative` and
`td-merchant-solutions-alternative` compare against pure processors, and the
honest options were: reposition, demote, or 301.

**Decision: keep all three, reposition, demote. No redirects.** Reasons:

1. The search intent is not purely "who processes my cards". Someone typing
   "Moneris alternative" is leaving a merchant account, and the thing that
   makes leaving painful is usually the *terminal and the till*, not the rail.
   A POS-led answer is a real answer to that query, not a bait-and-switch —
   provided the page says plainly that we are not a processor yet, which it now
   does, above the fold.
2. 301ing three ranking URLs onto `/pricing` at once is the classic
   mass-consolidation pattern Google tends to treat as a soft 404, and it would
   discard the link equity rather than move it.
3. Demotion is reversible. When payments launch, these three pages are already
   sitting on their keywords and only the coming-soon band has to change.

What "demote" means concretely: they leave the top footer group for a
lower "Compare" group, their sitemap priority drops 0.8 → 0.6, and the
in-body internal links from the location pages and guides now point at `/pos`
and the industry pages first.

The alternative I rejected: deleting
`td-merchant-solutions-alternative` outright. It is the weakest fit (a bank
merchant account has no POS story at all), but it is also the one page in the
set with zero replacement, and a 404 is strictly worse than a page that says
"here is the POS, payments are coming".

---

## 4. Every payments claim found, and what happens to it

| # | Claim | Where | Handling |
| --- | --- | --- | --- |
| 1 | `2.5% + 15¢` headline rate | `/pricing` ×5, `/` hero badge, all 3 location pages, all 5 alternative pages, 1 guide | Removed everywhere. No rate appears on the site. |
| 2 | `Interac $0.30 flat`, `Online & keyed-in 2.9% + $0.30` | `/pricing` rate table | Removed with the table. |
| 3 | `$10 one-time setup`, `$35 dispute fee` | `/pricing` | Removed. |
| 4 | Live savings calculator quoting 2.5% + 15¢ vs 2.9% + 30¢ | `savings-estimator.tsx`, used on `/` and 7 landing pages | **Component deleted** and every usage replaced with a `PaymentsComingSoon` panel. A live calculator quoting a rate we do not offer is the single worst thing on the site. |
| 5 | "Accepted payment methods" strip (Tap, Chip & swipe, Apple Pay, Google Pay, Interac, Visa, Mastercard) | `/` | Removed from `/`; the same list reappears only inside the coming-soon panel, in future tense. |
| 6 | "Every way they pay — tap, chip, swipe… all built in" | `/pos` feature grid | Replaced with a real shipped feature. |
| 7 | Terminal supply + in-person terminal setup | `/`, `/pos` hardware band, 3 location pages | Terminal/hardware copy removed; the in-person *setup and training* offer stays (that is a service we can do). |
| 8 | "Surge vs the big processors" rate comparison table | `/pricing` | Removed. |
| 9 | Rate rows in the 5 competitor tables | alternative pages | Replaced with POS capability rows. |
| 10 | Payments FAQ (other fees, keyed-in, lock-in) | `/pricing` | Rewritten as POS + payments-timing questions. |
| 11 | `Service` JSON-LD `"name": "Payment processing"` with an `Offer` carrying the rate | `/pricing` | Retyped to POS software; the priced `Offer` is gone. |
| 12 | `FinancialService` JSON-LD for the business | `jsonld.tsx` (site-wide) | Retyped `ProfessionalService` + description rewritten. A schema that tells Google we are a payment processor is a structured-data claim, not just copy. |
| 13 | `localService()` schemas named "Payment processing in <city>" | 3 location pages | Renamed to POS, descriptions rewritten. |
| 14 | OG card headline "Stop overpaying to get paid." + "Transparent payment processing & POS" | root `opengraph-image.tsx` (inherited by every page) | Rewritten POS-first. |
| 15 | Titles/descriptions leading with payment processing | layout + 10 pages | Rewritten POS-first. |
| 16 | "Book your free savings call" / "Book my free savings call" CTA | `/`, `/book`, `ui.tsx` `CtaBand`, `local-landing.tsx` `LandingCTA` | Rewritten to a POS demo. |
| 17 | "Surge prices Interac as Interac" | guide: interac-vs-credit-card-fees | Present-tense claim removed; guide keeps its educational conclusion. |
| 18 | "the exact dollar difference against Surge's flat 2.5% + 15¢" | guide: lower-credit-card-processing-fees-ontario | Removed. |
| 19 | Footer strapline "Lower card processing rates and software that shows your savings" + "Smarter payments for local business" | `layout.tsx` | Rewritten POS-first. |
| 20 | Nav utility bar / book-wizard "Lower payment rates" interest option | `site-nav.tsx`, `book-wizard.tsx` | Interest option relabelled "Payments (when it launches)"; POS options move to the top. |

**Not touched, and why:** the five `/guides` articles remain articles about how
card processing is priced in Canada. They never say Surge processes cards
(after #17/#18), they are genuine ranking assets, and the whole fee argument is
the reason a merchant listens to us when payments do launch.

**Legal / compliance text:** none found in the marketing group — no terms,
privacy, PCI or cardholder-agreement copy lives here. The two fine-print
disclaimers that do exist (`LandingDisclaimer`, "Typical figures shown for
comparison") are competitor-comparison hedges; they are being narrowed along
with the claims they hedge, and that narrowing is flagged rather than silent.

---

## 5. Pricing — what is honest to publish

`/pricing` today prices card processing. After this change it prices software.

* **Payments: no price.** There is no approved rate to publish, so the page says
  that in plain words and gives no number. Nothing is invented.
* **POS software: the existing published tiers are kept, not re-invented.**
  Basic (free), Advanced ($29/month), Custom (quoted). These numbers were
  already live on the site; inventing new ones — or deleting a price the
  business has already published — would both be worse than leaving them.
* **One thing the owner must decide:** Basic was advertised as *"Free — with
  payments"*. That bundle no longer has a payments leg. The page now reads
  "Free" without the condition, which is the *more generous* reading and so not
  misleading to a customer, but it is a commercial decision that belongs to the
  owner, not to this change. Flagged in the report.
* The 30-day Advanced trial is kept as-is for the same reason (already
  published), and flagged as unverifiable in code.

---

## 6. Palette note

The marketing routes deliberately sit outside the tokenised admin palette.
They carry **no OKLCH tokens at all** and use hard-coded hex —
`#0A2540` navy, `#1A2B3C` ink, `#42566B` body, `#7A8CA0` faint, `#D9E1EA` line,
`#F4F7FA` surface, `#1B6DC1` link, `#1E7B4D` green — documented at the top of
`app/(marketing)/ui.tsx`.

This change **matches that convention rather than half-migrating it.** Moving
the marketing site onto `--brand` / OKLCH is a real piece of work with its own
contrast budget, and doing half of it would leave two palettes fighting on the
same page. The kit blue `#008CFF` therefore continues to appear exactly where
it already does — in the logo artwork (`components/brand/surge-logo.tsx`,
`surge-mark.tsx`) and the OG card's mark — and the surrounding UI stays navy.

Flat colour is preserved: no gradient is introduced anywhere in this change.
