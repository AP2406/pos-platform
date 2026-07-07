import type { Metadata } from "next";
import Link from "next/link";
import { OG_BASE } from "../../shared-metadata";
import { JsonLd, article, breadcrumbTrail } from "../../jsonld";
import { LandingEyebrow, LandingCTA } from "../../local-landing";
import { getGuide } from "../guides";

const SLUG = "lower-credit-card-processing-fees-ontario";
const guide = getGuide(SLUG)!;
const PATH = "/guides/" + SLUG;

export const metadata: Metadata = {
  title: { absolute: guide.title + " | Surge" },
  description: guide.description,
  alternates: { canonical: PATH },
  openGraph: { ...OG_BASE, url: PATH, type: "article" },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 text-2xl font-semibold tracking-tight text-slate-900">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-slate-600">{children}</p>;
}

export default function GuidePage() {
  return (
    <>
      <JsonLd data={article({ headline: guide.title, description: guide.description, path: PATH, datePublished: guide.datePublished })} />
      <JsonLd data={breadcrumbTrail([{ name: "Home", path: "" }, { name: "Guides", path: "/guides" }, { name: guide.title, path: PATH }])} />

      <article className="relative overflow-hidden pb-8 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-6">
          <Link href="/guides" className="text-sm font-semibold text-blue-600 hover:text-blue-700">&larr; All guides</Link>
          <div className="mt-4"><LandingEyebrow>Guide</LandingEyebrow></div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 text-lg text-slate-600">If card fees feel like a black box, that&rsquo;s by design. Here&rsquo;s where the money actually goes on every sale in Ontario — and seven concrete ways to pay less without switching your bank.</p>

          <H2>First, what makes up a &ldquo;processing fee&rdquo;</H2>
          <P>Every card sale has three layers. <strong>Interchange</strong> is set by Visa and Mastercard and paid to the customer&rsquo;s bank — it&rsquo;s the same for everyone and you can&rsquo;t negotiate it. <strong>Assessments</strong> are small network fees. The third layer, the <strong>processor&rsquo;s markup</strong>, is the only part that&rsquo;s actually yours to shop — and it&rsquo;s where most Ontario businesses quietly overpay.</P>
          <P>The catch: most processors quote a single &ldquo;blended&rdquo; rate that rolls all three together, so you can&rsquo;t see the markup. Step one to paying less is being able to see it.</P>

          <H2>1. Get your true effective rate</H2>
          <P>Add up every fee on last month&rsquo;s statement — not just the headline rate, but every line item — and divide by your total card sales. That percentage is your <em>effective rate</em>. For a typical Ontario small business it lands between 2.5% and 3.5%. Knowing the number is what turns a vague &ldquo;fees feel high&rdquo; into something you can fix.</P>

          <H2>2. Hunt the junk fees</H2>
          <P>Statement fees, monthly minimums, PCI &ldquo;non-compliance&rdquo; fees, batch fees, gateway fees, annual fees — none of these are interchange, and many are pure margin. Circle every fixed monthly charge. A business doing $20,000/month in cards can easily lose $60–$120/month to line items that have nothing to do with the cards themselves.</P>

          <H2>3. Keep Interac cheap</H2>
          <P>Canadian debit runs on Interac, which is generally much cheaper than credit — often a flat few cents rather than a percentage. If your processor blends Interac into a percentage rate, you&rsquo;re overpaying on every debit tap. In Ontario, where debit is a big share of everyday spend, pricing Interac correctly is one of the fastest wins there is.</P>

          <H2>4. Take the card in person whenever you can</H2>
          <P>Tapped, inserted or swiped cards are &ldquo;card-present&rdquo; and carry the lowest rates. Manually keyed or online payments are treated as higher-risk and cost more (often around 2.9% + 30¢). If you&rsquo;re typing card numbers for phone orders, moving those to a tap or a payment link can shave real money.</P>

          <H2>5. Watch out for &ldquo;free terminal&rdquo; leases</H2>
          <P>A free or cheap terminal is often paired with a multi-year lease and an inflated rate that more than pays for the hardware. Buy your terminal outright, or work with a provider who includes it without a lease, and read the contract for early-termination fees before you sign anything.</P>

          <H2>6. Ask about surcharging — carefully</H2>
          <P>Since 2022, Canadian merchants can surcharge credit cards up to 2.4% (with notice and network rules), but <strong>not</strong> Interac debit. It can offset credit costs, but it can also cost you sales if customers resent it. It&rsquo;s a tool, not a default — model it before you turn it on.</P>

          <H2>7. Consolidate payments and POS</H2>
          <P>Paying separately for a point-of-sale and for payments usually means two markups. When the POS is included with processing, that&rsquo;s one less monthly bill and one less place to hide a fee. That&rsquo;s the model we built <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">Surge POS</Link> around.</P>

          <H2>The shortcut</H2>
          <P>You can do all seven yourself. Or you can hand us last month&rsquo;s statement and we&rsquo;ll compute your effective rate, flag the junk fees, and show you the exact dollar difference against Surge&rsquo;s flat <strong>2.5% + 15¢</strong> — free, in about fifteen minutes. If you&rsquo;re in the city, start with <Link href="/payment-processing-toronto" className="font-semibold text-blue-600 hover:text-blue-700">payment processing in Toronto</Link>, or just <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">book a call</Link>.</P>
          <p className="mt-8 text-xs text-slate-400">This guide is general information, not financial or legal advice. Card network rules change — confirm current rates and surcharging rules before acting.</p>
        </div>
      </article>

      <LandingCTA
        heading="Want the two-minute version for your business?"
        sub="Send us a statement and we'll tell you your real effective rate and what you'd save. No pressure, no jargon."
      />
    </>
  );
}
