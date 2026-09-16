# Surge — organic social optimization pack

**Written 2026-09-11, against the live site as of that morning.** Everything here
matches the POS-first position: Surge is a **point-of-sale system**, card
processing is **coming soon with no published rate**, and the current offer is a
**free pilot** for GTA and Durham independents.

**Organic only.** There is no paid recommendation anywhere in this document — no
boosts, no ad budget, no paid targeting. Every lever below works on time, not spend.

## How to use this

Each platform section is a list of settings fields. Every field has a literal
value in a code block. Open the platform's settings page, go field by field,
paste. Where there is a choice, the recommended option is marked **← take this**.

## The rules this copy obeys

| Rule | Why |
| --- | --- |
| Never say "payments", "processing", "rates", "merchant services" in the present tense | We are not a processor. `/pricing` says so in full. |
| Never name a price, a duration, a spot count, an end date, or grandfathering | `/pricing`: *"we do not know yet what it will cost and a promise we cannot keep is worth less than saying so."* |
| Never mention appointments or bookings as a feature | `lib/modules/modes.ts` marks `appointments` as `status: "soon"`. Reservations + waitlist is a different, shipping feature — name that instead. |
| Never claim hardware or terminals | Nothing ships. `docs/hardware-sourcing.md` is a sourcing doc, not a product. |
| Plain, concrete, no hype | Match the site. "The till that runs the whole room", not "revolutionising hospitality". |

**The only features you may claim** (all verified in `docs/site-pos-first-audit.md` §1):
register · floor plan and table service · kitchen display routed by station ·
menu builder with modifiers and availability · online / QR / kiosk ordering ·
pay-at-table · reservations and waitlist · inventory, purchasing, recipes, waste ·
barcode scanning · staff roles, scheduling, time clock, attendance · reports and
exports · multi-location roll-up · customer-facing display · digital menu board.

---

# 1. The handle problem

The Instagram handle is **`surgepaymentsolutions`**. The company sells a
point-of-sale system and its own homepage says *"We are not your processor yet."*
The handle now contradicts the product.

## The tradeoff, stated honestly

**What changing it costs you:**

- Instagram does **not** redirect an old username. Every existing link to
  `instagram.com/surgepaymentsolutions` 404s the moment you change it, and after
  a holding period the old username becomes claimable by anyone.
- Any printed material, business card, email signature or invoice footer carrying
  the old handle becomes wrong.
- Whatever name recognition the account has accrued resets. Followers are kept —
  the account is the same account — but people who knew you by the string do not.

**What keeping it costs you:**

- A restaurant owner who lands on the profile from a POS pitch reads
  "payment solutions" and gets a different company. That is a conversion leak on
  every profile visit, forever.
- It poisons search. Instagram, LinkedIn and Google all index the handle. Someone
  searching "surge pos" does not find a handle that says payments.
- When processing *does* launch, you will have spent the payments handle years
  before having payments — and by then the account is bigger and changing costs more.

## What lowers the cost a lot

I checked the repo: **the site ships zero social links.**
`app/(marketing)/jsonld.tsx:70` reads
`// sameAs: pending real profile URLs (LinkedIn/Facebook/Instagram) — do not ship guessed links.`

So the highest-authority property you own has **no inbound link to the old
handle to break**. The switching cost is close to the floor right now, and it
only goes up from here.

## Recommendation

> **Change it. Today. Take `surgetechpos` on every platform.**

**Why `surgetechpos`:**

1. It is an **exact match for the domain** — `surgetechpos.com`. That is the one
   string already printed on the site header, the footer, the email address, the
   contact page and every piece of collateral. One string to memorise, everywhere.
2. It is **12 characters**, which fits X's hard 15-character username cap.
   `surgepaymentsolutions` is 21 — it literally cannot be your X handle.
3. It ends in "pos", so it reads as the category without keyword-stuffing.
4. It was **free on every platform I could actually check** (see the table below).

**Candidates, ranked:**

