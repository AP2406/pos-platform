import type { Metadata } from "next";
import Link from "next/link";
import { guideMetadata, GuideArticle, GuideH2, GuideP } from "../guide-layout";

const SLUG = "interac-vs-credit-card-fees";
export const metadata: Metadata = guideMetadata(SLUG);

export default function GuidePage() {
  return (
    <GuideArticle
      slug={SLUG}
      lede="In Canada, debit and credit aren't just different cards — they're priced on completely different systems. Understanding the gap is one of the easiest ways to stop overpaying."
      cta={{ heading: "Are you overpaying on debit?", sub: "Send us a statement and we'll show you what Interac is actually costing you versus what it should. Free, about fifteen minutes." }}
    >
      <GuideH2>Two different systems</GuideH2>
      <GuideP>Credit cards (Visa, Mastercard, Amex) are priced as a <strong>percentage</strong> of the sale, because their fees are built on interchange &mdash; a cut that flows to the cardholder&rsquo;s bank and rises with the ticket size and card type (premium and rewards cards cost more).</GuideP>
      <GuideP>Interac &mdash; Canadian debit &mdash; works differently. It&rsquo;s domestic, and for card-present transactions it&rsquo;s typically priced as a small <strong>flat fee</strong> (a few cents), not a percentage. On a $90 sale, a percentage credit rate might cost well over a dollar; Interac might cost a nickel. That gap is the whole point.</GuideP>

      <GuideH2>Why blended pricing hides the win</GuideH2>
      <GuideP>Many processors quote one &ldquo;blended&rdquo; rate that applies the same percentage to <em>every</em> tap &mdash; credit and debit alike. That&rsquo;s great for the processor and bad for you: every Interac transaction that should have cost a few cents is now charged a percentage, and the savings that debit is supposed to give you disappears into the blend.</GuideP>
      <GuideP>In a lot of Ontario businesses &mdash; cafés, convenience, quick-serve &mdash; debit is a huge share of transactions. Blending it away is often the single most expensive thing on the account.</GuideP>

      <GuideH2>What to look for</GuideH2>
      <GuideP>On your statement, find whether Interac is billed as its own flat-fee line or folded into a percentage. If you can&rsquo;t tell, that&rsquo;s usually a sign it&rsquo;s blended. Ask your processor directly: &ldquo;What do I pay per Interac transaction, specifically?&rdquo; A straight answer in cents is a good sign; a shrug toward the blended rate is not.</GuideP>

      <GuideH2>A note on debit routing</GuideH2>
      <GuideP>When a customer taps a Visa Debit or Debit Mastercard, the transaction can sometimes route over the credit networks (as a percentage) instead of Interac (flat). Good setups prefer the cheaper Interac rail where possible. It&rsquo;s worth confirming your terminal and processor route debit the cheap way.</GuideP>

      <GuideH2>The bottom line</GuideH2>
      {/* Was "Surge prices Interac as Interac — see pricing". That is a
          present-tense claim that we process cards, and we do not yet. The
          guide's own conclusion is unchanged; only our claim came out. */}
      <GuideP>Credit is a percentage; Interac is usually pennies. If you&rsquo;re paying a percentage on debit, you&rsquo;re leaving money on the counter every day. Ask your processor how debit is routed and priced, and read <Link href="/guides/lower-credit-card-processing-fees-ontario" className="font-semibold text-blue-600 hover:text-blue-700">how to lower your processing fees</Link>.</GuideP>
    </GuideArticle>
  );
}
