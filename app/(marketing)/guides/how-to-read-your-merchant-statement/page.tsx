import type { Metadata } from "next";
import Link from "next/link";
import { guideMetadata, GuideArticle, GuideH2, GuideP } from "../guide-layout";

const SLUG = "how-to-read-your-merchant-statement";
export const metadata: Metadata = guideMetadata(SLUG);

export default function GuidePage() {
  return (
    <GuideArticle
      slug={SLUG}
      lede="Merchant statements are dense on purpose. But you only need to find a few things to know whether you're being treated fairly. Here's the tour."
      cta={{ heading: "Rather we read it with you?", sub: "Send us last month's statement and we'll compute your effective rate and flag the junk fees on a free call." }}
    >
      <GuideH2>Start with the one number that matters</GuideH2>
      <GuideP>Before decoding anything, find two figures: your <strong>total card sales</strong> for the month and the <strong>total fees</strong> charged. Divide fees by sales and you have your <strong>effective rate</strong> &mdash; the all-in percentage you actually paid. This single number cuts through every marketing rate and is how you compare processors honestly.</GuideP>

      <GuideH2>The sections you&rsquo;ll see</GuideH2>
      <GuideP><strong>Sales / deposits summary:</strong> what you processed and what was deposited. Confirm the deposits match your own records &mdash; timing and holds live here.</GuideP>
      <GuideP><strong>Interchange &amp; assessments:</strong> the pass-through costs set by the card networks. These aren&rsquo;t your processor&rsquo;s margin; everyone pays them. On an interchange-plus statement they&rsquo;re itemized; on a flat/blended statement they&rsquo;re hidden inside your rate.</GuideP>
      <GuideP><strong>Processor fees / markup:</strong> the part your processor keeps. This is what you&rsquo;re actually shopping when you compare providers.</GuideP>
      <GuideP><strong>Other fees:</strong> the catch-all where padding hides &mdash; statement fees, PCI fees, monthly minimums, batch fees, gateway fees. Read this section slowly.</GuideP>

      <GuideH2>Red flags to circle</GuideH2>
      <GuideP>Any fixed monthly charge that isn&rsquo;t tied to a transaction. A &ldquo;PCI non-compliance&rdquo; fee (usually means a form you haven&rsquo;t filed, not a real cost). A monthly minimum you&rsquo;re not meeting. A tiered structure with &ldquo;qualified / mid-qualified / non-qualified&rdquo; buckets &mdash; that&rsquo;s designed to downgrade your rewards-card sales into the expensive tier. Circle each one; these are your negotiation list. Our field guide to <Link href="/guides/what-is-a-junk-fee-on-a-merchant-account" className="font-semibold text-blue-600 hover:text-blue-700">junk fees</Link> covers each in detail.</GuideP>

      <GuideH2>Then compare apples to apples</GuideH2>
      <GuideP>Once you have your effective rate, you can compare it to a flat quote. If a processor offers a clear <strong>2.5% + 15¢</strong> in person with no monthly fee and your effective rate is 3.1%, the difference is real money &mdash; multiply it by your annual volume. See how the pricing models differ in <Link href="/guides/flat-rate-vs-interchange-plus-pricing" className="font-semibold text-blue-600 hover:text-blue-700">flat-rate vs interchange-plus</Link>.</GuideP>
    </GuideArticle>
  );
}
