import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "./shared-metadata";
import { JsonLd } from "./jsonld";
import {
  Band,
  Container,
  Eyebrow,
  Heading,
  ArrowRight,
  btnPrimary,
  btnOutline,
  btnOutlineAccent,
  linkAction,
} from "./_components/primitives";
import { SurgePhoto, SURGE_PHOTOS, TerminalFigure } from "./_components/photo";
import { SolutionCard } from "./_components/solution-card";
import { ProductPreviewFrame } from "./_components/product-preview";
import { PreviewTabs, type PreviewTab } from "./_components/preview-tabs";
import { FloorPlanPanel, KitchenPanel, OrdersPanel, ReportsPanel } from "./_components/preview-panels";
import { FaqAccordion, type FaqItem } from "./_components/faq-accordion";
import { CtaBand } from "./_components/cta-band";
import { TERMINAL_COPY, TERMINAL_CTA, TERMINAL_CTA_HREF } from "@/lib/services/terminal-availability";

// THE HOME PAGE, REBUILT AGAINST mockups/01-home.jpg.
//
// Section order is the mockup's: hero → three value props → the charcoal
// product band with tabbed previews → solutions pair → pricing and planned
// terminal → three onboarding steps → FAQ → closing CTA.
//
// WHERE THE COPY DEPARTS FROM THE MOCKUP, AND WHY. START-HERE.md is explicit
// that "small raster text … is not production copy. Use the written rules …
// when they differ", and CONTENT-AND-LAUNCH-RULES.md is the written rule. Four
// lines in 01-home.jpg would have published a claim we cannot stand behind:
//
//   1. "Straightforward rates for card payments." → a published-rate promise on
//      a page that has no rates. Replaced with the approved market caveat.
//   2. "See our pricing / Transparent and easy to understand." + "View all
//      rates and fees" → both imply a rate card exists. Replaced with the
//      approved "Request pricing" enquiry flow.
//   3. "On-site or remote training" → onsite service is not something we can
//      promise in an unconfirmed market. Now "Remote training".
//   4. The FAQ answers are written here rather than lifted from the raster,
//      because two of the three questions are about price and setup time and
//      the mockup's answers are not legible at 971px anyway.
//
// Everything else — headings, eyebrows, CTA labels, section order — is the
// mockup's, verbatim.

export const metadata: Metadata = {
  // No geography, no competitor, no price. "Point of sale + payments" mirrors
  // the hero eyebrow; "payments" is safe because the terminal's state is stated
  // in the description itself.
  title: { absolute: "Point of Sale & Payments for Restaurants and Local Business | Surge" },
  description:
    "Surge is a point-of-sale system for restaurants, cafés, shops and service counters — orders, floor plan, kitchen display, inventory and reports in one place. Payment terminal coming soon; request pricing for your market.",
  alternates: { canonical: "/" },
  openGraph: {
    ...OG_BASE,
    title: "Point of Sale & Payments for Restaurants and Local Business | Surge",
    description:
      "Orders, floor plan, kitchen display, inventory and reports in one point-of-sale system. Payment terminal coming soon.",
    url: "/",
  },
};

/* ------------------------------------------------------------- section data */

