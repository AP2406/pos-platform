import Link from "next/link";
import { btnPrimary, btnOutline, ArrowRight } from "./primitives";

// A PLAN CARD — Basic / Advanced / Custom on 05-pricing.jpg.
//
// THERE IS NO `price` PROP, AND THAT IS THE POINT. CONTENT-AND-LAUNCH-RULES.md:
// "Global pages use Request pricing / Get a quote. Previous regional prices are
// intentionally omitted." A component that accepts a price is a component
// someone eventually passes a price to. The headline slot is a fixed enquiry
// label, so the only way to publish a number here is to change this file — at
// which point the rule about currency, billing period, taxes and eligibility is
// in front of whoever does it.
//
// `trialNote` IS OPTIONAL AND DEFAULTS TO NOTHING. The mockup prints "After a
// 30-day trial." under Advanced. The rules say to remove that line unless the
// trial is approved for the market, so nothing renders it today.
//
// `highlighted` is not the only signal that a plan is recommended: the tinted
// fill is accompanied by a visible "Most popular"-style label passed in as
// `flag`, because status may never be carried by colour alone.

export function PlanCard({
  name,
  summary,
  features,
  ctaLabel = "Request pricing",
  ctaHref = "/contact",
  highlighted = false,
  flag,
  trialNote,
}: {
  name: string;
  summary: string;
  features: string[];
  ctaLabel?: string;
  ctaHref?: string;
  highlighted?: boolean;
  /** Visible words for the highlighted state, e.g. "Most chosen". Required if `highlighted`. */
  flag?: string;
  /** Only set this once the trial terms are confirmed for the market. */
  trialNote?: string;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-[var(--surge-radius-card)] border p-[var(--surge-space-6)] " +
        (highlighted
          ? "border-[var(--surge-accent)] bg-[var(--surge-accent-soft)]"
          : "border-[var(--surge-border)] bg-[var(--surge-surface)]")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[length:var(--surge-h4)] font-bold text-[var(--surge-ink)]">{name}</h3>
        {highlighted && flag ? (
          <span className="rounded-full bg-[var(--surge-action)] px-2.5 py-1 text-[length:var(--surge-micro)] font-bold text-white">{flag}</span>
        ) : null}
      </div>

      {/* The enquiry label sits where a price would. It is a heading-scale
          statement on purpose: the answer to "what does it cost" is "ask us",
          said at the size the question was asked. */}
      <p className="mt-3 text-[length:var(--surge-h2)] font-bold leading-[var(--surge-leading-heading)] tracking-[-0.02em] text-[var(--surge-ink)]">
        Request pricing
      </p>
      {trialNote ? <p className="mt-1 text-[length:var(--surge-micro)] text-[var(--surge-muted)]">{trialNote}</p> : null}

      <p className="mt-3 text-[length:var(--surge-small)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">{summary}</p>

      <ul className="mt-[var(--surge-space-5)] space-y-2.5 text-[length:var(--surge-small)] text-[var(--surge-ink)]">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-[var(--surge-action)]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link href={ctaHref} className={(highlighted ? btnPrimary : btnOutline) + " mt-[var(--surge-space-6)] w-full"}>
        {ctaLabel} <ArrowRight />
      </Link>
    </div>
  );
}