| # | Handle | Chars | Case for it | Case against |
| --- | --- | --- | --- | --- |
| **1** | **`surgetechpos`** **← take this** | 12 | Exact domain match. Fits X's 15-char cap. Free everywhere checkable. | "tech" is a filler syllable. |
| 2 | `surgepos` | 8 | Shortest, cleanest, best literal match for the search phrase "surge pos". | Short generic handles are the most likely to already be taken on the platforms I could not check (IG, TikTok, FB). Does not match the domain. |
| 3 | `surgeposgta` | 11 | Adds the local qualifier, which is genuinely what you sell. | Boxes you in if you ever leave the GTA. Longer to say out loud. |
| 4 | `surgeposca` | 10 | Country qualifier, same idea, more room to grow than GTA. | "ca" reads as California to roughly half the internet. |
| 5 | `getsurgepos` | 11 | The "get-" prefix is a standard fallback when the bare name is gone. | Pure fallback. Use only if 1 and 2 are both taken. |

**Rejected:** `heysurge` — verified **taken** on X, YouTube *and* LinkedIn.

**Also do this (free, five minutes, prevents a real problem):** after changing
the Instagram username, have the owner create a second, empty Instagram account
and claim `surgepaymentsolutions` on it. That stops a competitor or a squatter
picking up a handle that still carries your company's former name. Park it, post
nothing, and set the bio to a single line pointing at the new handle. *(This
requires creating an account — owner's hands, see §9.)*

---

# 2. Handle availability — what I actually found

Method: plain unauthenticated HTTPS GET of each profile URL, with a known-real
account and a known-fake account as controls on every platform. No logins, no
accounts created, no APIs.

## Verified — signal was clean

Controls behaved correctly on these three (real account → `200`, fake account → `404`):

| Handle | X / Twitter | YouTube | LinkedIn `/company/` |
| --- | --- | --- | --- |
| `surgetechpos` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgepos` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgeposca` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgeposgta` | 404 → **free** | 404 → **free** | 404 → **free** |
| `getsurgepos` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgeposhq` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgetill` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgeposcanada` | 404 → **free** | 404 → **free** | 404 → **free** |
| `surgepaymentsolutions` | 404 → free | 404 → free | 404 → free |
| `heysurge` | **200 → TAKEN** | **200 → TAKEN** | **200 → TAKEN** |

LinkedIn hyphenated variants also free: `surge-pos`, `surge-tech-pos`,
`surge-pos-gta`, `surge-point-of-sale`, `surgepos-gta`.

A 404 is a strong signal but not a guarantee — a handle can be reserved,
suspended or held by a deactivated account and still 404. Confirm at signup.

## Could NOT verify — flagged, do not assume

| Platform | What happened | What to do instead |
| --- | --- | --- |
| **Instagram** | Fully login-walled from this machine. Every handle returned `200` with an identical generic page — **including the control account `instagram` itself**, and including a handle I invented. The `/embed/` endpoint returned byte-identical shells. The `web_profile_info` API returned `401` for everything. There is **no usable unauthenticated signal.** | Owner, logged in: type the handle into Instagram search, or open `instagram.com/<handle>` in the app. 20 seconds per handle. |
| **Facebook** | Returned `400` for every URL including `facebook.com/facebook`. Unusable. | Owner: Page settings → Username. Facebook tells you live whether it is free. |
| **TikTok** | Bot-blocked. Inconsistent bodies, no title on most responses, no stable difference between the real and fake control. | Owner: TikTok search, or the username field at signup. |

**Before you commit:** check `surgetechpos` on Instagram, Facebook and TikTok
manually. If it is gone on any one of them, fall to `surgepos`, then `surgeposgta`.
Pick **one** string and use it on all seven platforms — a split handle set costs
you more than any individual handle is worth.

---

# 3. Instagram — field by field

**Switch to a Professional account first** (Settings → Account type and tools →
Switch to professional account → **Business**, not Creator). Without it you get
no Insights, no contact buttons, no multi-link bio and no category label.

### Username

```
surgetechpos
```
*Limit 30. Instagram allows 2 username changes per 14 days — get it right the first time.*

### Name field — **this is search-indexed and almost everyone wastes it**

Instagram's search ranks on username **and** the Name field. Do not put "Surge"
here alone; that is a free keyword slot spent on a word already in your username.

```
Surge POS — Point of Sale GTA
```
**29 / 30 characters.** Carries `POS`, `Point of Sale`, `GTA`.

Alternative if you prefer the geography read: `Surge POS · Toronto & Durham` (28/30).

### Bio

```
Point of sale for GTA & Durham independents.
Register · floor plan · kitchen display · QR + online ordering · stock · staff.
Free pilot running now ↓
```
**149 / 150 characters** (line breaks count as 1 each).

Shorter alternative, more voice, less keyword — **136 / 150**:
```
The till that runs the whole room — floor, kitchen and counter on one system.
For GTA & Durham independents. Free while the pilot runs ↓
```

> Take the 149-character one. Instagram's keyword search reads the bio, and at
> zero followers you need the keywords more than you need the line.

### Category

Settings → Business information → Category. Pick from Instagram's list:

```
Software Company
```
**← take this.** Fallbacks in order if it does not appear in your region's list:
`Internet Company` → `Business Service` → `Product/Service`.
Set **"Display category on profile" ON** — it renders as a grey label under the
Name field and is one more line of free, accurate context.

### Links (Instagram allows up to 5 — use 3)

Order matters; the first is the one that renders on the profile.

| # | URL | Custom title | Why |
| --- | --- | --- | --- |
| 1 | `https://www.surgetechpos.com/pricing#apply` | `Join the free pilot` | The bio CTA says "free pilot". Land them on the form, not the home page. Anchor jumps straight to it. |
| 2 | `https://www.surgetechpos.com/book` | `Book a 15-min demo` | For the ones not ready to commit an install day. |
| 3 | `https://www.surgetechpos.com/pos` | `See what the POS does` | For the ones who want to read first. |

**Do not** link the home page as #1. The bio already told them what the product
is; the link's job is the next step.

### Contact options

Settings → Business information → Contact options.

| Field | Value |
| --- | --- |
| Business email | `info@surgetechpos.com` |
| Business phone | `+1 888 648 8097` |
| Business address | **Leave blank / do not display.** There is no storefront, and a displayed address that is really a home or a mailbox invites walk-ins and is worse than nothing. |

Turn ON: **Email**, **Call**, **Text** buttons. Turn OFF: Directions.

### Action button

```
None — leave it unset.
```
Instagram's "Book now" action button requires an **integrated booking partner**
(Calendly, Square Appointments, Resy and similar). `/book` is an in-house form
handled by a server action in this repo, not a partner integration, so the
action button cannot point at it. Trying to force it means signing up for a
booking SaaS you do not need. **Use link #2 in the bio instead.**

*If the owner ever moves `/book` onto Calendly, revisit this — a "Book now"
button is a real conversion lift and it becomes available for free at that point.*

### Settings to switch on

- **Professional account → Business** (prerequisite for everything above)
- **Insights** — on automatically with Professional; check it weekly
- **Profile category display** — ON
- **Saved replies** (Settings → Business tools → Saved replies) — write three now:
  one for "how much is it", one for "do you do card processing", one for
  "where are you based". You will answer these hundreds of times.
- **Message controls** → allow message requests from everyone. You are prospecting.
- **Verification:** do not chase a blue tick. Instagram verification wants
  notability/press coverage, and Meta Verified is a paid subscription — out of
  scope for an organic-only plan. Skip it.

### Profile image

| Slot | Source file | Export size |
| --- | --- | --- |
| Profile photo | Composite: `png/surge-symbol-flat-dark.png` centred on a solid `#101318` square | **1024 × 1024** |

Instagram circle-masks the avatar. **Do not upload `icons/surge-app-icon.png`
directly** — I measured it: the bracket's top-right and bottom-right corners sit
at roughly 513px from centre on a 512px mask radius, so they clip. Build the
composite instead (§8 has the one-line command) with the symbol at ~68% of canvas
width, which satisfies the kit's clear-space rule and survives the mask.

Instagram has no banner.

---

# 4. Facebook Page — field by field

Create as a **Page**, not a personal profile or a Group.

### Page name

```
Surge — Point of Sale (GTA & Durham)
```
Facebook indexes the Page name heavily in its own search and in Google. Facebook
reviews name changes and rejects keyword stuffing, so keep the bracketed
qualifier factual and geographic — that is permitted; `Surge POS Best Cheapest
Toronto Restaurant System` is not.

Conservative alternative if the review bounces it: `Surge Point of Sale`.

### Username (vanity URL)

```
surgetechpos
```
→ `facebook.com/surgetechpos`. Minimum 5 characters, letters/numbers/periods only.

### Bio (short description, shows under the Page name)

```
Point-of-sale for GTA & Durham independents. Free pilot running now.
```
**68 / 101 characters.**

### About → Description

```
Surge is a point-of-sale system for independent restaurants, cafes, bars, shops and salons across the GTA and Durham Region — register, floor plan, kitchen display, online and QR ordering, inventory, staff and reports. Free while the pilot runs.
```
**245 / 255 characters.**

### Categories (Facebook allows up to 3 — use all 3)

```
1. Software Company        ← primary
2. Business Service
3. Information Technology Company
```
The primary category determines which Page fields Facebook offers you. `Software
Company` gives you the website/CTA set you want. Do **not** pick
`Financial Service`, `Bank` or anything payments-adjacent — that is the same
structured-data error the site just spent a whole audit removing (see
`docs/site-pos-first-audit.md` §4, row 12).

### Contact and location

| Field | Value |
| --- | --- |
| Website | `https://www.surgetechpos.com` |
| Email | `info@surgetechpos.com` |
| Phone | `+1 888 648 8097` |
| Address | **Do not add a street address.** Set the Page as a service-area business. |
| Service area | `Toronto, ON` · `Mississauga, ON` · `Brampton, ON` · `Markham, ON` · `Vaughan, ON` · `Richmond Hill, ON` · `Scarborough, ON` · `North York, ON` · `Etobicoke, ON` · `Pickering, ON` · `Ajax, ON` · `Whitby, ON` · `Oshawa, ON` |
| Hours | See the hours warning in §9 — **resolve the site conflict before entering anything.** |

### Action button

```
Sign Up   →  https://www.surgetechpos.com/pricing#apply
```
**← take this.** Second choice: `Learn More` → same URL. Third: `Send Message`
(only if the owner will actually answer Messenger inside an hour — an unanswered
Messenger button shows a public "typically replies in a day" badge that does more
harm than the button does good).

### Images

| Slot | Source | Export size |
| --- | --- | --- |
| Profile picture | Same 1024 × 1024 composite as Instagram | **1024 × 1024** (Facebook circle-masks it too) |
| Cover photo | `png/surge-horizontal-flat-dark.png` on `#101318` | **1640 × 856** |

Facebook crops the cover hard on mobile. Keep the lockup inside the centre
**1000 × 500** and nothing important in the outer margin.

### Switch on

- **Page roles** — owner as Admin. Add a second Admin (a co-founder or trusted
  contact) so a locked-out account never orphans the Page.
- **Professional Dashboard / Insights**
- **Link the Instagram account** (Page settings → Linked accounts). This is a
  prerequisite for cross-posting Reels and for Meta Business Suite scheduling —
  both free, and the scheduler is the single biggest time-saver in this document.
- **Meta Business Suite** — create a Business Portfolio, put both the Page and
  the IG account in it.
- **Domain verification** for `surgetechpos.com` in Business Suite → Brand safety
  → Domains. Requires adding a DNS TXT record. This is what lets you control link
  previews for your own domain. **Owner's hands** — see §9.
- **Page verification:** the grey/blue Page tick is now part of paid Meta
  Verified. Skip it — organic only.

---

# 5. LinkedIn Company Page — field by field

LinkedIn is where B2B search actually happens for this product, and it is the
platform where the most valuable field is the one people leave on default.

### Page name

```
Surge
```
See §9 — there is a real decision here about whether the Page name should be
`Surge`, `Surge POS` or the registered `Surge Payment Solutions`. The site's
schema currently carries `name: "Surge Payment Solutions"` with
`alternateName: "Surge"`. **Recommendation: `Surge`**, with the POS story carried
by the tagline (which is longer, fully indexed, and not subject to a name-review).

### Public URL (vanity)

```
linkedin.com/company/surgetechpos
```
Verified free. Hyphenated variants `surge-pos` and `surge-point-of-sale` are also
free if the owner prefers them — but keep the one-string rule and take `surgetechpos`.

### Tagline — **search-indexed, 120 chars, and the single most wasted field on LinkedIn**

This renders directly under the company name in LinkedIn search results, on every
employee's profile, and on every post the Page makes. Most companies put a slogan
here. Put the product and the geography here.

```
Point-of-sale software for independent restaurants, cafes, bars, retail and salons across the GTA and Durham Region.
```
**116 / 120 characters.** Every vertical from the site's "Industries served"
section, plus both geographies, plus the category noun.

Alternative with more voice, **111 / 120**:
```
Point of sale for GTA & Durham independents — floor, kitchen and counter on one system. Free pilot running now.
```

> Take the 116-character one. The tagline is a search surface first and a slogan
> second, and "free pilot" will be stale copy the day the pilot ends — whereas
> the vertical list stays true.

### About / Overview (2,000 character limit)

```
Surge is a point-of-sale system for independent restaurants, cafes, bars, shops and salons across the Greater Toronto Area and Durham Region.

One system instead of five subscriptions. Most independents end up with a till, a separate kitchen screen, a booking tool, a spreadsheet for stock and another for the schedule. Surge is all of it, and the pieces already know about each other.

What it runs:
- Register — ring up, modify, discount, split the tender, add a tip, close out. Voids and item-level refunds log a reason.
- Floor plan and table service — draw the room, fire by seat and course, transfer a table between servers without losing the order.
- Kitchen display — tickets route to the station that cooks them, the moment they are sent.
- Menu and catalog builder — items, modifiers, prices, availability. 86 something once and it clears every screen at the same time.
- Online, QR and kiosk ordering, plus pay-at-table — all feeding the same ticket queue, so nothing is re-keyed on the pass.
- Reservations and waitlist.
- Inventory, purchasing, recipes, waste and barcode scanning — so you can see what a plate costs you, not only what it sold for.
- Staff roles and permissions, scheduling and the time clock, with labour measured against sales.
- Reports and exports for whoever does the books.
- Multi-location roll-up, customer-facing display and digital menu board.

It runs on the tablet or phone you already own, and we set it up with you in person — menu loaded, floor drawn, staff walked through it.

Card processing: coming soon. Surge is the point of sale today. We are building our own card processing and terminals, and until that is live we do not quote a rate and we do not sell hardware. You keep whatever processor you have — nothing to port, nothing to cancel.

Right now it is free. We are running a pilot with GTA and Durham independents: the full point of sale, free for a limited time, set up in person. What we want back is real use and blunt feedback.
```
**1,988 / 2,000 characters.**

### Industry

```
Software Development
```
**← take this.** LinkedIn allows one primary industry. Fallbacks:
`IT Services and IT Consulting` → `Information Technology & Services`.
Do **not** use `Financial Services` — same reason as Facebook.

### Company details

| Field | Value |
| --- | --- |
| Website | `https://www.surgetechpos.com` |
| Company size | `2-10 employees` |
| Company type | `Privately Held` |
| Founded | *Owner to confirm the incorporation year for `1001634450 ONTARIO INC.` — do not guess it.* |
| Phone | `+1 888 648 8097` |
| Location (primary) | `Toronto, Ontario, Canada` — mark **"This is my primary location"**. Leave the street line blank; LinkedIn accepts a city-only location. |
| Additional location | `Oshawa, Ontario, Canada` — a second location entry is free, it is truthful for the service area, and it puts the Page into Durham-based location searches. |

### Specialties — LinkedIn allows 20, and this is a real search surface. Fill all 20.

Specialties are indexed and matched against LinkedIn's own search. An empty
Specialties block is twenty free ranking slots thrown away. Paste these one per
entry:

```
Point of sale
POS systems
Restaurant POS
Retail POS
Cafe POS
Bar POS
Kitchen display systems
Table service and floor plans
QR ordering
Online ordering
Self-serve kiosk
Pay at table
Menu management
Inventory management
Purchasing and stock control
Staff scheduling
Time clock and attendance
Sales reporting
Multi-location management
Small business software
```
Every one of those maps to a feature the audit verified ships. **No
"payment processing", no "merchant services", no "appointments"** — those would
be false on three different grounds.

### Custom button

```
Register   →  https://www.surgetechpos.com/pricing#apply
```
**← take this.** LinkedIn's options are Contact us / Learn more / Register /
Sign up / Visit website. `Register` is the closest honest verb for "join the
pilot". Second choice: `Learn more` → `https://www.surgetechpos.com/pos`.

### Community hashtags (LinkedIn allows 3)

```
#PointOfSale
#RestaurantTech
#TorontoSmallBusiness
```
These let the Page post and comment *as the Page* in those feeds — a small but
genuinely free reach lever most Pages never turn on.

### Images

| Slot | Source | Export size |
| --- | --- | --- |
| Logo | `icons/surge-app-icon.png` | **400 × 400** (min 268 × 268) |
| Cover | `png/surge-horizontal-flat-dark.png` on `#101318` | **1128 × 191** |

LinkedIn company logos render as a **rounded square, not a circle**, so the app
icon works here as-is with no clipping risk. The cover is extremely wide and
short — put the horizontal lockup at roughly 600px wide, centred, and resist
adding a tagline into the artwork; it becomes unreadable on mobile.

### Switch on

- **Page admin** — LinkedIn requires the founder's personal profile to list a
  current position at the company, and often a verified email on the company
  domain, before it will let you create the Page. **Owner's hands** — §9.
- **Add the Page to the founder's personal profile Experience section.** The
  personal profile has more reach than a 0-follower company page will have for
  months; this is what carries early traffic to it.
- **Invite connections to follow the Page** (Admin tools → Invite connections).
  LinkedIn grants a monthly credit balance for this. It is free and it is the
  fastest legitimate way off zero followers.
- **"My Company" tab** and **Page analytics** — both on by default, both worth reading monthly.
- LinkedIn has no page verification to chase. Skip.

---

# 6. The short sections

## 6a. Google Business Profile

**This is the highest-value listing in the whole pack for a local, in-person,
GTA/Durham business — and it is the one most likely to be blocked on
verification.** Start it first (see §8) because verification can take days.

| Field | Value |
| --- | --- |
| Business name | `Surge` — see the naming warning in §9. Google's name guidelines **forbid** adding keywords or location to the name field. `Surge POS Toronto` risks suspension. Use the real-world name only. |
| Primary category | Type `point of sale` into the category search and take the closest match. If nothing fits: `Software company` **← safest default**. |
| Additional categories | `Business to business service` · `Computer consultant` · `Cash register supplier` (only if the category search offers them) |
| Business type | **Service-area business — hide the address.** There is no storefront. A displayed home address is a suspension risk and a privacy problem. |
| Service areas | `Toronto` · `Mississauga` · `Brampton` · `Markham` · `Vaughan` · `Richmond Hill` · `Scarborough` · `North York` · `Etobicoke` · `Pickering` · `Ajax` · `Whitby` · `Oshawa` · `Durham Region` |
| Phone | `+1 888 648 8097` |
| Website | `https://www.surgetechpos.com` |
| Appointment link | **Leave blank.** Do not add `/book` here unless the owner wants Google routing demo requests — and never label anything "appointments". |
| Hours | **Resolve the conflict first — §9.** |
| Opening date | Owner to supply. Do not guess. |

**Description (750 character limit)** — 749 characters:
```
Surge is a point-of-sale system for independent restaurants, cafes, bars, shops and salons across the Greater Toronto Area and Durham Region.

One system instead of five subscriptions: register, floor plan and table service, kitchen display routed by station, menu builder, online and QR ordering, pay-at-table, kiosk, inventory, barcode scanning, staff scheduling and time clock, and reports with exports for your bookkeeper. It runs on the tablet you already own, and we set it up with you in person.

Card processing and terminals are coming soon. Surge is the point of sale today; you keep whatever processor you already use.

Right now it is free while our pilot runs — full access, no contract, in-person setup, in exchange for blunt feedback.
```

**Services** — add each as a named service (free, indexed, and it is what Google
matches local queries against):
```
Point of sale setup
Restaurant POS
Retail POS
Cafe and quick-serve POS
Kitchen display setup
Menu build and import
Floor plan setup
Online and QR ordering setup
Inventory setup
Staff scheduling and time clock setup
On-site staff training
```

**Action button:** `Sign up` → `https://www.surgetechpos.com/pricing#apply`

**Images:** logo `icons/surge-app-icon.png` at **720 × 720**; cover
`png/surge-horizontal-flat-dark.png` on `#101318` at **1024 × 576** (16:9).
Then add 5–10 real photos from actual setup days — Google weights recent, real,
geotagged photos, and stock-looking imagery gets less traction than a genuinely
ordinary photo of a tablet on a real counter.

**Switch on:** messaging (only if answered same-day), Q&A monitoring — and
**seed the Q&A yourself**: post "Do you handle card processing?" and answer it
honestly. Owner-posted Q&A is allowed, it pre-empts the objection, and it is
indexed.

## 6b. TikTok

| Field | Value |
| --- | --- |
| Username | `surgetechpos` *(limit 24 — verify manually, I could not)* |
| Name | `Surge POS — Toronto & Durham` *(28 / 30)* |
| Bio | see below *(80 char limit)* |
| Category | `Software` → fallback `Business Services` |
| Link | `https://www.surgetechpos.com/pricing#apply` |
| Account type | **Switch to Business Account** — required for the bio link and for analytics |
| Profile photo | 1024 × 1024 composite (circle-masked) |

```
POS for GTA & Durham independents. Free pilot on now ↓
```
**54 / 80 characters.**

TikTok is the highest-variance, lowest-cost channel here: a 30-second clip of a
kitchen display routing a ticket can do 50 views or 50,000, and it costs the same
either way. Treat it as a free second home for the Reels you are already cutting
(§7) — do not build a separate content plan for it.

## 6c. YouTube

| Field | Value |
| --- | --- |
| Handle | `@surgetechpos` |
| Channel name | `Surge — Point of Sale` |
| Channel URL | `youtube.com/@surgetechpos` (verified free) |
| Links on banner | `surgetechpos.com/pricing#apply` (first, shows on banner) · `surgetechpos.com/book` · `surgetechpos.com/pos` |
| Contact email | `info@surgetechpos.com` |
| Profile picture | 1024 × 1024 composite (circle-masked), upload at **800 × 800** min |
| Banner | **2560 × 1440**, all content inside the **1546 × 423** safe area |

**Description (1,000 char limit)** — 975 characters:
```
Surge is a point-of-sale system for independent restaurants, cafes, bars, shops and salons across the GTA and Durham Region.

This channel is short, plain demos of the till doing one thing at a time — firing by seat and course, routing a ticket to the right station, 86-ing an item so it clears every screen, splitting a cheque, counting stock — plus setup days in real rooms and unedited feedback from the owners running it.

One system instead of five subscriptions: register, floor plan, kitchen display, menu builder, online and QR ordering, kiosk, reservations, inventory, staff and time clock, reports and exports. Runs on the tablet you already own.

Card processing is coming soon — Surge is the point of sale today, and you keep the processor you already use.

Free while the pilot runs, for GTA and Durham independents, set up in person.
Join the pilot: https://www.surgetechpos.com/pricing#apply
Book a demo: https://www.surgetechpos.com/book
info@surgetechpos.com
```

**Switch on:** Shorts uploads (the vertical Reels you already cut, reposted),
a **channel trailer** for non-subscribers (use the 45-second POS overview),
and **channel keywords** in Advanced settings:
`point of sale, POS system, restaurant POS, retail POS, kitchen display, Toronto, Durham Region, small business`.

> YouTube's real job here is **search longevity**, not reach. A video called
> "How to split a cheque on a POS" is still earning views in two years. Nothing
> else in this pack has that property.

## 6d. X / Twitter

Lowest priority of the seven. Claim it so nobody else does, keep it consistent,
do not build a strategy on it — the GTA independent restaurant owner is not there.

| Field | Value |
| --- | --- |
| Username | `surgetechpos` **(12 / 15 — note `surgepaymentsolutions` at 21 chars cannot fit X at all)** |
| Name | `Surge POS — Toronto & Durham` *(28 / 50)* |
| Bio | see below *(160 char limit)* |
| Location | `Toronto & Durham Region, ON` |
| Website | `https://www.surgetechpos.com` |
| Profile photo | 1024 × 1024 composite, upload at **400 × 400** |
| Header | **1500 × 500** — horizontal lockup on `#101318` |
| Professional account | Switch on (free) for analytics; skip the paid tiers |

```
Point-of-sale for independent restaurants, cafes and shops across the GTA & Durham Region. Free pilot running now. Card processing coming soon.
```
**143 / 160 characters.**
