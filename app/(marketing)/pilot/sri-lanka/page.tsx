import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../../shared-metadata";
import { JsonLd, breadcrumb, decodeEntities } from "../../jsonld";
import { Crumb, Tick, btnPrimary, btnOutline, PageHero } from "../../ui";
import { PilotLkForm } from "./pilot-lk-form";

// THE SRI LANKA PILOT PAGE.
//
// WHY IT SITS IN (marketing) AND NOT AT app/pilot/sri-lanka.
// The draft put it outside the route group. A page outside (marketing) does not
// get app/(marketing)/layout.tsx, which is where the nav, the footer and the
// Public Sans font live — so it would have rendered as an unbranded document
// with no way back into the site and no Organization JSON-LD. Inside the group
// it inherits all of that for free and costs nothing.
//
// WHAT THIS PAGE IS FOR. It is a recruitment page for a pilot, and the section
// that earns it is "What Surge does not do yet". A merchant in Colombo who finds
// out in month two that we cannot take a card is a worse outcome than one who
// never signed up, so the gaps are set at the same weight as the features, above
// the fold of their own section, and in the same typography. Nothing in that
// section may be shortened, softened, folded into a footnote or moved below the
// form. If a future edit makes it shorter, that edit is wrong.
//
// GEOGRAPHY. "We are based in Toronto" appears once, in the hero, and it is
// disclosure rather than positioning: it is the reason setup is a video call and
// the reason support is ten hours out of phase, and both of those are things the
// reader needs before they decide. It does not belong in the nav, the footer,
// the metadata or the structured data, and the rest of the site was deliberately
// cleared of exactly that kind of claim (see ../../jsonld.tsx).
//
// ═══ EVERY FEATURE CLAIM BELOW WAS CHECKED AGAINST THE CODE ═══
// Four claims from the approved copy were cut or corrected because the product
// does not support them as written. Each cut is annotated at the point it was
// made. They were cut rather than softened: a hedged version of a claim that is
// not true is still not true.

export const metadata: Metadata = {
  title: { absolute: "POS for restaurants in Sri Lanka — free pilot | Surge" },
  description:
    "Surge is a point-of-sale system for independent restaurants, cafes and shops in Sri Lanka — register, floor plan, kitchen display, reservations, inventory and staff. Free while the pilot runs. Set up over a video call. We do not process cards.",
  alternates: { canonical: "/pilot/sri-lanka" },
  openGraph: {
    ...OG_BASE,
    // en_LK is the one piece of locale signalling on this page. It tells a
    // crawler and a share card which English this is written for; it is not a
    // service-area claim and there is no hreflang cluster behind it, because
    // there is no other-language version of this page to point at.
    locale: "en_LK",
    title: "The whole till, free while the pilot runs — Surge in Sri Lanka",
    description:
      "We are looking for independent restaurants, cafes and shops in Sri Lanka to run Surge for real. Full point of sale, free during the pilot, set up over a video call. Read what it does not do before you sign up.",
    url: "/pilot/sri-lanka",
  },
};

