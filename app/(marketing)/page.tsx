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
import { ImageSlot, HOME_IMAGE_SLOTS } from "./_components/image-slot";
import { TerminalImageFrame, ComingSoonBadge } from "./_components/coming-soon-badge";
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

const VALUE_PROPS = [
  {
    title: "Built-in POS",
    body: "Everything you need to take orders, manage operations and grow.",
    icon: (
      <>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M7 13h3M14 13h3" />
      </>
    ),
  },
  {
    title: "Clear payment pricing",
    // Mockup: "Simple, transparent rates with no surprises." That is a rate
    // claim on a page with no rates, so the promise becomes the thing we can
    // actually keep — a written quote with nothing hidden under it.
    body: "One written quote for your market, with nothing hidden underneath it.",
    icon: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <path d="M2.5 10h19M6 14.5h3" />
      </>
    ),
  },
  {
    title: "Local setup & support",
    body: "Real people who know your business and are here to help.",
    icon: (
      <>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <rect x="2.5" y="13" width="4" height="6" rx="1.6" />
        <rect x="17.5" y="13" width="4" height="6" rx="1.6" />
        <path d="M19.5 19v.5a2.5 2.5 0 0 1-2.5 2.5h-2" />
      </>
    ),
  },
];

// EACH TAB SHOWS THE SCREEN IT NAMES AND THE SCREEN IT HANDS WORK TO.
// 01-home.jpg draws two frames side by side under the "Floor plan" tab — the
// floor and the kitchen — because that is the handoff a service actually makes.
// The other tabs follow the same rule: an order goes floor → kitchen, a ticket
// goes kitchen → orders. Reports is where work ends, so it shows alone.
const PREVIEW_TABS: PreviewTab[] = [
  {
    id: "floor-plan",
    label: "Floor plan",
    panel: (
      <div className="grid gap-[var(--surge-space-5)] sm:grid-cols-2">
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
      <div className="grid gap-[var(--surge-space-5)] sm:grid-cols-2">
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
      <div className="grid gap-[var(--surge-space-5)] sm:grid-cols-2">
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

// Four planned capabilities. Every one is written in future tense and the list
// carries its own heading saying so, because this is hardware that does not
// exist yet and a present-tense feature list is a specification.
const TERMINAL_POINTS = [
  "Accept tap, insert and swipe (planned)",
  "Works with Surge POS (planned)",
  "Designed for busy counters (planned)",
  "More details coming soon",
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
        {/* 44%, where the mockup gives the photograph roughly 52%. Inter needs
            the extra width on the left to hold "Grow your business." on one
            line at the design's H1 size; the alternative was a third line in
            the headline, which is a bigger change to the hero than four
            percentage points of picture. */}
        <div className="absolute inset-y-0 right-0 hidden w-[44%] lg:block">
          <TerminalImageFrame className="h-full" position="bottom-right">
            <ImageSlot spec={HOME_IMAGE_SLOTS.hero} rounded={false} fill />
          </TerminalImageFrame>
        </div>

        <Container className="relative">
          <div className="pb-[var(--surge-space-7)] pt-[calc(72px+var(--surge-space-7))] lg:w-[56%] lg:pb-[var(--surge-space-9)] lg:pr-[var(--surge-space-5)] lg:pt-[calc(72px+var(--surge-space-8))]">
            <Eyebrow>Point of sale + payments</Eyebrow>
            <Heading as="h1" size="display" id="hero-title" className="mt-[var(--surge-space-4)] text-[var(--surge-ink)]">
              Run the rush.
              <br />
              Grow your business.
            </Heading>
            <p className="mt-[var(--surge-space-5)] max-w-[34ch] text-[length:var(--surge-body-lg)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              Point of sale, payments and everyday operations, together. Built for restaurants and local businesses.
            </p>
            <div className="mt-[var(--surge-space-6)] flex flex-col gap-[var(--surge-space-3)] sm:flex-row">
              <Link href="/book" className={btnPrimary}>
                Book a demo <ArrowRight />
              </Link>
              {/* Anchors the planned-terminal band further down this page — the
                  mockup's second hero button, with a destination that exists. */}
              <a href="#payment-terminal" className={btnOutline}>
                Explore the planned terminal
              </a>
            </div>
            <p className="mt-[var(--surge-space-5)] text-[length:var(--surge-small)] text-[var(--surge-muted)]">
              {TERMINAL_COPY.note}
            </p>
          </div>

          {/* The mobile photograph. Same slot, same label, after the copy. */}
          <div className="pb-[var(--surge-space-7)] lg:hidden">
            <TerminalImageFrame position="bottom-right">
              <ImageSlot spec={HOME_IMAGE_SLOTS.hero} />
            </TerminalImageFrame>
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------- value props -- */}
      <Band tone="canvas" className="border-y border-[var(--surge-border)]">
        <Container>
          <ul className="grid gap-[var(--surge-space-6)] py-[var(--surge-space-6)] md:grid-cols-3 md:divide-x md:divide-[var(--surge-border)]">
            {VALUE_PROPS.map((v, i) => (
              <li key={v.title} className={"flex gap-[var(--surge-space-4)] " + (i > 0 ? "md:pl-[var(--surge-space-6)]" : "")}>
                {/* The accent is 3.40:1 on this surface — under AA for text,
                    over WCAG's 3:1 for a meaningful graphic, which is what an
                    icon beside its own label is. */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 flex-none text-[var(--surge-accent)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
        <Container className="py-[var(--surge-space-9)]">
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
                <p className="mt-[var(--surge-space-5)] max-w-[40ch] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-on-dark-muted)]">
                  A modern POS built for the pace of your business. Take orders, send to the kitchen, accept payments and keep everything in sync.
                </p>
              </div>
            }
          />
        </Container>
      </Band>

      {/* --------------------------------------------------------- solutions */}
      <Band tone="surface" labelledBy="solutions-title">
        <Container className="py-[var(--surge-space-8)]">
          <Eyebrow>
            <span id="solutions-title">Solutions for your business</span>
          </Eyebrow>
          <div className="mt-[var(--surge-space-5)] grid gap-[var(--surge-space-5)] md:grid-cols-2">
            <SolutionCard
              href="/pos-for-restaurants"
              title="Restaurants & cafés"
              body="Table service, quick service and everything in between."
              image={HOME_IMAGE_SLOTS.restaurants}
            />
            <SolutionCard
              href="/pos-for-retail"
              title="Retail & service counters"
              body="Simple, powerful tools for everyday sales."
              image={HOME_IMAGE_SLOTS.retail}
              // The retail photograph contains the reader, so the label is
              // mandatory here — including at 375px, where it renders as a row
              // under the picture rather than floating over it.
              showTerminalLabel
            />
          </div>
        </Container>
      </Band>

      {/* ------------------------------------- pricing / planned terminal --- */}
      <Band tone="canvas" className="border-y border-[var(--surge-border)]">
        <Container className="grid gap-[var(--surge-space-7)] py-[var(--surge-space-8)] lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-[var(--surge-space-8)]">
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

          <div id="payment-terminal" className="scroll-mt-[96px] lg:border-l lg:border-[var(--surge-border)] lg:pl-[var(--surge-space-8)]">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Payment terminal</Eyebrow>
              <ComingSoonBadge />
            </div>
            <Heading as="h2" size="h2" className="mt-3 text-[var(--surge-ink)]">
              Explore the planned terminal.
            </Heading>
            <p className="mt-3 max-w-[44ch] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
              A compact card reader designed for your business. {TERMINAL_COPY.note}
            </p>

            <div className="mt-[var(--surge-space-5)] grid items-center gap-[var(--surge-space-5)] sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              {/* `below`, not a floated corner: a 220px square is too small to
                  carry the pill over the picture without covering the reader
                  itself, which is the one thing the shot is of. */}
              <TerminalImageFrame position="below">
                <ImageSlot spec={HOME_IMAGE_SLOTS.terminal} />
              </TerminalImageFrame>
              <div>
                <h3 className="text-[length:var(--surge-micro)] font-bold uppercase tracking-[0.08em] text-[var(--surge-muted)]">
                  Planned — not yet available
                </h3>
                <ul className="mt-2 space-y-2 text-[length:var(--surge-small)] text-[var(--surge-ink)]">
                  {TERMINAL_POINTS.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-[var(--surge-action)]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="10" cy="10" r="8" />
                        <path d="M6.5 10.2l2.4 2.4 4.6-5" />
                      </svg>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* "Get terminal updates" — one of the two CTA labels the launch
                rules allow. It goes to the existing /contact form, which posts
                to `submitContact` (zod, honeypot, shared 5-per-IP-per-hour
                throttle, checked send). No new endpoint: a second unauthenticated
                mail path on the domain that carries merchant receipts is an open
                relay with a friendlier name. */}
            <Link href={TERMINAL_CTA_HREF} className={btnOutlineAccent + " mt-[var(--surge-space-5)]"}>
              {TERMINAL_CTA.updates} <ArrowRight />
            </Link>
          </div>
        </Container>
      </Band>

      {/* ------------------------------------------------- onboarding steps */}
      <Band tone="surface" labelledBy="get-started-title">
        <Container className="grid gap-[var(--surge-space-7)] py-[var(--surge-space-8)] lg:grid-cols-4 lg:gap-0">
          <div className="lg:pr-[var(--surge-space-6)]">
            <Eyebrow>Get started</Eyebrow>
            <Heading as="h2" size="h2" id="get-started-title" className="mt-3 text-[var(--surge-ink)]">
              A smoother switch starts here.
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
        <Container className="grid gap-[var(--surge-space-6)] py-[var(--surge-space-8)] lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)] lg:gap-[var(--surge-space-8)]">
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
      <CtaBand
        id="see-surge"
        title="See Surge at your counter."
        sub="A modern POS, built for real businesses."
        cta="Book a demo"
        href="/book"
        image={HOME_IMAGE_SLOTS.closing}
      />
    </>
  );
}
