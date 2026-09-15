// Shared article content, metadata and sitemap entries.
export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  datePublished: string;
  dateModified: string;
  sections: string[][];
  source?: string;
};
export const GUIDES: Guide[] = [
  {
    slug: "card-processing-costs",
    title: "A clearer way to review card processing costs",
    excerpt:
      "Put the headline rate in context. A practical checklist for reviewing your processing agreement and monthly statement.",
    sections: [
      [
        "Start with the whole agreement",
        "A headline percentage is only one part of a processing arrangement. Gather the fee schedule, equipment agreement and recent statements so you can review the full setup together. Keep software and payment costs separate on your worksheet.",
      ],
      [
        "Understand what the rate represents",
        "Interchange describes transfers between acquiring and issuing banks. The merchant’s agreement with its financial institution sets the charges the business pays; interchange is not the same as the full merchant price. Ask your provider to explain which costs are included and which appear separately.",
      ],
      [
        "Group the costs before comparing",
        "Make separate lists for transaction charges, recurring account charges, equipment and occasional adjustments. Record the description, amount and billing frequency beside each item. If a charge is unclear, ask what service it covers and where it appears in your agreement.",
      ],
      [
        "Use the same business activity",
        "Compare proposals against the same period, transaction count, card mix and sales channels. Ask the provider to show its assumptions. A quote based on a different pattern of sales may not be a useful comparison for your shop.",
      ],
      [
        "Ask for a written explanation",
        "Request a complete fee schedule and an explanation of renewal, equipment and cancellation terms. Keep that response with your records. The purpose is a clearer decision, not a promised saving.",
      ],
    ],
    source: "interchange",
    description:
      "Put the headline rate in context. A practical checklist for reviewing your processing agreement and monthly statement.",
    datePublished: "2026-07-07",
    dateModified: "2026-09-14",
  },
  {
    slug: "debit-vs-credit-card-fees",
    title: "Debit and credit: what to check in your processing costs",
    excerpt:
      "Cards can look similar at the counter while following different payment arrangements. Here is what to ask about your own setup.",
    sections: [
      [
        "Begin with the basic distinction",
        "A debit card generally draws on money in an account. A credit card lets its holder borrow money that must be repaid. That describes the customer’s funding source; it does not, by itself, tell you what your business will pay to accept the transaction.",
      ],
      [
        "Check your local arrangement",
        "Ask your provider which debit and credit arrangements apply to your business and how they appear on the statement. Do not assume that every debit transaction has a fixed fee or that it will always cost less than a credit transaction.",
      ],
      [
        "Look at how you accept the payment",
        "Make a list of in-person, online and manually entered sales. Ask your provider whether the pricing differs for those channels and for the kinds of cards your customers use. Keep the answer with your fee schedule.",
      ],
      [
        "Use your actual sales pattern",
        "Take a representative statement into the conversation. Ask for a comparison using the same transaction amounts, counts and mix, rather than a single example that may not resemble your business.",
      ],
      [
        "Keep POS and processing distinct",
        "The POS records and manages your business activity. Your processor has its own agreement and payment workflow. During the Surge pilot, your existing processor remains separate; Surge card processing is coming soon.",
      ],
    ],
    source: "debit",
    description:
      "Cards can look similar at the counter while following different payment arrangements. Here is what to ask about your own setup.",
    datePublished: "2026-07-07",
    dateModified: "2026-09-14",
  },
  {
    slug: "how-to-read-your-merchant-statement",
    title: "How to read your merchant statement",
    excerpt:
      "A practical order for checking the dates, sales, fees and deposits without getting lost in the detail.",
    sections: [
      [
        "Confirm the period and account",
        "Start with the statement dates, business details and account identifier. Make sure the statement belongs to the location and processing arrangement you intend to review. Compare like periods when looking at a trend.",
      ],
      [
        "Match sales and adjustments",
        "Locate the sales totals, refunds and other adjustments. Compare them with your own records for the same period. Keep a note of timing differences instead of assuming that every mismatch is a fee.",
      ],
      [
        "Separate charges from deposits",
        "Find the fee section and the settlement or deposit section. Ask your provider whether fees are deducted before deposit or billed separately, and what timing applies to refunds and adjustments.",
      ],
      [
        "Keep a simple reconciliation sheet",
        "Record the opening question, statement line, expected amount and explanation. Work through each difference until you can explain the relationship between your sales records and bank deposits. Avoid sharing full account or card details when asking for general help.",
      ],
      [
        "Review the unfamiliar lines",
        "Use the agreement and fee schedule to identify a charge. Ask what it covers, how it is calculated and whether it is recurring. Retain the provider’s written explanation for the next statement review.",
      ],
    ],
    description:
      "A practical order for checking the dates, sales, fees and deposits without getting lost in the detail.",
    datePublished: "2026-07-07",
    dateModified: "2026-09-14",
  },
  {
    slug: "what-is-a-junk-fee-on-a-merchant-account",
    title: "Unfamiliar merchant fees: questions worth asking",
    excerpt:
      "A neutral checklist for understanding account charges, what they cover and where to find the agreed terms.",
    sections: [
      [
        "A label is a starting point",
        "“Junk fee” is an informal description. A fee name alone does not tell you whether a charge is valid, necessary or avoidable under your agreement. Start by asking for the specific service and contractual term behind it.",
      ],
      [
        "Write down the exact charge",
        "Record the statement description, amount, frequency and date. Check whether it also appears in an equipment or software agreement. This makes the conversation more useful than a general question about why the bill increased.",
      ],
      [
        "Ask what the charge covers",
        "Request a plain-language explanation, the calculation method and the relevant part of the fee schedule. If it relates to a service you no longer use, ask how that service and its billing can be changed.",
      ],
      [
        "Check any conditions",
        "Before changing a service, ask whether the change affects other prices or obligations in your agreement. Do not assume every charge can be removed or that another offer has no additional fees.",
      ],
      [
        "Keep the outcome in writing",
        "Save the explanation and any agreed change, including when it should take effect. Check the next statement against that confirmation. This guide does not assess a particular contract or promise a refund.",
      ],
    ],
    description:
      "A neutral checklist for understanding account charges, what they cover and where to find the agreed terms.",
    datePublished: "2026-07-07",
    dateModified: "2026-09-14",
  },
  {
    slug: "flat-rate-vs-interchange-plus-pricing",
    title: "Flat-rate and interchange-plus: questions to compare",
    excerpt:
      "Understand the structure of a quote, then compare the total using the same business activity and assumptions.",
    sections: [
      [
        "Start with what the quote includes",
        "Pricing labels are shorthand, not the full agreement. Ask for a complete fee schedule and a sample calculation. In particular, check the treatment of fixed transaction charges, recurring fees and different sales channels.",
      ],
      [
        "Ask how a flat rate is applied",
        "A flat-rate proposal generally quotes a bundled transaction price for a defined category of activity. Ask which transactions qualify for that price, what exceptions exist and which charges remain outside it.",
      ],
      [
        "Ask how interchange-plus is itemized",
        "An interchange-plus proposal generally separates underlying interchange from the provider’s added charges. Ask exactly which components are passed through, which are marked up and how they appear on your statement.",
      ],
      [
        "Compare the same month",
        "Give each provider the same representative activity and request the resulting total with assumptions shown. A label alone cannot tell you which proposal is more suitable or less expensive for your business.",
      ],
      [
        "Look beyond the calculation",
        "Consider equipment, support, reporting, renewal and cancellation terms alongside the quoted cost. Confirm details with the provider for your market. Surge does not currently quote a processing rate; its card processing is coming soon.",
      ],
    ],
    description:
      "Understand the structure of a quote, then compare the total using the same business activity and assumptions.",
    datePublished: "2026-07-07",
    dateModified: "2026-09-14",
  },
];
export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