// ----- WHAT YOU GET -----
//
// Every line here maps to a screen that exists. The verification notes are kept
// inline rather than in a doc, because the next person to edit this array needs
// them at the moment they are tempted to add a line.
const capabilities: { title: string; body: string }[] = [
  {
    title: "Front of house",
    // VERIFIED: seats (app/app/pos/register-client.tsx — per-line `seat`,
    // shared seats, seat-level split in split-alloc.ts), modifiers (nested,
    // supabase/migrations/0010 + 0011), allergy notes (lib/allergens.ts plus
    // free-text per line, printed and shown on the KDS), coursing
    // (app/app/pos/courses-actions.ts, fireCourse in ticket-actions.ts),
    // floor plan (app/app/settings/floor-card.tsx, app/app/floor/), move table
    // (moveTicketToTable), assign server (setTicketServer), merge
    // (mergeTickets).
    //
    // CHANGED FROM THE APPROVED COPY: "hand off a section" -> "hand one
    // server's tables to another". Sections are real and a server can be
    // assigned to one, but the handoff action (transferTables) moves EVERY open
    // ticket owned by a server, not the open tickets in a chosen section. The
    // sentence now describes the thing that runs.
    body: "A register that knows about seats, modifiers, allergy notes and coursing. A floor plan and real table service: move a table, assign a server, hand one server's tables to another at the end of a shift, merge two tables into one bill.",
  },
  {
    title: "Kitchen",
    // VERIFIED: lib/services/fire-to-kitchen.ts splits a fired order into one
    // kitchen_ticket per station; app/app/kitchen/page.tsx pins a screen to a
    // station via ?station=<id>. With no stations configured it degrades to one
    // ticket, which is the sane default rather than a broken one.
    body: "A kitchen display routed by station, so the grill sees grill tickets and nothing else. Bump, recall and re-fire; rush a ticket; message the line.",
  },
  {
    title: "Ordering",
    // VERIFIED: online ordering (app/order/[businessId]/), QR ordering per
    // table (app/order/[businessId]/[elementId]/ with printable placards at
    // app/app/floor/qr-codes/), kiosk (app/kiosk/[businessId]/), menu board
    // (app/menu/[businessId]/).
    //
    // CUT FROM THE APPROVED COPY: "pay-at-table". The code is real and good —
    // app/order/[businessId]/[elementId]/pay-actions.ts runs a genuine card
    // charge — but it runs on Finix, and Finix onboarding in this repo is
    // Canada-only (app/hq/onboarding/provision-actions.ts hardcodes
    // country "CAN", currency "CAD" and asks for institution and transit
    // numbers). We cannot switch it on for a Colombo merchant, and this page
    // says four inches further down that we do not process cards anywhere. A
    // page cannot offer pay-at-table and disclaim card processing in the same
    // breath. Online ordering is named as pickup for the same reason: the guest
    // pays when they collect.
    body: "Online ordering for pickup, QR ordering at the table, a self-serve kiosk, and a digital menu board for a screen on the wall.",
  },
  {
    title: "Front desk",
    // VERIFIED: app/app/reservations/ — bookings and, as the same record with
    // no scheduled time, a walk-in waitlist with a quoted wait and guest paging
    // by SMS or email (pageWaitlistGuest, supabase/migrations/0060).
    body: "Reservations, and a walk-in waitlist that quotes a wait and pages the guest when the table is ready.",
  },
  {
    title: "Back of house",
    // VERIFIED: inventory (app/app/inventory/), purchasing and receiving
    // (app/app/purchasing/, migrations 0030 + 0031), recipes and plate costing
    // (0028_recipe_costing.sql), waste (0032_waste_tracking.sql), roles and
    // permissions (lib/permissions.ts + per-business roles in 0037),
    // scheduling (0046_shifts.sql), time clock (0019_time_clock.sql),
    // attendance (app/app/attendance/), labour reporting (app/app/labor/).
    //
    // CHANGED FROM THE APPROVED COPY: "low-stock alerts" -> reorder points that
    // are flagged on screen. Reorder points are real and three surfaces show
    // them (a badge on the register, a count on the inventory page, a suggested
    // order in purchasing) but nothing is sent to anybody. "Alerts" promises
    // being told; the only owner-alert plumbing in the repo
    // (lib/services/owner-alerts.ts) has one call site and it is not inventory.
    body: "Inventory with counts and reorder points — flagged on the register and turned into a suggested order in purchasing. Purchase orders and receiving, recipes with plate costs, waste tracking. Staff roles and permissions, scheduling, a time clock, attendance and labour reporting.",
  },
  {
    title: "Reporting",
    // VERIFIED: app/app/reports/ plus a real daily digest cron
    // (app/api/scheduled-reports/route.ts, scheduled in vercel.json), CSV
    // exports across app/api/exports/ and app/app/accounting/, multi-location
    // via orgs + businesses.org_id (0069_config_store.sql) with a cross-site
    // roll-up at app/app/locations/.
    body: "Daily reports, including a digest that arrives without you asking for it, and CSV export for whoever does your books. Several locations on one account, with a roll-up across them.",
  },
  {
    title: "Runs on what you have",
    // VERIFIED with a qualifier that is doing real work. There is a genuine
    // native app at mobile/ (Expo SDK 52, iOS bundle com.surgetechpos.pos,
    // supportsTablet, 13 screens) — not a web wrapper. But it is a TestFlight
    // pilot build, not an App Store release, and per
    // mobile/docs/testflight-release-notes.md it neither takes payment nor
    // prints. Saying "native iPad app" flat would be read as "you can run your
    // restaurant on an iPad today", which is not what ships. The printing and
    // payment limits are also listed in the gaps below, where they belong.
    body: "A native iPad app — a pilot build we install for you, not on the App Store yet — or any browser on any machine you already own. The kiosk, the menu board and the QR ordering pages are all just web pages.",
  },
  // ═══ CUT FROM THE APPROVED COPY: "Set to your clock and your currency" ═══
  //
  // The approved block read: "choose Asia/Colombo and LKR — day boundaries,
  // dayparting, shift times and daily reports all follow it properly; a day
  // closes when your day closes, not when Toronto's does."
  //
  // The second half is true and the engine is genuinely good: lib/utils/dates.ts
  // derives the UTC offset with Intl `longOffset` and parses hours AND minutes,
  // so +05:30 computes correct day boundaries, and roughly sixty call sites read
  // the business timezone rather than the server's — reports, dayparting, shift
  // weeks, attendance, the accounting period lock.
  //
  // THE FIRST HALF IS FALSE, AND IT IS THE HALF THAT MATTERS TO THE READER.
  // You cannot choose either value in the product:
  //   - app/app/settings/settings-form.tsx offers ten North American timezones
  //     and nothing else. There is no option element for Asia/Colombo, so there
  //     is no way to pick it; the dropdown even strips "America/" from its
  //     labels.
  //   - app/app/settings/actions.ts `updateTaxAndCurrency` does
  //     `CURRENCIES.includes(input.currency) ? input.currency : "CAD"` against
  //     `["CAD", "USD"]`. LKR is silently rewritten to CAD, with no error, the
  //     first time anyone saves the tax form.
  //   - app/hq/onboarding/provision-actions.ts sets neither field when it
  //     creates a business, so both fall to the Canadian column defaults.
  //   - and about seventy render sites — the register, receipts, receipt emails,
  //     the kiosk, the menu board, the reports page — print a literal "$"
  //     regardless of what the column says.
  //
  // So the claim is cut from what you get and stated as a gap below instead.
  // It is NOT softened to "timezone support" or similar: a merchant reading
  // "set to your clock and your currency" would reasonably expect to open
  // settings and set it, and they cannot.
];

