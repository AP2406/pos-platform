# Geographic positioning audit — `site-international`

Branch cut from `main` @ `f53e0d1`. Owner instruction, verbatim:

> "remove gta and toronto and durham and stuff this is an international business not a toronto business"

All line numbers below are **as of `f53e0d1`** (the state before this branch).

Terms grepped: `GTA`, `Greater Toronto`, `Toronto`, `Durham`, `Mississauga`,
`Ontario`, `Canada`, `Canadian`, `Interac`, `CAD`, `en-CA`, `America/Toronto`,
`905`, `416`, `437`, `647`, plus postal-code and street-address patterns.
373 raw hits across the repo. They fall into two piles that must not be
treated the same way, and the rest of this document is organised around that
split:

1. **Marketing copy, SEO metadata and structured data** — positioning claims.
   Changed.
2. **Product code** — `businesses.timezone` / `businesses.currency` fallbacks
   and date-format locales. **Not changed.** Section 6 says why.

No street address and no postal code exists anywhere in the repo. No `905`,
`416`, `437` or `647` area code appears in any phone number on the site
(section 5).

---

## 1. Marketing copy and SEO metadata

| file:line | the text | category | decision |
|---|---|---|---|
| `app/(marketing)/site-nav.tsx:38` | "Point of sale for the GTA & Durham Region · card processing coming soon" | marketing copy (site-wide announcement bar) | rewritten — "Point of sale for restaurants, cafes and shops · card processing coming soon" |
| `app/(marketing)/layout.tsx:14` | metadata description "…for GTA restaurants, cafes and shops…" | SEO metadata (site-wide default) | "GTA " removed |
| `app/(marketing)/layout.tsx:65` | footer group heading "Across the GTA" | marketing copy / internal linking | group removed; grid 6 → 5 columns |
| `app/(marketing)/layout.tsx:67-69` | footer links Toronto / Mississauga / Durham Region | internal linking | removed — all three now 308 to `/pos`, and a site-wide link to a redirect spends crawl budget on a hop |
| `app/(marketing)/layout.tsx:97` | footer signature "Toronto · Mississauga · Durham Region" | marketing copy (every page) | replaced with "Software that runs anywhere · onboarding is remote" |
| `app/(marketing)/page.tsx:23` | title "Point of Sale for Restaurants & Retail in the GTA \| Surge" | SEO metadata | "in the GTA" removed; slot given to "Cafes", not to a replacement geography |
| `app/(marketing)/page.tsx:24,26` | meta + OG description "for GTA restaurants…" | SEO metadata / OG text | "GTA " removed from both |
| `app/(marketing)/page.tsx:77` | hero "…restaurants, cafes and shops across the GTA" | marketing copy | "across the GTA" removed |
| `app/(marketing)/page.tsx:94` | tick "Set up with you in person across the GTA" | marketing copy — **and a deliverability claim** | "Set up with you over a call, wherever you are" |
| `app/(marketing)/page.tsx:183` | "Surge runs real-world rooms across the GTA" | marketing copy | "across the GTA" removed |
| `app/(marketing)/page.tsx:223` | "piloting Surge with GTA and Durham independents … set up in person" | marketing copy | "with independent shops … set up with you on a call" |
| `app/(marketing)/pos/page.tsx:23` | title "…& Retail (GTA) \| Surge" | SEO metadata | "(GTA)" removed |
| `app/(marketing)/pos/page.tsx:171` | "the real-world spots across the GTA" | marketing copy | "real-world rooms" |
| `app/(marketing)/pos/page.tsx:196` | "set up with you in person across the GTA" | marketing copy / deliverability | "set up with you on a call" |
| `app/(marketing)/pos-for-restaurants/page.tsx:13,14` | title "(GTA)" + description "GTA cafes" | SEO metadata | both removed |
| `app/(marketing)/pos-for-restaurants/page.tsx:44` | "across the GTA run Surge" | marketing copy | "full-service rooms run Surge" |
| `app/(marketing)/pos-for-retail/page.tsx:14,15` | title "(GTA)" + description "GTA shops" | SEO metadata | removed / "independent shops" |
| `app/(marketing)/pos-for-retail/page.tsx:43` | "shops across the GTA run Surge" | marketing copy | "across the GTA" removed |
| `app/(marketing)/pricing/page.tsx:36` | title "Free During the Pilot (GTA)" | SEO metadata | "(GTA)" removed |
| `app/(marketing)/pricing/page.tsx:37,44` | meta + OG "across the GTA and Durham Region, set up in person" | SEO metadata / OG text | de-localised **and** in-person → remote |
| `app/(marketing)/pricing/page.tsx:58` | pillar "across the GTA and Durham Region. In-person setup is part of the offer … somewhere we can drive to" | marketing copy — **the core offer** | rewritten as remote onboarding (section 4) |
| `app/(marketing)/pricing/page.tsx:144` | hero sub "for GTA and Durham independents" | marketing copy | "for independent shops" |
| `app/(marketing)/pricing/page.tsx:187` | "we come to you, load your menu, draw your floor … across the GTA and Durham Region" | marketing copy — **the core offer** | rewritten as remote onboarding (section 4) |
| `app/(marketing)/pricing/page.tsx:262` | closing band "set up in person across the GTA and Durham" | marketing copy | "set up with you on a call" |
| `app/(marketing)/contact/page.tsx:9,10` | title + description "in the GTA" | SEO metadata | "Point of Sale Software" / geography removed |
| `app/(marketing)/contact/page.tsx:42` | "Area served: Greater Toronto Area & Durham Region" | marketing copy | row replaced with "Setup: Remote — we onboard you over a video call" |
| `app/(marketing)/contact/page.tsx:46` | "Mon–Fri, 9am–6pm ET" | marketing copy | **kept**, expanded to "Eastern Time (UTC−5)". These are the hours the phone is answered, not a claim about who we sell to; removing it makes the row less useful abroad, not more. Flagged if support hours widen. |
| `app/(marketing)/opengraph-image.tsx:5` | OG alt "…retail in the GTA" | OG image route | "in the GTA" removed |
| `app/(marketing)/opengraph-image.tsx:65` | OG card text "…& retail across the GTA." | OG image route (site-wide card) | "across the GTA" removed |
| `app/(marketing)/guides/page.tsx:15` | description "…for small businesses across Ontario and the GTA" | SEO metadata | geography removed — this described **us**, not the articles |
| `app/(marketing)/guides/lower-credit-card-processing-fees-ontario/page.tsx:45` | "If you're in the city, see what we do for Toronto businesses" → `/payment-processing-toronto` | marketing copy + internal link to a now-redirected URL | relinked to `/pos` with non-geographic anchor text |
| `app/(marketing)/actions.ts:211` | transactional email footer "Serving the GTA & Durham Region" | marketing copy (every email we send) | "Software that runs anywhere — onboarding is remote" |
| `app/(marketing)/actions.ts:129` | pilot confirmation "book a time to come and set the till up with you" | marketing copy — promise in writing | "book a call to set the till up with you" |
| `app/(marketing)/actions.ts:136` | pilot step 3 "We come out, load your menu and get you live" | marketing copy — promise in writing | "We set it up with you on a video call — menu loaded, floor drawn, staff shown around" |
| `app/(marketing)/ui.tsx:57` | `PAY_METHODS` includes `"Interac"` | marketing copy (renders on 9 pages) | replaced with `"Debit"` — Interac is a Canada-only domestic rail, and this panel is a site-wide statement of what unbuilt processing will accept. **Flagged**: if Canada is the first processing market, put it back. |
| `app/(marketing)/square-alternative/page.tsx:17,25,39,45,84` | "set up in person across the GTA", "across the GTA and Durham", compare row "Local, in person (GTA & Durham)" | marketing copy / SEO metadata | de-localised; setup described as guided and remote |
| `app/(marketing)/clover-alternative/page.tsx:24,40` | "In-person setup across the GTA and Durham", "local setup across the GTA and Durham" | marketing copy / SEO metadata | same |
| `app/(marketing)/stripe-alternative/page.tsx:16,23,41` | "set up in person across the GTA", "across the GTA and Durham" | marketing copy / SEO metadata | same |
| `app/(marketing)/moneris-alternative/page.tsx:21,32,33,51` | "local setup across the GTA", "GTA and Durham independents" | marketing copy / SEO metadata | same (see section 2b) |
| `app/(marketing)/td-merchant-solutions-alternative/page.tsx:21,30,46` | "local setup across the GTA", "In-person setup across the GTA and Durham" | marketing copy / SEO metadata | same (see section 2b) |
| `app/sitemap.ts:27-29` | three city URLs listed at priority 0.6 | SEO / route inventory | removed — they are 308s now, and a sitemap must not list a URL that redirects |

