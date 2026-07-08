import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, localService, breadcrumb } from "../jsonld";
import { SavingsEstimator } from "../savings-estimator";
import { LandingHero, LandingSection, LandingPoints, LandingCompare, LandingGuides, LandingCTA, LandingDisclaimer } from "../local-landing";

export const metadata: Metadata = {
  title: { absolute: "TD Merchant Solutions Alternative — No Contract | Surge" },
  description: "A TD Merchant Solutions alternative for local business: one clear card rate, no term contract, no monthly account or terminal-rental fees, and a free POS. See what you'd save.",
  alternates: { canonical: "/td-merchant-solutions-alternative" },
  openGraph: { ...OG_BASE, url: "/td-merchant-solutions-alternative", type: "website" },
};

const tiles = [
  { title: "No term contract", body: "Bank merchant agreements are commonly multi-year with an early-termination fee. Surge has no term and no cancellation fee — leave any time." },
  { title: "No monthly or rental fees", body: "No account fee, no terminal rental stacked on before you've sold anything. One transparent rate, and the terminal is yours." },
  { title: "A rate you can actually read", body: "One clear 2.5% + 15¢ in person — not a blended, negotiated number with the markup buried inside." },
  { title: "POS included free", body: "A full point-of-sale comes with your payments — not a separate line item or a third-party add-on." },
];

const compareRows: [string, string, string][] = [
  ["In-person rate", "2.5% + 15¢, clearly stated", "Often a blended / negotiated rate"],
  ["Monthly fee", "$0", "Account + terminal rental commonly apply"],
  ["Contract", "None — cancel anytime", "Commonly a multi-year term"],
  ["Early-termination fee", "None", "Often applies"],
  ["POS software", "Included free", "Typically separate / third-party"],
  ["Terminal", "Yours, $10 one-time setup", "Often rented monthly"],
  ["Support", "Local, real human", "Call centre"],
];

const service = localService({
  name: "Payment processing (TD Merchant Solutions alternative)",
  description: "A TD Merchant Solutions alternative for local businesses — one clear card rate, no term contract, no monthly account or terminal-rental fees, and a free point-of-sale, with local setup across the GTA and Durham.",
  areaServed: ["Greater Toronto Area", "Toronto", "Durham Region", "Ontario"],
  path: "/td-merchant-solutions-alternative",
});

export default function TdMerchantSolutionsAlternativePage() {
  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={breadcrumb("TD Merchant Solutions alternative", "/td-merchant-solutions-alternative")} />

      <LandingHero
        eyebrow="Switching from TD Merchant Solutions"
        h1={<>A bank-processor alternative without the <span className="text-blue-600">contract</span> or rental fees.</>}
        intro="Bank merchant services like TD's are dependable, but they commonly come with a multi-year term, a monthly account fee, a rented terminal, and a blended rate. Surge gives you one clear rate, no contract, and a terminal that's actually yours."
      />

      <LandingSection title="Why owners look for a TD Merchant Solutions alternative">
        <p>Signing up for payments through your bank is convenient, and for some businesses that&rsquo;s enough. But a lot of owners tell us the same story: a multi-year term they don&rsquo;t remember agreeing to, a monthly terminal rental that never ends, an account fee before the first sale, and a &ldquo;rate&rdquo; that&rsquo;s really a blend hiding what each card actually costs.</p>
        <p>Surge is built the other way around: <strong>2.5% + 15¢</strong> in person, a one-time $10 setup, <strong>no monthly fee</strong>, <strong>no term contract</strong>, and a full point-of-sale included free. The terminal is yours, not rented, and if we&rsquo;re not saving you money, you walk.</p>
        <LandingPoints items={tiles} />
      </LandingSection>

      <LandingSection title="How Surge compares to a bank processor" tint>
        <p>Every bank merchant agreement is negotiated, so treat the right-hand column as the patterns small merchants commonly report &mdash; your own terms are in your contract.</p>
        <LandingCompare
          competitor="TD Merchant Solutions (typical)"
          rows={compareRows}
          note="Figures reflect commonly reported patterns for small merchants on bank processing; your actual terms are in your agreement — check them."
        />
      </LandingSection>

      <LandingSection title="See what you'd save vs your bank's rate">
        <p>Drag the sliders to your real monthly card volume and average ticket. Add your account and terminal-rental fees on top of your blended rate, and the yearly gap versus Surge&rsquo;s flat 2.5% + 15¢ gets clear fast.</p>
        <div className="mt-6"><SavingsEstimator /></div>
        <p className="text-sm text-slate-500">Not sure what your bank is actually charging? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Send us your last statement</Link> and we&rsquo;ll compute your real effective rate &mdash; here&rsquo;s <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read it yourself</Link>.</p>
      </LandingSection>

      <LandingSection title="Switching is easier than staying" tint>
        <p>You don&rsquo;t have to wait for a term to end to get a quote. We&rsquo;ll read your current statement with you, show you the exact difference, set up your terminal in person across the GTA and Durham, and factor any early-termination cost into the math honestly so you know the real break-even.</p>
      </LandingSection>

      <LandingGuides slugs={["how-to-read-your-merchant-statement", "what-is-a-junk-fee-on-a-merchant-account", "flat-rate-vs-interchange-plus-pricing"]} />

      <LandingCTA
        heading="See exactly what you'd save vs your bank"
        sub="A free 15-minute call, a clear quote, and the real dollar difference — no pressure, no jargon."
      />

      <LandingDisclaimer>
        This page is general information, not financial or legal advice, and is not affiliated with or endorsed by The Toronto-Dominion Bank or Global Payments. TD and TD Merchant Solutions are trademarks of their owner. Competitor terms and fees change and vary by merchant &mdash; confirm your own agreement before switching.
      </LandingDisclaimer>
    </>
  );
}