// ----- WHAT SURGE DOES NOT DO YET -----
//
// THE POINT OF THE PAGE. Ten items, and two of them were added by the code
// audit rather than supplied in the copy: the currency and clock item, and the
// iPad printing item. Adding to this list is always allowed. Removing from it,
// or rewording an item so that it promises more than it says now, is not.
const gaps: { title: string; body: string }[] = [
  {
    title: "We do not process cards. Anywhere.",
    body: "Not in Sri Lanka, not in Canada, not anywhere. Surge records the sale; you keep taking payment exactly as you do today, by whatever means you use now. We do not quote a rate because we do not have one, and there is nothing for you to switch or cancel.",
  },
  {
    title: "Setup is remote. Nobody flies out.",
    body: "We are in Toronto. Onboarding is a video call with screens shared: we load your menu, draw your floor plan, set your staff up and walk somebody through the register before you run a shift on it. It is the same work, done down a line. If what you want is a person in your dining room, we are not that.",
  },
  {
    title: "Sri Lankan tax is untested.",
    body: "Tax rates are configurable and you can set yours. But the tax model was built around Canadian rules and has not been run against Sri Lankan VAT or SSCL by anybody. We are not claiming compliance, and you should check what comes out of it with your accountant before you rely on it.",
  },
  {
    title: "Your currency and your clock are not settings yet.",
    // The gap the audit found. Stated at full strength, including what does
    // work, because a merchant deciding whether to pilot needs the real shape of
    // it rather than a flat "no".
    body: "The reporting engine handles a five-and-a-half-hour offset correctly — day boundaries, dayparting, shift times and the daily report all follow a business timezone properly. What you cannot do is pick yours. The settings screen offers North American timezones only, the currency setting accepts Canadian and US dollars and quietly rewrites anything else, and the register, receipts, kiosk and menu board print a dollar sign whatever the setting says. Making these real settings is work we have not done.",
  },
  {
    title: "No LankaPay, no local wallets.",
    body: "There is no integration with LankaPay or with any local wallet, and none is being built right now. If your customers expect to pay that way, they will keep doing it the way they do today and Surge will not be part of it.",
  },
  {
    title: "English only.",
    body: "The whole product is in English — every screen, every button, the receipts and the kitchen tickets. There is no Sinhala and no Tamil interface, and translating it is not on a schedule we can tell you about. Your staff will be reading English at the till.",
  },
  {
    title: "We are nine and a half to ten and a half hours behind you.",
    // LEFT EXACTLY AS WRITTEN, ON PURPOSE. No staffed window has been decided,
    // and naming one we cannot keep is the specific failure this page exists to
    // prevent. When the owner settles a window, it goes here — until then this
    // sentence stays vague because the truth is vague.
    body: "Our day starts as yours ends. We have not set a staffed support window, so we are not going to print one here and miss it. What we will say is that this is a real cost of piloting with us, and that during the pilot you are talking to the people who wrote the thing rather than to a queue.",
  },
  {
    title: "We do not sell or ship hardware.",
    body: "No terminals, no printers, no iPads, no cash drawers. You run it on what you already own. If your printer or your drawer does not work with it, that is a thing we would want to hear about, but it is not a thing we can post to you.",
  },
  {
    title: "The iPad app does not print or take payment.",
    // Added by the audit. mobile/src/lib/api.ts deliberately omits the money
    // writes; mobile/docs/testflight-release-notes.md says Charge and Split
    // show "Payments coming soon" and that chits are prepared but not sent.
    body: "The native iPad build runs the floor and the register, but it does not send receipts or kitchen chits to a printer and its payment buttons do nothing yet. For printing, run the browser version. It is also a pilot build we install for you by invitation, not something you can download from the App Store.",
  },
  {
    title: "There is no price after the pilot, and no discount promised.",
    body: "We have not decided what Surge costs. We are not going to invent a number here, and we are not promising early joiners a rate, a discount or grandfathered access, because a promise we are not sure we can keep is worth less than saying we do not know. What we will do is tell you before anything changes, and you can walk away.",
  },
];