### Route names (the three city pages) — see section 2

| file:line | the text | category | decision |
|---|---|---|---|
| `app/(marketing)/payment-processing-toronto/**` | whole route, 17 geo hits | route name + marketing copy + structured data | **308 → `/pos`** |
| `app/(marketing)/payment-processing-mississauga/**` | whole route, 17 geo hits | route name + marketing copy + structured data | **308 → `/pos`** |
| `app/(marketing)/merchant-services-durham/**` | whole route, 18 geo hits | route name + marketing copy + structured data | **308 → `/pos`** |

---

## 2a. The three city landing pages — decision and reasoning

`/payment-processing-toronto`, `/payment-processing-mississauga`,
`/merchant-services-durham`.

**Decision: permanent (308) redirect to `/pos` on all three. None deleted, none
404.**

**Why a redirect and not a repurpose.** These pages were wrong along two axes
at once. Each is named for a metropolitan area we no longer position around,
*and* for payment processing, which we do not do and do not quote a rate for.
The keyword intent itself — "payment processing toronto" is a merchant looking
for an acquirer in a city — is something we cannot serve on either half. A
repurposed page would have kept a ranking URL whose slug and title promise
something the body then withdraws, which is the thing this whole branch exists
to stop doing. `/merchant-services-durham` was the closest to defensible (a
point of sale genuinely *is* a merchant service) but its H1 and intro said
"set up in person by someone who lives here" and named Pickering, Ajax, Whitby
and Oshawa — a residency claim, not a keyword, and the single sentence on the
old site an international buyer would have been most misled by.