// THE THREE VALUE-PROP ICONS, REDRAWN TO THE MOCKUP'S SUBJECTS AND SCALE.
//
// What was here before was a generic set — a briefcase, a plain card, a pair of
// headphones — at 32px. 01-home.jpg draws three specific objects at ~48px:
//
//   1. a countertop POS terminal with a receipt curling out of the top,
//   2. a payment card tilted off-axis with a coin beside it,
//   3. a headset with a BOOM MIC, not bare headphones.
//
// The subject is the point. A briefcase says "business"; a terminal with a
// receipt says "this is the thing on your counter". They render at 48px, which
// is where the mockup draws them and where a 1.6px line still reads.
const VALUE_PROPS = [
  {
    title: "Built-in POS",
    body: "Everything you need to take orders, manage operations and grow.",
    // Countertop terminal: tapered body, a screen, a keypad row, and a receipt
    // standing up out of the slot behind it. The receipt is what stops the
    // silhouette reading as a shopping bag, which is what a narrower version of
    // it did on the first pass.
    icon: (
      <>
        {/* The receipt: an OPEN shape, off-centre to the right, feeding up out
            of the body's slot. Closed and centred it read as a carrier-bag
            handle, which is the generic icon this one is replacing. */}
        <path d="M11.2 8.4V4.5h5.6v3.9" />
        <path d="M12.4 6.2h3.2" />
        <path d="M6 8.4h11.6l1 9.9a1.4 1.4 0 0 1-1.4 1.55H6.4A1.4 1.4 0 0 1 5 18.3z" />
        <rect x="6.9" y="10.2" width="6.4" height="2.8" rx="0.6" />
        <path d="M7.3 16.1h1.5M10 16.1h1.5M12.7 16.1h1.5" />
      </>
    ),
  },
  {
    title: "Clear payment pricing",
    // Mockup: "Simple, transparent rates with no surprises." That is a rate
    // claim on a page with no rates, so the promise becomes the thing we can
    // actually keep — a written quote with nothing hidden under it.
    body: "One written quote for your market, with nothing hidden underneath it.",
    // Tilted card with a stripe and a chip, plus the small coin the mockup
    // tucks under its lower-right corner.
    icon: (
      <>
        <rect x="2.4" y="6.4" width="17.6" height="11.4" rx="2" transform="rotate(-7 2.4 6.4)" />
        <path d="M2 10.7l17.4-2.2" />
        <rect x="12.6" y="12.1" width="3.6" height="2.6" rx="1.3" transform="rotate(-7 12.6 12.1)" />
        <circle cx="20.6" cy="18.8" r="1.5" />
      </>
    ),
  },
  {
    title: "Local setup & support",
    body: "Real people who know your business and are here to help.",
    // Headband, two ear cups, and the boom arm curving down to the mic bead —
    // the part that makes it a support headset rather than headphones.
    icon: (
      <>
        <path d="M4.6 12.2v-1.1a7.4 7.4 0 0 1 14.8 0v1.1" />
        <rect x="2.2" y="11.4" width="4.2" height="6.2" rx="1.8" />
        <rect x="17.6" y="11.4" width="4.2" height="6.2" rx="1.8" />
        <path d="M17.6 17.6v.5a2.8 2.8 0 0 1-2.8 2.8h-2.2" />
        <circle cx="11.2" cy="20.9" r="1.3" />
      </>
    ),
  },
];

// EACH TAB SHOWS THE SCREEN IT NAMES AND THE SCREEN IT HANDS WORK TO.
// 01-home.jpg draws two frames side by side under the "Floor plan" tab — the
// floor and the kitchen — because that is the handoff a service actually makes.
// The other tabs follow the same rule: an order goes floor → kitchen, a ticket
// goes kitchen → orders. Reports is where work ends, so it shows alone.
// THE TWO FRAMES ARE NOT EQUAL WIDTHS, and that is the mockup's doing: it
// draws the floor plan at 308px and the kitchen at 405px on a 1280 canvas,
// because a grid of table chips reads fine narrow and three parallel tickets
// do not. Splitting them 50/50 wrapped "1 Chicken sandwich" onto two lines,
// which in a ticket list looks like two items.
const PAIR = "grid gap-[var(--surge-space-4)] sm:grid-cols-[minmax(0,43fr)_minmax(0,57fr)]";
const PAIR_WIDE_FIRST = "grid gap-[var(--surge-space-4)] sm:grid-cols-[minmax(0,57fr)_minmax(0,43fr)]";