// ----- WHO THIS SUITS -----
const suits = [
  "Independent places — restaurants, cafes, bakeries, bars and small shops",
  "One to three locations, not a franchise and not a chain",
  "Table service and a kitchen, where the floor plan and the kitchen display earn their keep",
  "Running on paper, a cash register, or a POS you complain about",
  "Colombo first, the rest of the country after",
];

// ----- FAQ -----
// Six questions, and every answer is one of the gaps above restated. That is
// deliberate: the FAQ is where a reader who skipped the honest list goes
// looking, and they should find the same answer there rather than a friendlier
// one. Keep them in sync.
const faqs = [
  {
    q: "Can I take card payments through Surge?",
    a: "No. Surge does not process cards anywhere in the world yet &mdash; not in Sri Lanka and not where we are. You keep taking payment exactly as you do now and Surge records the sale. There is no rate on this page because there is no rate. There is also no LankaPay or local wallet integration.",
  },
  {
    q: "Do you come and set it up?",
    a: "No &mdash; setup is remote. We are based in Toronto, so we book a video call and share screens: we load your menu, build your floor plan, set your staff up and walk somebody through the register before you run a shift on it. Nobody flies out, and we would rather say so now than have you expect a van.",
  },
  {
    q: "Does it handle Sri Lankan tax?",
    a: "Tax rates are configurable, so you can set yours. But the tax model was built around Canadian rules and nobody has tested it against Sri Lankan VAT or SSCL. We are not claiming compliance &mdash; check what it produces with your accountant before you rely on it.",
  },
  {
    q: "Can I set it to rupees and Colombo time?",
    a: "Not yourself, not today. The reporting engine handles a five-and-a-half-hour offset properly &mdash; day boundaries, dayparting, shift times and the daily report all follow a business timezone. But the settings screen only lists North American timezones, the currency setting only accepts Canadian and US dollars, and prices print with a dollar sign throughout. Making those real settings is work we have not done yet.",
  },
  {
    q: "Is it in Sinhala or Tamil, and when can I reach you?",
    a: "English only, every screen. And we are nine and a half to ten and a half hours behind you, so our day starts as yours ends. We have not set a staffed support window and we are not going to publish one we might miss. During the pilot you are talking to the people who built it.",
  },
  {
    q: "What does it cost, during the pilot and after?",
    a: "During the pilot, nothing &mdash; the whole till, free while it runs, no card asked for and no contract. Afterwards we do not know, and we are not going to invent a number or promise you a discount for joining early. We will tell you before anything changes and you can stop whenever you like.",
  },
];

