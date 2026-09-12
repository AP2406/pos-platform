import type { Metadata } from "next";
import Link from "next/link";
import { guideMetadata, GuideArticle, GuideH2, GuideP } from "../guide-layout";

const SLUG = "flat-rate-vs-interchange-plus-pricing";
export const metadata: Metadata = guideMetadata(SLUG);

export default function GuidePage() {
  return (
    <GuideArticle
      slug={SLUG}
      lede="There are two honest ways to price a merchant account — flat-rate and interchange-plus — plus one dishonest one to avoid. Here's how to tell which fits your business."
      cta={{ heading: "Want to know which is cheaper for you?", sub: "We'll model both against your real volume and show you the difference on a free call. No pressure." }}
    >
      <GuideH2>Flat-rate pricing</GuideH2>
      <GuideP>One simple number for every card &mdash; for example, <strong>2.5% + 15¢</strong> in person. You always know what a sale costs, statements are readable, and there&rsquo;s nothing to reconcile. The trade-off is that the processor bakes a buffer into the rate to cover the pricier cards, so on cheap transactions you might pay a touch more than raw cost. For most small businesses, the predictability and the absence of junk fees more than make up for it.</GuideP>

      <GuideH2>Interchange-plus pricing</GuideH2>
      <GuideP>You pay the actual interchange (which varies by card) <em>plus</em> a fixed, disclosed markup &mdash; say &ldquo;interchange + 0.3% + 10¢.&rdquo; It&rsquo;s the most transparent model because the processor&rsquo;s margin is explicit and constant. The downside: statements are complex, your cost per sale moves with the card mix, and it only really pays off at higher volume where shaving the margin matters.</GuideP>

      <GuideH2>The one to avoid: tiered pricing</GuideH2>
      <GuideP>Tiered (&ldquo;qualified / mid-qualified / non-qualified&rdquo;) pricing looks like a low headline rate, then quietly downgrades most of your rewards-card and keyed transactions into expensive buckets. It&rsquo;s designed to be hard to audit. If a quote uses these words, treat the headline number as fiction and ask for your effective rate instead.</GuideP>

      <GuideH2>Which should you pick?</GuideH2>
      <GuideP>Rule of thumb: if you&rsquo;re a typical small business that values a predictable bill and no surprises, <strong>flat-rate</strong> usually wins &mdash; especially once you count the monthly junk fees that often ride along with &ldquo;cheap&rdquo; tiered or interchange-plus quotes. If you&rsquo;re high-volume with a finance person who&rsquo;ll actually audit statements, interchange-plus can edge it out.</GuideP>
      <GuideP>Either way, compare on <em>effective rate</em>, not headline rate. Learn how in <Link href="/guides/how-to-read-your-merchant-statement" className="font-semibold text-blue-600 hover:text-blue-700">how to read your merchant statement</Link>, or see where Surge stands today on the <Link href="/pricing" className="font-semibold text-blue-600 hover:text-blue-700">pricing page</Link> &mdash; we do not process cards yet, so we publish no rate at all.</GuideP>
    </GuideArticle>
  );
}
