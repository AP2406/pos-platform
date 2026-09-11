import type { Metadata } from "next";
import Link from "next/link";
import { guideMetadata, GuideArticle, GuideH2, GuideP } from "../guide-layout";

const SLUG = "what-is-a-junk-fee-on-a-merchant-account";
export const metadata: Metadata = guideMetadata(SLUG);

export default function GuidePage() {
  return (
    <GuideArticle
      slug={SLUG}
      lede="A junk fee is any charge on your merchant account that isn't the real cost of moving a card payment. Most accounts have several. Here's how to spot and challenge them."
      cta={{ heading: "Not sure which of your fees are junk?", sub: "Send us a statement — we'll separate the real card costs from the padding, free, in about fifteen minutes." }}
    >
      <GuideH2>The test</GuideH2>
      <GuideP>Ask of any line item: <em>does this exist because a card moved, or because the processor added it?</em> Interchange and assessments are real &mdash; the networks charge them and everyone pays. Almost everything else fixed and recurring is worth questioning.</GuideP>

      <GuideH2>The usual suspects</GuideH2>
      <GuideP><strong>Statement fee</strong> &mdash; a few dollars a month to send you a bill. In 2026 there is no reason a digital statement costs you money.</GuideP>
      <GuideP><strong>Monthly minimum</strong> &mdash; if your fees don&rsquo;t reach a threshold, they top you up to it. Punishes slow months and small businesses specifically.</GuideP>
      <GuideP><strong>PCI compliance / non-compliance fee</strong> &mdash; often a monthly charge, and a <em>non</em>-compliance surcharge if you haven&rsquo;t filled out a form. Real PCI compliance is a questionnaire, not a fee.</GuideP>
      <GuideP><strong>Batch fee</strong> &mdash; a small charge every time you settle the day&rsquo;s transactions. Charged daily, it adds up quietly.</GuideP>
      <GuideP><strong>Gateway / technology fee</strong> &mdash; sometimes legitimate for online payments, often just padding bundled onto in-person accounts that don&rsquo;t need it.</GuideP>
      <GuideP><strong>Annual / regulatory / &ldquo;network access&rdquo; fees</strong> &mdash; official-sounding line items that are frequently pure margin.</GuideP>

      <GuideH2>Which are actually negotiable</GuideH2>
      <GuideP>Nearly all of the above are the processor&rsquo;s choice, not a network requirement &mdash; which means they can be reduced, waived, or simply not charged by a provider that doesn&rsquo;t play the game. What you can&rsquo;t negotiate is interchange itself. So the honest goal isn&rsquo;t &ldquo;zero fees,&rdquo; it&rsquo;s: pay real card costs plus one clear markup, and nothing else.</GuideP>

      <GuideH2>How to challenge them</GuideH2>
      <GuideP>List every fixed fee, total them for the year, and take that number to your processor: ask for each to be removed and get the answer in writing. If they won&rsquo;t, that annual total is exactly what switching is worth. For what it is worth on our side: Surge does not process cards yet, so we have no rate and no junk fees to compare &mdash; the point-of-sale itself is free while our <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pilot program</Link> runs. Either way, learn to <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">read your statement</Link>.</GuideP>
    </GuideArticle>
  );
}
