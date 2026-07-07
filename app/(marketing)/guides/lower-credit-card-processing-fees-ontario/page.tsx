import type { Metadata } from "next";
import Link from "next/link";
import { guideMetadata, GuideArticle, GuideH2, GuideP } from "../guide-layout";

const SLUG = "lower-credit-card-processing-fees-ontario";
export const metadata: Metadata = guideMetadata(SLUG);

export default function GuidePage() {
  return (
    <GuideArticle
      slug={SLUG}
      lede="If card fees feel like a black box, that's by design. Here's where the money actually goes on every sale in Ontario — and seven concrete ways to pay less without switching your bank."
      cta={{ heading: "Want the two-minute version for your business?", sub: "Send us a statement and we'll tell you your real effective rate and what you'd save. No pressure, no jargon." }}
    >
      <GuideH2>First, what makes up a &ldquo;processing fee&rdquo;</GuideH2>
      <GuideP>Every card sale has three layers. <strong>Interchange</strong> is set by Visa and Mastercard and paid to the customer&rsquo;s bank &mdash; it&rsquo;s the same for everyone and you can&rsquo;t negotiate it. <strong>Assessments</strong> are small network fees. The third layer, the <strong>processor&rsquo;s markup</strong>, is the only part that&rsquo;s actually yours to shop &mdash; and it&rsquo;s where most Ontario businesses quietly overpay.</GuideP>
      <GuideP>The catch: most processors quote a single &ldquo;blended&rdquo; rate that rolls all three together, so you can&rsquo;t see the markup. Step one to paying less is being able to see it.</GuideP>

      <GuideH2>1. Get your true effective rate</GuideH2>
      <GuideP>Add up every fee on last month&rsquo;s statement &mdash; not just the headline rate, but every line item &mdash; and divide by your total card sales. That percentage is your <em>effective rate</em>. For a typical Ontario small business it lands between 2.5% and 3.5%. Knowing the number is what turns a vague &ldquo;fees feel high&rdquo; into something you can fix. (There&rsquo;s a full walkthrough in <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read your merchant statement</Link>.)</GuideP>

      <GuideH2>2. Hunt the junk fees</GuideH2>
      <GuideP>Statement fees, monthly minimums, PCI &ldquo;non-compliance&rdquo; fees, batch fees, gateway fees, annual fees &mdash; none of these are interchange, and many are pure margin. Circle every fixed monthly charge. A business doing $20,000/month in cards can easily lose $60&ndash;$120/month to line items that have nothing to do with the cards themselves. See <Link href="/guides/what-is-a-junk-fee-on-a-merchant-account" className="font-semibold text-blue-600 hover:text-blue-700">what counts as a junk fee</Link>.</GuideP>

      <GuideH2>3. Keep Interac cheap</GuideH2>
      <GuideP>Canadian debit runs on Interac, which is generally much cheaper than credit &mdash; often a flat few cents rather than a percentage. If your processor blends Interac into a percentage rate, you&rsquo;re overpaying on every debit tap. In Ontario, where debit is a big share of everyday spend, pricing Interac correctly is one of the fastest wins there is. (More: <Link href="/guides/interac-vs-credit-card-fees" className="font-semibold text-blue-600 hover:text-blue-700">Interac vs credit-card fees</Link>.)</GuideP>

      <GuideH2>4. Take the card in person whenever you can</GuideH2>
      <GuideP>Tapped, inserted or swiped cards are &ldquo;card-present&rdquo; and carry the lowest rates. Manually keyed or online payments are treated as higher-risk and cost more (often around 2.9% + 30¢). If you&rsquo;re typing card numbers for phone orders, moving those to a tap or a payment link can shave real money.</GuideP>

      <GuideH2>5. Watch out for &ldquo;free terminal&rdquo; leases</GuideH2>
      <GuideP>A free or cheap terminal is often paired with a multi-year lease and an inflated rate that more than pays for the hardware. Buy your terminal outright, or work with a provider who includes it without a lease, and read the contract for early-termination fees before you sign anything.</GuideP>

      <GuideH2>6. Ask about surcharging &mdash; carefully</GuideH2>
      <GuideP>Since 2022, Canadian merchants can surcharge credit cards up to 2.4% (with notice and network rules), but <strong>not</strong> Interac debit. It can offset credit costs, but it can also cost you sales if customers resent it. It&rsquo;s a tool, not a default &mdash; model it before you turn it on.</GuideP>

      <GuideH2>7. Consolidate payments and POS</GuideH2>
      <GuideP>Paying separately for a point-of-sale and for payments usually means two markups. When the POS is included with processing, that&rsquo;s one less monthly bill and one less place to hide a fee. That&rsquo;s the model we built <Link href="/pos" className="font-semibold text-blue-600 hover:text-blue-700">Surge POS</Link> around.</GuideP>

      <GuideH2>The shortcut</GuideH2>
      <GuideP>You can do all seven yourself. Or you can hand us last month&rsquo;s statement and we&rsquo;ll compute your effective rate, flag the junk fees, and show you the exact dollar difference against Surge&rsquo;s flat <strong>2.5% + 15¢</strong> &mdash; free, in about fifteen minutes. If you&rsquo;re in the city, start with <Link href="/payment-processing-toronto" className="font-semibold text-blue-600 hover:text-blue-700">payment processing in Toronto</Link>, or just <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">book a call</Link>.</GuideP>
    </GuideArticle>
  );
}
