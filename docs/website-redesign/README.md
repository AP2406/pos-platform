# Surge website redesign

This branch replaces the public marketing design and the login photograph. It does not deploy the site, change database schemas, or alter POS operations or authentication.

## Design

The site uses white, warm neutral surfaces, charcoal and one restrained blue accent. Typography, spacing, keyboard focus, navigation, responsive grids and photography are shared in `app/(marketing)/marketing.css` and `design.tsx`. Product pages share a layout while keeping route-specific copy in `solution-content.ts`.

The current repository offer takes precedence over older mockups: **free full POS software during a limited pilot**. No post-pilot price, end date, processing rate or hardware price is invented. Country, device compatibility and setup availability are confirmed individually. There are no named competitor comparisons or city-restricted marketing claims.

Card processing and the payment terminal are **coming soon**. The terminal is not available to buy or preorder. Wherever the terminal concept appears, a visible HTML status and concept-image caption accompany it. Existing processing stays separate during the POS pilot.

## Image placement

The eight images are generated campaign assets from the supplied Surge image pack, converted to WebP for delivery. They are illustrative, not photographs of identified customers or testimonials. `next/image` provides responsive sizing, lazy loading and reserved image dimensions. They are not full-page image mockups; the page copy, controls and layouts are real HTML.

| Asset in `public/images/surge/` | Placement |
| --- | --- |
| `01-home-owner.webp` | Home hero; restaurant feature; demo page; buying and switching content |
| `02-team-tablet.webp` | Home team section; setup, switching and multiple-location heroes; contact; login photo panel |
| `03-tablet-counter.webp` | POS and hardware heroes; retail hardware section; payments explanation |
| `04-male-tableside.webp` | Restaurant hero; home restaurant card; handheld-device sections |
| `05-retail-owner.webp` | Retail hero; home retail card; multiple-location supporting image |
| `06-cafe-barista.webp` | Cafe hero; home cafe card |
| `07-terminal-concept.webp` | Shared coming-soon component on home, hardware and payments pages only |
| `08-guides-desk.webp` | Guides hub, article headers and POS-costs guide |

## Pages and redirects

There are 21 indexable marketing pages, plus the existing noindex login page. The sitemap is assembled from the actual product and guide content; it excludes retired routes and login. Canonical URLs, article metadata, Organization JSON-LD and social-card wording use the international positioning.

| Retired URL | Permanent destination |
| --- | --- |
| `/payment-processing-toronto` | `/solutions/cafes` |
| `/payment-processing-mississauga` | `/solutions/multi-location` |
| `/merchant-services-durham` | `/setup-and-support` |
| `/moneris-alternative` | `/choosing-a-pos` |
| `/square-alternative` | `/pos-costs` |
| `/clover-alternative` | `/pos-hardware` |
| `/stripe-alternative` | `/payments-and-pos` |
| `/td-merchant-solutions-alternative` | `/switching-to-surge` |
| `/guides/lower-credit-card-processing-fees-ontario` | `/guides/card-processing-costs` |
| `/guides/interac-vs-credit-card-fees` | `/guides/debit-vs-credit-card-fees` |

Redirects are HTTP 308 and preserve queries. The existing apex-to-www redirect remains. Because the old regional payment pages now describe different topics, monitor their organic traffic after a future deployment; this preserves usable destinations, not a guarantee of unchanged search rankings.

## Working interactions

- Desktop and mobile navigation, with current-page state, Escape dismissal and keyboard focus.
- Home product preview: order, menu and floor-plan tabs. Sample data is explicitly labelled; arrow, Home and End keys work.
- Native expandable FAQs.
- Pilot and contact forms still call the existing server actions, use the same validation and spam controls, and show retryable transport errors.
- Demo request uses an accessible native dialog with two steps, retained field values on Back, Escape dismissal and a confirmation after submission. It collects POS needs and preferred time zone instead of dollar-denominated processing qualification. The existing `submitBooking` action still receives its supported payload. It is a request, not an automatically reserved calendar slot.
- Login keeps the existing password, OAuth and password-reset implementation. Only its illustration changes; the existing theme system supports light and dark form treatments.

## Preview and release

Install root and `mobile/` dependencies as CI does, then run the usual typecheck, lint, unit and build commands. A local marketing preview can use the dummy public Supabase values shown in CI; real authentication and email delivery require the existing deployment's configured services.

The existing middleware redirects `*.vercel.app` page requests to the production domain. That behavior is preserved. Review this branch locally or in screenshots; a Vercel deployment link may show the current live site rather than these changes. Do not merge or deploy until the visual review is complete.

No real emails, pilot registrations, login attempts or payment transactions were submitted during local UI verification.