const PREVIEW_TABS: PreviewTab[] = [
  {
    id: "floor-plan",
    label: "Floor plan",
    panel: (
      <div className={PAIR}>
        <ProductPreviewFrame screenLabel="Floor plan">
          <FloorPlanPanel />
        </ProductPreviewFrame>
        <ProductPreviewFrame screenLabel="Kitchen display">
          <KitchenPanel />
        </ProductPreviewFrame>
      </div>
    ),
  },
  {
    id: "orders",
    label: "Orders",
    panel: (
      <div className={PAIR_WIDE_FIRST}>
        <ProductPreviewFrame screenLabel="Orders">
          <OrdersPanel />
        </ProductPreviewFrame>
        <ProductPreviewFrame screenLabel="Floor plan">
          <FloorPlanPanel />
        </ProductPreviewFrame>
      </div>
    ),
  },
  {
    id: "kitchen",
    label: "Kitchen",
    panel: (
      <div className={PAIR_WIDE_FIRST}>
        <ProductPreviewFrame screenLabel="Kitchen display">
          <KitchenPanel />
        </ProductPreviewFrame>
        <ProductPreviewFrame screenLabel="Orders">
          <OrdersPanel />
        </ProductPreviewFrame>
      </div>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    panel: (
      <div className="sm:max-w-[60%]">
        <ProductPreviewFrame screenLabel="Reports">
          <ReportsPanel />
        </ProductPreviewFrame>
      </div>
    ),
  },
];

// Four planned capabilities, with the mockup's TWO-AND-TWO tick treatment
// restored: the first pair — the two capability claims, the ones that end
// "(planned)" — take a circled tick, and the closing pair takes a bare one.
// That contrast is doing work. It is what visually separates "here is a thing
// the hardware is intended to do" from "here is a note about the hardware", on
// a list where every line is about a product that does not exist yet.
//
// The third line lost its "(planned)" in the process. Marking every line
// "(planned)" flattened the distinction the ticks draw, and "Designed for busy
// counters" is a statement about intent rather than availability — it sits
// under a "Planned — not yet available" heading, beside a "Payment terminal ·
// Coming soon" label and a concept caption, so nothing about it reads as a
// shipping claim.
const TERMINAL_POINTS: { text: string; circled: boolean }[] = [
  { text: "Accept tap, insert and swipe (planned)", circled: true },
  { text: "Works with Surge POS (planned)", circled: true },
  { text: "Designed for busy counters", circled: false },
  { text: "More details coming soon", circled: false },
];

const STEPS = [
  { n: "01", title: "Plan your setup", body: "We'll learn about your business and recommend the right setup." },
  { n: "02", title: "Bring your menu", body: "We'll help you get your items, modifiers and settings just right." },
  // Mockup: "On-site or remote training…". Onsite service is not confirmed for
  // any market, and the rules forbid advertising it without confirmation.
  { n: "03", title: "Train your team", body: "Remote training to get everyone confident and ready." },
];

const FAQS: FaqItem[] = [
  {
    q: "How does pricing work?",
    a: "Plans, currencies and payment options vary by market, so there is no published rate card. Tell us where you are and how your business runs, and we will put a written quote together for you.",
  },
  {
    q: "How long does setup take?",
    a: "It depends on the size of your menu or catalogue and how many devices you are running. We plan it with you on a call first, so you know what is involved before you commit to a date.",
  },
  {
    q: "Do you offer training and support?",
    a: "Yes. We set the system up with you, walk your staff through the screens they will actually use, and stay reachable afterwards at info@surgetechpos.com or +1 888 648 8097.",
  },
];

// FAQPage structured data built from the same array the accordion renders, so
// the markup and the rich result cannot disagree — a mismatch between the two
// is a manual action waiting to happen.
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/* -------------------------------------------------------------------- page */

export default function HomePage() {
  return (
    <>
      <JsonLd data={FAQ_JSONLD} />

      {/* ------------------------------------------------------------ hero -- */}
      {/* The header is `overlay` on this route, so the hero owns the top of the
          viewport and has to clear 72px of nav itself. On mobile the text comes
          FIRST in the DOM and the photograph after it — DESIGN-SYSTEM.md asks
          for exactly that, and it is source order rather than a CSS reorder, so
          a screen reader gets the same sequence. */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-[var(--surge-surface)]">
        {/* THE PHOTOGRAPH BLEEDS TO y=0, BEHIND THE HEADER. `inset-y-0` on a
            section that is the first thing in <main>, with an absolutely
            positioned header over it, is what the mockup draws: the room runs
            up past the nav to the top of the viewport and the nav floats on it.
            No terminal label on this picture — 01-home-owner.jpg has a tablet
            in it and no card reader, and ASSET-CATALOG.md forbids the
            coming-soon label on the photographs that do not show the terminal.
            The hardware caveat is still on this screen, in live text, directly
            under the CTAs.

            52%, the mockup's split. It was 44% while the headline had to hold
            two lines at a larger H1; the type scale now matches the mockup's,
            so the four points go back to the picture.

            ONE <Image>, TWO LAYOUTS. It sits after the copy in the DOM — which
            is the order DESIGN-SYSTEM.md asks for on a narrow screen and the
            order a screen reader gets — and from `lg` the same element goes
            absolute and bleeds off the right. Rendering it twice, once per
            breakpoint, would mean two eager preloads for one above-the-fold
            picture, and the rule is to eager-load the hero, singular. */}
        <Container className="relative z-10">
          <div className="pb-[var(--surge-space-6)] pt-[calc(72px+var(--surge-space-6))] lg:w-[52%] lg:pb-[var(--surge-space-7)] lg:pr-[var(--surge-space-5)] lg:pt-[calc(72px+var(--surge-space-6))]">
            <Eyebrow>Point of sale + payments</Eyebrow>
            <Heading as="h1" size="display" id="hero-title" className="mt-[var(--surge-space-4)] text-[var(--surge-ink)]">
              Run the rush.
              <br />
              Grow your business.
            </Heading>
            {/* TWO LINES, as the mockup sets it, breaking after "operations,".
                The measure was 34ch, which forced a third line. 46ch is the
                width the mockup's sub actually occupies. */}
            <p className="mt-[var(--surge-space-4)] max-w-[46ch] text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              Point of sale, payments and everyday operations, together. Built for restaurants and local businesses.
            </p>
            <div className="mt-[var(--surge-space-5)] flex flex-col gap-[var(--surge-space-3)] sm:flex-row">
              <Link href="/book" className={btnPrimary}>
                Book a demo <ArrowRight />
              </Link>
              {/* Anchors the planned-terminal band further down this page — the
                  mockup's second hero button, with a destination that exists. */}
              <a href="#payment-terminal" className={btnOutline}>
                Explore the planned terminal
              </a>
            </div>
            <p className="mt-[var(--surge-space-4)] text-[length:var(--surge-small)] text-[var(--surge-muted)]">
              {TERMINAL_COPY.note}
            </p>
          </div>
        </Container>

        {/* The photograph. In flow and inside the rail below `lg`; absolute and
            bleeding to all four edges of the section from `lg` up.

            THE ANCHOR MOVES WITH THE BREAKPOINT. The catalog's 65% 50% holds
            her face and the tablet inside a tall 52%-wide column, but the same
            anchor on a full-width 3:2 crop at 375 pushed her to the left edge
            and filled the frame with the room behind her. 55% centres her
            there. One custom property, two values, no second <img>. */}
        {/* The rail is spelled out in utilities rather than reusing
            `.surge-wrap`: that class lives in tokens.css, which is imported
            after Tailwind's utility layer, so its `width:100%; max-width:1240px`
            beat `lg:w-[52%]` and the picture silently rendered full-width behind
            the copy. Same declarations, one cascade layer, responsive overrides
            that actually win. */}
        <div className="mx-auto w-full max-w-[var(--surge-content-width)] px-[var(--surge-gutter)] pb-[var(--surge-space-6)] [--hero-pos:55%_50%] lg:absolute lg:inset-y-0 lg:right-0 lg:z-0 lg:mx-0 lg:w-[52%] lg:max-w-none lg:px-0 lg:pb-0 lg:[--hero-pos:65%_50%]">
          <div className="aspect-[3/2] lg:aspect-auto lg:h-full">
            {/* 52vw at 1440 is ~749px; at 2× that asks for ~1498px against a
                1536px source — the widest derivative on the page, and still
                inside native. */}
            <SurgePhoto
              photo={SURGE_PHOTOS.homeOwner}
              fill
              rounded={false}
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              position="var(--hero-pos)"
              className="rounded-[var(--surge-radius-card)] lg:rounded-none"
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- value props -- */}
      <Band tone="canvas" className="border-y border-[var(--surge-border)]">
        <Container>
          <ul className="grid gap-[var(--surge-space-5)] py-[var(--surge-space-4)] md:grid-cols-3 md:divide-x md:divide-[var(--surge-border)]">
            {VALUE_PROPS.map((v, i) => (
              <li key={v.title} className={"flex gap-[var(--surge-space-4)] " + (i > 0 ? "md:pl-[var(--surge-space-6)]" : "")}>
                {/* 48px, which is the size the mockup draws these at — they
                    were 32px, about half the drawn area, and read as bullets
                    rather than as the three things the band is about.
                    The accent is 3.40:1 on this surface — under AA for text,
                    over WCAG's 3:1 for a meaningful graphic, which is what an
                    icon beside its own label is. */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-12 w-12 flex-none text-[var(--surge-accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {v.icon}
                </svg>
                <div>
                  <h2 className="text-[length:var(--surge-h4)] font-bold text-[var(--surge-ink)]">{v.title}</h2>
                  <p className="mt-1 max-w-[34ch] text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{v.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Band>

      {/* --------------------------------------------- charcoal product band */}
      <Band tone="dark" labelledBy="product-band-title">
        <Container className="py-[var(--surge-space-6)]">
          <PreviewTabs
            label="Product previews"
            tabs={PREVIEW_TABS}
            aside={
              <div>
                <Heading as="h2" size="bandDisplay" id="product-band-title">
                  From first order
                  <br />
                  to final payment.
                </Heading>
                <p className="mt-[var(--surge-space-4)] max-w-[40ch] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-on-dark-muted)]">
                  A modern POS built for the pace of your business. Take orders, send to the kitchen, accept payments and keep everything in sync.
                </p>
              </div>
            }
          />
        </Container>
      </Band>

      {/* --------------------------------------------------------- solutions */}
      <Band tone="surface" labelledBy="solutions-title">
        <Container className="py-[var(--surge-space-5)]">
          <Eyebrow>
            <span id="solutions-title">Solutions for your business</span>
          </Eyebrow>
          {/* PAGE-PLACEMENT.md, section 3 of "/": 06-cafe-barista for the
              restaurant card, 05-retail-owner for retail. Neither photograph
              contains a card reader, so neither carries the coming-soon label —
              see the note in solution-card.tsx. */}
          <div className="mt-[var(--surge-space-4)] grid gap-[var(--surge-space-5)] md:grid-cols-2">
            <SolutionCard
              href="/pos-for-restaurants"
              title="Restaurants & cafés"
              body="Table service, quick service and everything in between."
              image={SURGE_PHOTOS.cafeBarista}
            />
            <SolutionCard
              href="/pos-for-retail"
              title="Retail & service counters"
              body="Simple, powerful tools for everyday sales."
              image={SURGE_PHOTOS.retailOwner}
            />
          </div>
        </Container>
      </Band>

      {/* ------------------------------------- pricing / planned terminal --- */}
      <Band tone="canvas" className="border-y border-[var(--surge-border)]">
        <Container className="grid gap-[var(--surge-space-6)] py-[var(--surge-space-4)] lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-[var(--surge-space-7)]">
            <Eyebrow>Simple, transparent pricing</Eyebrow>
            <Heading as="h2" size="h2" className="mt-3 text-[var(--surge-ink)]">
              Know what you pay.
            </Heading>
            {/* Mockup: "Straightforward rates for card payments." Replaced with
                the approved market caveat — there is no published rate. */}
            <p className="mt-3 max-w-[42ch] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              {TERMINAL_COPY.marketNote}
            </p>
            <div className="mt-[var(--surge-space-5)] rounded-[var(--surge-radius-card)] border border-[var(--surge-border)] bg-[var(--surge-surface)] p-[var(--surge-space-5)]">
              <h3 className="text-[length:var(--surge-h3)] font-bold text-[var(--surge-ink)]">Request pricing</h3>
              <p className="mt-1.5 max-w-[40ch] text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
                Tell us where you are and how your business runs, and we will put a written quote together.
              </p>
            </div>
            {/* Mockup: "View all rates and fees →". There is no rates page and
                there are no fees to list, so the link goes to the enquiry. */}
            <Link href="/pricing" className={linkAction + " mt-[var(--surge-space-5)] inline-flex items-center gap-2 text-[length:var(--surge-small)]"}>
              See plans and request a quote <ArrowRight />
            </Link>
          </div>

          <div id="payment-terminal" className="scroll-mt-[96px] lg:border-l lg:border-[var(--surge-border)] lg:pl-[var(--surge-space-7)]">
            {/* NO SHORT "COMING SOON" CHIP BESIDE THE EYEBROW ANY MORE. The
                mockup has no chip here, and the figure below now carries the
                full approved string — "Payment terminal · Coming soon" — right
                above the photograph, where the rule wants it. Two coming-soon
                markers 200px apart is one more than the reader needs and one
                more to keep in step. */}
            <Eyebrow>Payment terminal</Eyebrow>
            <Heading as="h2" size="h2" className="mt-3 text-[var(--surge-ink)]">
              Explore the planned terminal.
            </Heading>
            {/* "reliable" restored — it is the mockup's word and it describes an
                intention for hardware that is openly labelled as not yet built,
                not a service-level promise about something on sale. */}
            <p className="mt-3 max-w-[58ch] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              A compact, reliable card reader designed for your business.
            </p>

            <div className="mt-[var(--surge-space-4)] grid gap-[var(--surge-space-5)] sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
              {/* THE ONE SANCTIONED WRAPPER FOR 07-terminal-concept.jpg. It
                  renders the photograph, then the live status line, then the
                  concept caption — all three inside this <figure>, as real text
                  in the served HTML, at every width and with no hover. */}
              <TerminalFigure sizes="(min-width: 640px) 180px, 100vw" />
              <div>
                <h3 className="text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-muted)]">
                  Planned — not yet available
                </h3>
                <ul className="mt-2 space-y-2 text-[length:var(--surge-small)] text-[var(--surge-ink)]">
                  {TERMINAL_POINTS.map((p) => (
                    <li key={p.text} className="flex gap-2.5">
                      {/* TWO CIRCLED, TWO BARE — the mockup's own split, and
                          the thing that makes the "(planned)" pair read as a
                          pair. Decorative either way: the meaning is in the
                          words beside them and in the heading above. */}
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-[var(--surge-action)]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        {p.circled ? <circle cx="10" cy="10" r="8" /> : null}
                        <path d={p.circled ? "M6.5 10.2l2.4 2.4 4.6-5" : "M4 10.6l3.6 3.6 8.4-8.4"} />
                      </svg>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* "Get terminal updates" — one of the two CTA labels the launch
                rules allow. Never Buy, Preorder, Available now or a date. It
                goes to the existing /contact form, which posts to
                `submitContact` (zod, honeypot, shared 5-per-IP-per-hour
                throttle, checked send). No new endpoint: a second
                unauthenticated mail path on the domain that carries merchant
                receipts is an open relay with a friendlier name. */}
            <Link href={TERMINAL_CTA_HREF} className={btnOutlineAccent + " mt-[var(--surge-space-5)]"}>
              {TERMINAL_CTA.updates} <ArrowRight />
            </Link>
          </div>
        </Container>
      </Band>

      {/* ------------------------------------------------- onboarding steps */}
      <Band tone="surface" labelledBy="get-started-title">
        {/* The heading column is a shade wider than a quarter, which is what
            lets "A smoother switch / starts here." sit on the mockup's two
            lines instead of three. */}
        <Container className="grid gap-[var(--surge-space-6)] py-[var(--surge-space-5)] lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-0">
          <div className="lg:pr-[var(--surge-space-6)]">
            <Eyebrow>Get started</Eyebrow>
            <Heading as="h2" size="h2" id="get-started-title" className="mt-3 text-[var(--surge-ink)]">
              A smoother switch
              <br />
              starts here.
            </Heading>
            <p className="mt-3 max-w-[34ch] text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              We make it simple to get up and running, with hands-on support at every step.
            </p>
          </div>
          {STEPS.map((s) => (
            <div key={s.n} className="lg:border-l lg:border-[var(--surge-border)] lg:pl-[var(--surge-space-6)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--surge-accent)] text-[length:var(--surge-small)] font-bold text-[var(--surge-action)]">
                {s.n}
              </span>
              <h3 className="mt-[var(--surge-space-4)] text-[length:var(--surge-h3)] font-bold text-[var(--surge-ink)]">{s.title}</h3>
              <p className="mt-2 max-w-[32ch] text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{s.body}</p>
            </div>
          ))}
        </Container>
      </Band>

      {/* --------------------------------------------------------------- FAQ */}
      <Band tone="canvas" className="border-t border-[var(--surge-border)]" labelledBy="faq-title">
        <Container className="grid gap-[var(--surge-space-5)] py-[var(--surge-space-4)] lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)] lg:gap-[var(--surge-space-7)]">
          <div>
            <Eyebrow>Frequently asked questions</Eyebrow>
            <Heading as="h2" size="h2" id="faq-title" className="mt-3 text-[var(--surge-ink)]">
              Quick answers.
              <br />
              Real support.
            </Heading>
          </div>
          <FaqAccordion items={FAQS} />
        </Container>
      </Band>

      {/* -------------------------------------------------------- closing CTA */}
      {/* THE CLOSING BLEED IS 04-male-tableside.jpg, DECORATIVE.
          PAGE-PLACEMENT.md's table for "/" names four photographs — hero,
          the two solution cards and the terminal — and does not list this band
          at all, but 01-home.jpg draws a photograph bleeding off its right edge
          and the handoff is explicit that "the eight images are deliberately
          reused across 22 pages; do not invent a separate image for every
          section". 04 is the only service-floor shot not already on this page,
          it contains no card reader, and it carries empty alt because the
          heading beside it already says what it is. Flagged in the report as a
          placement beyond the table rather than a silent addition. */}
      <CtaBand
        id="see-surge"
        title="See Surge at your counter."
        sub="A modern POS, built for real businesses."
        cta="Book a demo"
        href="/book"
        image={{ ...SURGE_PHOTOS.maleTableside, alt: "" }}
      />
    </>
  );
}
