# Home page — built vs `mockups/01-home.jpg`

Phase 1 of the Surge website redesign. Branch `site-redesign`, cut from
`site-international` (`b521a6e`).

## Proof in this folder

| File | What it is |
| --- | --- |
| `home-1280.png` | The built `/` at a 1280px viewport, full page. |
| `home-375.png` | The built `/` at 375px, full page. |
| `side-by-side-home-1280.png` | The mockup and the 1280 build at the same width, side by side. |
| `contact-terminal-topic-1280.png` | `/contact?topic=terminal` — where "Get terminal updates" lands, with the enquiry prefilled. |

## Verification run against the served build

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run tests/unit` | 187 passed / 22 files — baseline, no regressions |
| `npx next build` | compiled; `/` prerendered static |
| `npx eslint app lib` | 0 errors, 691 warnings — baseline unchanged |
| `GET /` | 200 |
| `GTA\|Toronto\|Durham\|Mississauga\|Ontario` in served HTML | 0 |
| Competitor names in served HTML | 0 |
| Price / rate / `$` / `%` in visible copy | 0 (the only `%` are CSS bar heights and grid widths; the only `$` are React flight-payload refs) |
| `Payment terminal · Coming soon` visible | 3 of 4 at 1280 **and** 3 of 4 at 375 (the 4th is the hero's other breakpoint variant) |
| `Product preview` badges | 7 in DOM, 2 visible (the active tab's two frames) at both widths |
| Horizontal overflow | none at 1280 or 375; no element extends past the client width |
| Preview tabs by keyboard | roving tabindex, Arrow Left/Right, Home, End all move focus **and** selection; `aria-selected` and `hidden` follow; every `aria-controls` resolves |
| FAQ by keyboard | native `<details>`/`<summary>`; summary focusable, Enter/Space toggles, all three answers present in the served HTML whether open or closed |
| Header "Solutions" disclosure | `aria-expanded` toggles, Escape closes, both links resolve |

## Section by section

### Header
Match: logo left, `Product / Solutions / Pricing / Guides` centre, `Sign in` +
blue pill `Book a demo →` right, sitting directly on the hero with no bar.

Deviations:
1. **The logo is the icon plus a typeset "Surge", not the horizontal lockup.**
   The mockup draws the lockup at ~168px wide against its canvas; the logo
   kit's floor for that artwork is 220px, and a 72px header rail has nowhere
   near that. The footer, which has the room, uses the real lockup at 220px.
2. **"Solutions" is a disclosure button, not a link.** There is no
   `/solutions` index in this repo yet and the rules forbid a nonworking
   navigation link, so it opens onto the two industry pages that do exist.
3. **The announcement strip.** Absent on `/`, exactly as the mockup draws it.
   It is still rendered on the other twenty-one routes, which have no other
   launch-state disclosure until their own pass.

### Hero
Match: eyebrow `POINT OF SALE + PAYMENTS`, H1 "Run the rush. / Grow your
business." on two lines, two-line sub, `Book a demo →` + `Explore the planned
terminal`, "Terminal hardware is not yet available." underneath, photograph
bleeding off the right with the coming-soon pill over it.

Deviations:
1. **H1 is 56px, not the ~60px the mockup measures.** Inter is a wider face
   than the one drawn; at 60px "Grow your business." broke to a third line.
   56px is the bottom of DESIGN-SYSTEM.md's 56–72px range.
2. **The photograph takes 42% of the 1240px rail plus the bleed, measured from
   the rail and not the viewport.** It was `right:0; width:52%` against the
   full-width `<section>`, i.e. 52% of the VIEWPORT, which is only in the right
   place at about 1280: at 1920 its left edge landed at 922px, over the hero
   copy and over "Pricing" and "Guides", and at 2560 it was 1331px wide. The
   left edge is now `(rail content-box right) − 0.42 × (rail content width)`,
   which is the text column's right edge at every width. See
   `.surge-rail-bleed-right` in tokens.css.
3. **The photograph starts below the 72px header rail, not at y=0.** The mockup
   runs the room up past the nav and floats the nav on it. That cannot survive a
   wide display — the header's items are laid out inside the 1240px rail while
   the picture's left edge moves left as the viewport grows, so from roughly
   1500px up the nav is drawn on a photograph. Clearing the rail is the only way
   the nav stays legible at every width AND the picture still bleeds.
4. **The text column is 58% of the rail, the mockup's is about 41%.** "Grow
   your business." sets to 622px at the 56px H1 and the column owes a 24px gap
   to the picture, so anything under ~646px of the 1144px content width breaks
   the headline onto a third line — which it had been doing at every width from
   1273 up, 1280 included.
5. **The photograph is a placeholder** (see "Image slots" below).
6. `Explore the planned terminal` scrolls to the planned-terminal band on this
   page rather than to a `/pos-hardware` route, which does not exist yet.

### Three value props
Match: three columns, blue line icons, vertical rules between, on the tinted
canvas, hairlines top and bottom.

Deviation: **"Simple, transparent rates with no surprises." is replaced** with
"One written quote for your market, with nothing hidden underneath it." The
original is a published-rate claim on a site that publishes no rates.

### Charcoal band — "From first order to final payment."
Match: heading, three-line sub, tab rail `Floor plan / Orders / Kitchen /
Reports` with the active tab underlined in accent blue, two tablet-framed
screens on the right, each with a "Product preview" badge overlapping the top
left of its frame.

Deviations:
1. **The heading renders at 52px; the mockup measures ~60px**, which is above
   DESIGN-SYSTEM.md's stated 32–44px H2 range. 52px is a compromise: it keeps
   the near-H1 hierarchy the design is built on while still fitting two lines
   on the 1240px grid. Registered as its own token (`--surge-h2-display`).
2. **The tabs actually switch.** In the mockup all four tabs are decoration
   around one fixed pair of screens. Here each tab shows the screen it names
   plus the screen it hands work to — floor → kitchen, orders → floor, kitchen
   → orders; Reports shows alone because work ends there.
3. **A caption reads "Interface preview with sample data." under every frame.**
   Not in the mockup; required by the rule that generated UI must not dictate
   amounts or data.
4. **The late kitchen ticket says "Over target" in words.** The mockup marks it
   with a red `6m` and nothing else, which is status by colour alone.
5. **The reports screen carries no currency.** Counts, an unlabelled
   orders-by-hour shape and top items — no totals, no rates, no calculation.
6. Item text differs in case and wording in places ("Iced tea" vs "Iced Tea",
   "Takeaway" vs "Takeout") — the mockup's raster small text is not production
   copy.

### Solutions cards
Match: eyebrow `SOLUTIONS FOR YOUR BUSINESS`, two cards, white title and sub
over the photograph at the bottom left, circular white arrow bottom right,
coming-soon pill on the retail card.

Deviations:
1. **The caption sits on a flat 88% ink panel, not a gradient scrim.** Every
   gradient was removed from this site by the owner, and the handoff bans
   "glow, rainbow gradients or exaggerated shadows". A flat panel also has a
   contrast ratio that can be measured; a scrim's depends on the photograph.
2. The whole card is one link — the arrow is decoration inside it, not a second
   tab stop to the same URL.
3. Both photographs are placeholders.

### Pricing / planned terminal split
Match: two columns divided by a vertical rule; left `SIMPLE, TRANSPARENT
PRICING` / "Know what you pay." / a bordered card / a text link; right `PAYMENT
TERMINAL` / "Explore the planned terminal." / product shot / four ticked
points / an outlined `Get terminal updates →`.

Deviations — all four are content rules overriding mockup copy:
1. **"Straightforward rates for card payments." →** "Plans, currencies and
   payment options vary by market. Contact us to confirm availability." (the
   approved status line).
2. **Card "See our pricing / Transparent and easy to understand." →** "Request
   pricing / Tell us where you are and how your business runs, and we will put
   a written quote together."
3. **"View all rates and fees →" →** "See plans and request a quote →". There
   is no rate card to view.
4. **"Built for busy environments" →** "Designed for busy counters (planned)",
   and the list gained the heading "Planned — not yet available". The mockup
   marks two of four points "(planned)" and leaves two in the present tense
   for hardware that does not exist.

Also: a `COMING SOON` chip sits beside the `PAYMENT TERMINAL` eyebrow, which
the mockup does not have, and the coming-soon pill on the 220px square product
shot renders **under** it rather than over it — a pill floated over a 220px
square covers the reader, which is the only thing in the frame.

### Onboarding steps
Match: `GET STARTED` / "A smoother switch starts here." plus three numbered
circles with headings and copy, divided by vertical rules.

Deviation: **"On-site or remote training…" → "Remote training…".** Onsite
service is not confirmed for any market and the rules forbid advertising it
without confirmation.

### FAQ
Match: `FREQUENTLY ASKED QUESTIONS` / "Quick answers. / Real support." on the
left, three rows with `+` markers on the right, hairline rules between.

Deviations:
1. The `+` rotates to an `×` on open; the mockup shows only the closed state.
2. The answers are written here. The mockup's are not legible at 971px, and two
   of the three questions are about price and setup time, where an invented
   answer would be a published claim. None of the three answers contains a
   price, a duration or a response-time guarantee.

### Closing CTA
Match: warm band, "See Surge at your counter." / "A modern POS, built for real
businesses." on the left, blue `Book a demo →` in the middle, photograph
bleeding off the right.

Deviations:
1. **The photograph has a hard left edge**, where the mockup dissolves it into
   the warm field. That dissolve is a gradient.
2. It occupies 38% rather than ~42%: at 42% its left edge crossed the button at
   1280.
3. Hidden below `lg` — at 375px there is no room for a bleed.

### Footer
Match: charcoal, lockup and "Powering local business every day." on the left,
four link columns `Product / Solutions / Resources / Contact`, a bottom bar
with the copyright.

Deviations — every one of them is a link with nothing behind it:
1. **No Privacy or Terms links.** Neither route exists in this repository.
   CONTENT-AND-LAUNCH-RULES.md says to retain the real privacy/terms routes and
   not to create nonworking footer links, so the pair is omitted. **This is the
   most important outstanding content dependency on the page.**
2. **No social icons.** `app/(marketing)/jsonld.tsx` records that no verified
   LinkedIn/Instagram/YouTube profile URLs exist ("do not ship guessed links").
3. **No "Built for what's next." block** at the right — it sat with the social
   icons and has nothing to anchor to on its own.
4. **Six labels dropped**: Payments, Features, Help center, Blog, Setup &
   support, Support. No routes yet; each returns in Phase 2 with its page.
   "Payment terminal" is added in the Product column, anchoring the band on
   this page.
5. The bottom-right slot carries the hardware and market caveats instead of the
   missing legal links.

## Image slots

Every photograph on the page is a flat `--surge-warm` block at the exact aspect
ratio the real picture needs, with a dashed edge, the shot brief printed on it
and a `data-image-slot` marker. Nothing here is stock, nothing is a crop of the
mockup JPG, and no generated person implies a customer. Dropping a real
`<Image fill>` into the same wrapper changes pixels and nothing else.

| `data-image-slot` | Ratio | Shot brief |
| --- | --- | --- |
| `home-hero-owner-counter` | 4:3 | Adult female cafe owner at her own counter, working a slim tablet on a low stand, generic elongated keypad reader beside it. Warm daylight, real room behind her, no processor branding. Alt: "A cafe owner taking an order on a tablet at her counter, with a card reader beside it". |
| `home-solution-restaurants` | 12:5 | Restaurant service in progress — plated food on a pass or a table mid-service. People may be out of focus. No hero portrait, no visible branding. Decorative (empty alt); the card's own heading names it. |
| `home-solution-retail` | 12:5 | Adult male shop or counter staff member using a handheld tablet at a service counter, generic elongated keypad reader on the counter beside him. Decorative (empty alt). |
| `home-terminal-concept` | 1:1 | Product render of the planned Surge reader: generic unbranded elongated keypad terminal, three-quarter view, plain light background, no cables. Concept render, not final hardware. Alt: "Concept render of the planned Surge payment terminal". |
| `home-closing-counter` | 12:5 | Quiet counter detail before opening — stacked plates, a plant, timber counter. No people, no devices. Bleed behind the closing CTA. Decorative (empty alt). |

The list lives in code at `app/(marketing)/_components/image-slot.tsx`
(`HOME_IMAGE_SLOTS`), so a shot that gets commissioned has exactly one place to
land and a picture that is not in that list cannot be on the page.

## Colour and contrast

| Pairing | Ratio | Used for |
| --- | --- | --- |
| `#008cff` (`--surge-accent`) on white | **3.40:1** | Non-text only: icon strokes, the active tab bar, the pill ring, a rule. Fails AA for text. |
| `#0069d9` (`--surge-action`) on white | **5.22:1** | Every blue word on a light surface, every fill that carries white text, the focus ring. |
| White on `#0069d9` | **5.22:1** | Primary buttons, the "Product preview" badge. |
| `#008cff` on `#17191d` | **5.19:1** | Blue text and the focus ring on the charcoal band. |
| White on `#17191d` | **17.60:1** | Charcoal band body and headings, footer headings. |
| `#b6bdc6` on `#17191d` | **9.29:1** | Muted copy on the charcoal band and in the footer. |
| `#17191d` on white | **17.60:1** | Body ink. |
| `#56606c` (`--surge-muted`) on white | **6.39:1** | Secondary copy. |
| `#56606c` on `#fafafa` | **6.12:1** | Secondary copy on the canvas band. |
| `#56606c` on `#f3f3ef` | **5.74:1** | Secondary copy on the warm band. |
| `#dce1e7` (`--surge-border`) on white | 1.31:1 | Card edges only — decorative, no requirement. |
| `#8b95a1` (`--surge-border-control`) on white | **3.04:1** | Every form-control and outline-button edge; clears WCAG 1.4.11's 3:1. |
| `#b42318` (`--surge-danger`) on white | **7.10:1** | Field errors. |