// FAQPage generated from the SAME array that renders below, so the markup and
// the structured data cannot drift apart.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: decodeEntities(f.q),
    acceptedAnswer: { "@type": "Answer", text: decodeEntities(f.a) },
  })),
};

// NO `offers` BLOCK AND NO PRICE. The rest of the site was deliberately cleared
// of both (see the note in ../../pricing/page.tsx): an Offer with price 0 and no
// validThrough reads to a crawler as a permanent free offer, which is precisely
// the promise this page is written not to make. "Free while the pilot runs"
// belongs in prose where it can carry its own qualifier.
//
// NO `areaServed` EITHER, even though this page is about one country. The site
// removed areaServed everywhere on purpose (see ../../jsonld.tsx) and the
// reasoning does not stop being true because the country changed. Sri Lanka is
// the audience for this page, not a territory we serve from an office there.
const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Point of sale software",
  serviceType: "Point of sale software",
  description:
    "Point-of-sale software for independent restaurants, cafes and shops, currently in a pilot: full access free while the pilot runs, set up over a remote video call, in exchange for real use and feedback. Card processing is not included.",
  provider: { "@id": "https://www.surgetechpos.com/#organization" },
  url: "https://www.surgetechpos.com/pilot/sri-lanka",
};

export default function SriLankaPilotPage() {
  return (
    // marketing.css is scoped under .surge-site, and this element is the
    // scope. It used to be the marketing layout wrapper, which put the home
    // page inside it too.
    <div className="surge-site">
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      {/* Two levels, not three. There is no /pilot index route, and a
          breadcrumb that names a URL which 404s is worse than a shallow one. */}
      <JsonLd data={breadcrumb("Sri Lanka pilot", "/pilot/sri-lanka")} />

      <PageHero
        crumb="Free pilot &mdash; Sri Lanka"
        title="Point of sale for independent restaurants in Sri Lanka"
        sub="Register, floor plan, kitchen display, reservations, inventory and staff &mdash; the whole till, free while the pilot runs."
      />

      {/* THE TORONTO DISCLOSURE. One paragraph, immediately under the hero,
          before the first ask. It is here because it changes what the reader is
          agreeing to: it is why setup is a call and why support is out of phase.
          It is not a credential and it must not be used as one. */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-lg leading-relaxed text-[#42566B]">
            We are based in Toronto, so we set you up over video call and screen share. Nobody flies out. We will help you load your menu and build your floor plan on that call.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="#apply" className={btnPrimary}>Join the free pilot</Link>
            <Link href="#honest" className={btnOutline}>Read what it does not do</Link>
          </div>
          <p className="mt-4 text-sm text-[#7A8CA0]">No card required. No contract. Stop whenever you like.</p>
        </div>
      </section>

      {/* ----- WHAT YOU GET ----- */}
      <section id="what-you-get" className="scroll-mt-28 border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>What you get</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Everything below is in the product today</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">Not a roadmap and not a trimmed-down trial. If it is on this list, you can open it on the first day.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="rounded-md border border-[#D9E1EA] border-t-[3px] border-t-[#0A2540] bg-white p-7">
                <h3 className="text-lg font-bold text-[#0A2540]">{c.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#42566B]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ THE HONEST SECTION ═══════════
          This is the point of the page. It is NOT visually demoted: same page
          width, same heading size and the same card treatment as "What you get",
          and it comes before the form rather than after it, so nobody signs up
          without having had the chance to scroll past it. Do not collapse these
          into an accordion, do not move this below the form, and do not cut the
          list down because the page is long. The length is the feature. */}
      <section id="honest" className="scroll-mt-28 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Crumb>Read this part twice</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">What Surge does not do yet</h2>
            <p className="mx-auto mt-4 leading-relaxed text-[#42566B]">We would rather you read this now than find out in month two.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {gaps.map((g) => (
              // The left rule is the same weight as the top rule on the
              // capability cards — a different edge, not a quieter one, so the
              // two sections read as equals rather than as a claim and a
              // disclaimer.
              <div key={g.title} className="rounded-md border border-[#D9E1EA] border-l-[3px] border-l-[#B42318] bg-white p-7">
                <h3 className="text-lg font-bold text-[#0A2540]">{g.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#42566B]">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----- THE TRADE ----- */}
      <section id="the-trade" className="scroll-mt-28 border-y border-[#D9E1EA] bg-[#0A2540] py-20 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="text-[13px] font-bold uppercase tracking-[0.05em] text-[#8FC4F5]">The trade</div>
          <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] sm:text-[34px]">It is free, and you tell us the truth</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[#B9C8D8]">
            That is the whole arrangement. You get the whole till for nothing while the pilot runs. In exchange we want you to use it through real service &mdash; a proper Friday, not a test &mdash; and then tell us plainly what was slow, what was missing and what made the shift harder.
          </p>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[#B9C8D8]">
            The second half is the part we cannot buy anywhere else, and it is why there is no card, no contract and no notice period. If it is not working for you, saying so is the most useful thing you can do, and then you can stop.
          </p>
        </div>
      </section>

      {/* ----- WHO THIS SUITS ----- */}
      <section id="who" className="scroll-mt-28 bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <Crumb>Who this suits</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Small, independent, and busy enough to break it</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">
                We are after a handful of places that will lean on the whole thing rather than poke at it. If you are on this list, the pilot is worth your hour.
              </p>
              <p className="mt-3 leading-relaxed text-[#42566B]">
                If you are not, say so anyway &mdash; we would rather know who is reading this and finding it a poor fit than not.
              </p>
            </div>
            <div className="rounded-md border border-[#D9E1EA] bg-white p-7">
              <div className="space-y-3">
                {suits.map((s) => (
                  <div key={s} className="flex items-start gap-2.5">
                    <Tick />
                    <span className="text-sm leading-relaxed text-[#42566B]">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----- FAQ ----- */}
      <section id="faq" className="scroll-mt-28 border-y border-[#D9E1EA] bg-[#F4F7FA] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-10 text-center">
            <Crumb>Questions</Crumb>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">The honest answers</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-md border border-[#D9E1EA] bg-white p-6">
                <h3 className="text-base font-bold text-[#0A2540]">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#42566B]" dangerouslySetInnerHTML={{ __html: f.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----- THE FORM ----- */}
      <section id="apply" className="scroll-mt-28 bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Crumb>Join the free pilot</Crumb>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0A2540] sm:text-[34px]">Tell us about your shop</h2>
              <p className="mt-4 leading-relaxed text-[#42566B]">
                This goes straight to us, not into a queue. We read it, we reply, and if it looks like a fit we will find a time that works across the ten hours between us and set you up on a call.
              </p>
              <p className="mt-3 leading-relaxed text-[#42566B]">
                Before you send it, one more time: <Link href="#honest" className="font-bold text-[#1B6DC1] hover:underline">we do not process cards, setup is remote, the product is in English, and there is no price after the pilot</Link>. If any of those is a deal-breaker, it is a deal-breaker now rather than in month two.
              </p>
            </div>
            <div className="lg:col-span-3">
              <PilotLkForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