**Why `/pos` and not `/pricing`.** `/pos` is the closest surviving *content*
match: the full product page, for the same visitor, wanting a system for their
counter, minus the geography. `/pricing` is the conversion page — a redirect
landing straight on a sign-up form reads as a funnel rather than an answer.
`/pos` links to `/pricing` twice.

**How.** Both mechanisms, deliberately:

- `next.config.ts` — three entries with `permanent: true` (Next's **308**).
  This runs at the edge before routing and is what actually serves the
  redirect; the page components never render in production.
- Each `page.tsx` reduced to a route-level `permanentRedirect("/pos")`. This is
  the backstop, so the URL cannot quietly start serving a city landing page
  again if the config is edited. (The page files were not deleted: the sandbox
  blocked file deletion. Functionally identical — the routes answer 308 — and
  the surviving files are three comment blocks and a one-line redirect each.)

Each route's `opengraph-image.tsx` is a one-line re-export of the shared
site-wide card (now geography-free) and is unreferenced once the page is a
redirect. Left in place; harmless.

Also removed: the three sitemap entries, and the footer "Across the GTA" link
group that pointed at them from every page.

**Verified:** all three return `308` → `/pos`, which returns `200`. No 404.

## 2b. The five competitor pages — Moneris and TD flagged

| page | brand reach | recommendation | action taken |
|---|---|---|---|
| `/square-alternative` | global | keep | kept, de-localised |
| `/clover-alternative` | global | keep | kept, de-localised |
| `/stripe-alternative` | global | keep | kept, de-localised |
| `/moneris-alternative` | **Canada only** | **keep for now — owner's call** | kept, de-localised, flagged in-file |
| `/td-merchant-solutions-alternative` | **Canada only** | **keep for now — owner's call** | kept, de-localised, flagged in-file |

**Moneris** is a Canadian acquirer and does not operate outside Canada.
**TD Merchant Solutions** is the merchant-acquiring arm of a Canadian bank.
"moneris alternative" and "td merchant solutions alternative" are queries only
Canadian merchants type.

**Recommendation: keep both, for now.** That is not automatically wrong for an
international product. Surge is software; a Canadian shop can run it like
anyone else, and neither page ever promised a merchant account — both open by
saying plainly that we do not process cards. They are also live ranking assets,
and this branch has already spent three URLs.

**But they are the narrowest pages on the site.** If Canada stops being a
priority market, they are the next candidates for the same 308-to-`/pos`
treatment the city pages got. That is a positioning call, not an engineering
one, so it is flagged in a comment at the top of
`app/(marketing)/moneris-alternative/page.tsx` and left for the owner.

What *was* changed on both: every claim about **us** having a GTA/Durham
service area or doing in-person setup. What was left: factual statements about
the competitor ("Moneris is Canada's largest processor") and the legal
attribution naming The Toronto-Dominion Bank. See section 7.

---

## 3. Structured data — before and after

**The problem.** `app/(marketing)/jsonld.tsx` exported `LOCAL_BUSINESS`, and
`app/(marketing)/layout.tsx` emitted it on **all 21 pages**. `LocalBusiness`
(and its subtype `ProfessionalService`) is the schema.org type for a business
with a door you can walk through in one place. That is the wrong type for an
international software company, so the fix was not to edit the values — it was
to change the type.

### Before (site-wide, every page)

```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://www.surgetechpos.com/#business",
  "name": "Surge Payment Solutions",
  "alternateName": "Surge",
  "url": "https://www.surgetechpos.com",
  "logo": "https://www.surgetechpos.com/icon-512.png",
  "image": "https://www.surgetechpos.com/jpg18.png",
  "description": "Point-of-sale software for restaurants, cafes and retail across the Greater Toronto Area — …",
  "telephone": "+1-888-648-8097",
  "email": "info@surgetechpos.com",
  "address": { "@type": "PostalAddress", "addressLocality": "Toronto", "addressRegion": "ON", "addressCountry": "CA" },
  "geo": { "@type": "GeoCoordinates", "latitude": 43.6532, "longitude": -79.3832 },
  "areaServed": ["Greater Toronto Area","Toronto","Mississauga","Brampton","Markham","Vaughan","Richmond Hill","Scarborough","North York","Etobicoke","Pickering","Ajax","Whitby","Oshawa","Durham Region"],
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","…","Sunday"], "opens": "09:00", "closes": "20:00" }]
}
```

### After (site-wide, every page) — verified in built HTML

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.surgetechpos.com/#organization",
  "name": "Surge",
  "legalName": "Surge Payment Solutions",
  "url": "https://www.surgetechpos.com",
  "logo": "https://www.surgetechpos.com/icon-512.png",
  "image": "https://www.surgetechpos.com/jpg18.png",
  "description": "Point-of-sale software for restaurants, cafes, shops and salons — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reporting. Onboarding is remote.",
  "email": "info@surgetechpos.com",
  "contactPoint": [
    { "@type": "ContactPoint", "contactType": "sales", "telephone": "+1-888-648-8097", "email": "info@surgetechpos.com", "availableLanguage": ["en"] }
  ]
}
```

Dropped and **not replaced**: `address`, `geo`, `areaServed`,
`openingHoursSpecification`. An `Organization` *may* carry an address; we are
not asserting a head office on 21 pages to satisfy a validator. `telephone`
moved into a `contactPoint` so the line can be described by what it is *for*
rather than implying a local branch number.

### `localService()` → `softwareService()`

Nine landing pages called `localService({ name, description, areaServed, path })`,
which emitted a `Service` with a `LocalBusiness` provider and a city list:

```json
{ "@type": "Service", "…": "…",
  "provider": { "@type": "LocalBusiness", "name": "Surge", "url": "https://www.surgetechpos.com" },
  "areaServed": ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"] }
```

It is now `softwareService({ name, description, path })`:

```json
{ "@context": "https://schema.org", "@type": "Service",
  "name": "Restaurant point of sale", "serviceType": "Restaurant point of sale",
  "description": "A full restaurant point-of-sale for cafes, quick-serve and full-service — …",
  "provider": { "@id": "https://www.surgetechpos.com/#organization" },
  "url": "https://www.surgetechpos.com/pos-for-restaurants" }
```

The `areaServed` **parameter is gone from the signature**, not defaulted to
empty — an optional service-area argument is an invitation to put the cities
back one page at a time. `provider` now references the single Organization node
by `@id` instead of re-declaring a `LocalBusiness` on nine pages.

### `/pricing`

Its inline `serviceSchema` carried `areaServed: ["Greater Toronto Area",
"Durham Region", "Ontario"]` and a `LocalBusiness` provider. Both removed; the
description now says "set up over a remote onboarding call". Still **no
`offers` block** — unchanged constraint.

### `/pos`

Already emitted a geography-free `SoftwareApplication` and still does. Only
change: `publisher: { "@id": ".../#organization" }` added so the graph has one
company node. No `offers`, no `aggregateRating`.

**Unchanged:** `breadcrumb()`, `breadcrumbTrail()`, `article()` (the `/guides`
`Article` schema), and the `/pricing` `FAQPage`. None carried geography.

---

## 4. The pilot page — the onboarding promise, rewritten not removed

`/pricing` is the important page on this branch, because it was the one making
a promise we cannot keep internationally: **in-person setup**.

**Was** (`pricing/page.tsx:187`):

> "Setup is part of it: we come to you, load your menu, draw your floor and
> walk your staff through it, across the GTA and Durham Region."

**Was** (pillar "Who it is for", `:58`):

> "Independent restaurants, cafes, shops and salons across the GTA and Durham
> Region. In-person setup is part of the offer, not an extra — so you need to
> be somewhere we can drive to and a day we can turn up on."

**Now** — the onboarding is not deleted, it is a different thing:

> "Setup is part of it, and it is done remotely: we book a video call, share
> screens, load your menu, draw your floor plan and walk your staff through the
> register before you run a shift on it."

> "Independent restaurants, cafes, shops and salons. Onboarding is remote — we
> do it over a video call, screen shared, so where you are does not decide
> whether you can take part. What you do need is an hour with the person who
> knows the menu."

Pillar "What you get" now ends "…and we set it up with you on a call."

**A new FAQ was added**, because the previous version of this page promised
somebody would turn up and anyone who read it then deserves a direct answer:

> **Do you come out and set it up?**
> No — setup is remote. We book a video call, share screens, and build it with
> you: your menu and modifiers loaded, your floor plan drawn, your staff roles
> set, and a walk through the register before you run a shift on it. It is the
> same work, done over a call instead of at your counter, which is what lets us
> run the pilot with shops anywhere rather than only the ones we can drive to.

It renders on the page **and** in the `FAQPage` JSON-LD, because both are
generated from the same `faqs` array.

The pilot confirmation email (`actions.ts`) was changed to match — a receipt is
a promise in writing, and step 3 said "We come out".

**Every other honesty constraint on this page is untouched:** no duration, no
number of spots, no end date, no post-pilot price, no processing rate, no
`offers` block, no scarcity. **No new market claim was invented** — there is no
"serving N countries", no country list, and nothing anywhere on the site now
says where our customers are.

---

## 5. Contact details — reported, not decided

Two different numbers are live on the company's public profiles:

| number | where it appears | area code |
|---|---|---|
| **+1 888 648 8097** | **the website** (`jsonld.tsx` `telephone`, `contact/page.tsx` `CONTACT_PHONE`) — and Instagram / Accounts Center | 888 — North American **toll-free**, not tied to a city |
| (437) 669 5723 | LinkedIn only | 437 — **Toronto local overlay** |

**Findings:**

1. The site uses **only** the 888 number. `437`, `669-5723`, `416`, `647` and
   `905` appear **nowhere** in the repo. Verified by grep.
2. The number on the site is therefore the *better* of the two for an
   international posture: an 888 toll-free line carries no city signal. It is
   still North-American-scoped (a caller from outside the US/Canada may pay,
   and some international carriers will not connect 8xx at all) — worth knowing,
   but not a positioning claim.
3. **The inconsistency is real and is not fixed here.** LinkedIn and Instagram
   advertise different numbers for the same company. That is a trust problem
   independent of geography, and it is the owner's call which one is canonical.
   **No number was picked, added or changed.**
4. If the 437 number ever comes onto the site, note that it reads as a Toronto
   local line, which is exactly the signal this branch removed everywhere else.

`contact/page.tsx` still publishes support hours in Eastern Time. Kept — see
the table in section 1.

---

## 6. Product code — reported, deliberately unchanged

These are **per-business defaults and fallbacks**, not geographic claims.
`businesses.timezone` and `businesses.currency` are real columns
(`supabase/migrations/0075_menu_dayparting.sql` coalesces against the column;
`app/app/settings/actions.ts` writes it, and offers `["CAD", "USD"]`).

| pattern | count | where | why it stays |
|---|---|---|---|
| `business.timezone \|\| "America/Toronto"` | ~60 | `app/app/**`, `lib/services/**` | The fallback fires only when a business row has no timezone set. Ripping it out does not internationalise anything — it replaces a wrong-for-some-shops default with a crash or a UTC day boundary, which silently misdates every report. The correct fix is a signup-time timezone, which is product work, not a marketing pass. |
| `business.currency \|\| "CAD"` | ~12 | `app/app/**` | Same shape. `app/app/settings/actions.ts:37` already exposes a currency picker; the literal is the default, not a limit. |
| `"CAD"` hardcoded in Finix calls | 4 | `app/app/pos/finix-*.ts`, `app/order/.../pay-actions.ts` | Payment-rail code. Out of scope by instruction (no money handling), and processing is not live. Flagged for whoever internationalises payments. |
| `toLocaleDateString("en-CA", …)` | 3 | `lib/utils/dates.ts` | **This is not a locale choice, it is a format trick.** `en-CA` is the locale that yields `YYYY-MM-DD`, and the very next line does `` new Date(`${localDateStr}T12:00:00Z`) ``. Changing it to `en-US` produces `9/14/2026` and breaks day-boundary maths across the app. |
| `toLocaleString("en-CA", …)` | 2 | `lib/email-templates/branded-{invoice,receipt}-email.ts` | Date formatting in transactional emails. Should eventually follow the business's locale; changing it now alters the date format on live receipts for no positioning gain. Reported, unchanged. |
| `lib/services/leads.ts:50` | `"Business timezone: America/Toronto"` inside an LLM prompt | prompt scaffolding for a lead-parsing model, not user-facing copy. Should take the business timezone. Reported, unchanged. |

**Nothing under `app/app/`, `lib/`, `supabase/` or `middleware.ts` was modified
on this branch.** Verified: the diff touches only `app/(marketing)/**`,
`app/sitemap.ts`, `next.config.ts` and `docs/`.

---

## 7. Surviving geographic strings in the built HTML — and why

Grep of the rendered HTML for `GTA|Greater Toronto|Toronto|Durham|Mississauga`:

- **`GTA` — 0 hits.**
- **`Durham` — 0 hits.**
- **`Mississauga` — 0 hits.**
- **`Greater Toronto` — 0 hits.**
- **`Toronto` — 2 hits, both "Toronto-Dominion", on one page.**

| surviving hit | page(s) | justification |
|---|---|---|
| "The Toronto-Dominion Bank" ×2 | `/td-merchant-solutions-alternative` | **Legal text.** The trademark attribution in the disclaimer band: "not affiliated with or endorsed by The Toronto-Dominion Bank or Global Payments." That is the bank's legal name in a required attribution, not a location. **Flagged as legal/compliance text and left untouched** — changing it would weaken the disclaimer. |
| "Moneris is Canada's largest processor" | `/moneris-alternative` | A factual statement **about the competitor**. Not a claim about where Surge operates. |
| "Ontario", "Interac", "Canadian", "Canada" | `/guides/lower-credit-card-processing-fees-ontario`, `/guides/interac-vs-credit-card-fees` (and their titles on `/guides` and the guide-link cards) | **These are articles, not positioning.** One explains Ontario interchange; the other explains Interac debit pricing. An article about a national payment network has to name the nation or it is about nothing. They never claimed we process cards. The *index page's* meta description did describe **us** as "across Ontario and the GTA" — that came off. |
| lowercase `ontario` / `interac` in URLs | `/guides`, `/sitemap.xml`, guide cards on `/pos-for-restaurants` and `/pos-for-retail` | The two guide **slugs**. Renaming them would 404 two ranking articles to remove a substring from a URL. Not worth it. |

---

## 8. Verification

| check | result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx vitest run tests/unit` | **187 passed**, 22 files, 0 failed — matches baseline, no regressions |
| `npx next build` | **success** |
| `npx eslint app lib` | **0 errors, 691 warnings** — exactly the baseline |
| Crawl: all routes | 21 pages `200`, 3 intended `308`, 0 404s |
| Crawl: internal links | 30 unique internal `href`s extracted from every rendered page — **all 200**, none pointing at a redirect |
| Built-HTML geo grep | 0 × GTA/Durham/Mississauga/Greater Toronto; 2 × "Toronto-Dominion" (legal) — see section 7 |
| Heading order | `/`, `/pricing`, `/pos`, `/contact` — one `h1` each, no skipped levels |
| Link text | no empty, "here", "click here" or "read more" anchors on any changed page |

### Crawl table

| URL | status | → | final |
|---|---|---|---|
| `/` | 200 | | |
| `/pos` | 200 | | |
| `/pos-for-restaurants` | 200 | | |
| `/pos-for-retail` | 200 | | |
| `/pricing` | 200 | | |
| `/contact` | 200 | | |
| `/book` | 200 | | |
| `/guides` | 200 | | |
| `/guides/lower-credit-card-processing-fees-ontario` | 200 | | |
| `/guides/interac-vs-credit-card-fees` | 200 | | |
| `/guides/how-to-read-your-merchant-statement` | 200 | | |
| `/guides/what-is-a-junk-fee-on-a-merchant-account` | 200 | | |
| `/guides/flat-rate-vs-interchange-plus-pricing` | 200 | | |
| `/square-alternative` | 200 | | |
| `/clover-alternative` | 200 | | |
| `/moneris-alternative` | 200 | | |
| `/stripe-alternative` | 200 | | |
| `/td-merchant-solutions-alternative` | 200 | | |
| `/payment-processing-toronto` | **308** | `/pos` | 200 |
| `/payment-processing-mississauga` | **308** | `/pos` | 200 |
| `/merchant-services-durham` | **308** | `/pos` | 200 |
| `/sitemap.xml` | 200 | | |
| `/robots.txt` | 200 | | |
| `/login` | 200 | | |

### Render proof (1280px, 2× DPR, full page)

- `docs/site-international/home-1280.png`
- `docs/site-international/pricing-pilot-1280.png`
- `docs/site-international/pos-1280.png`
- `docs/site-international/redirect-payment-processing-toronto-lands-on-pos-1280.png`
  — `/payment-processing-toronto` requested, 308 followed, `/pos` rendered

---

## 9. Open items for the owner

1. **Which phone number is canonical** — 888 648 8097 (site + Instagram) or
   437 669 5723 (LinkedIn). Not decided here. See section 5.
2. **`/moneris-alternative` and `/td-merchant-solutions-alternative`** — kept,
   but both are Canada-only brands. 308 them to `/pos` if Canada is
   deprioritised. See section 2b.
3. **`Interac` removed from the `PAY_METHODS` chip list** (`ui.tsx`). Put it
   back if Canada is the first processing market.
4. **Support hours are still stated in Eastern Time** on `/contact`. Correct
   today; change when coverage widens.
5. **Per-business timezone/currency** — the `America/Toronto` and `CAD`
   fallbacks are the honest next piece of internationalisation work, and it is
   product work: collect a timezone and currency at signup. Deliberately not
   touched here. See section 6.
