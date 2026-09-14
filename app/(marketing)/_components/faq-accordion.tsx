// THE FAQ ACCORDION — <details>/<summary>, with no JavaScript at all.
//
// WHY NOT A REACT DISCLOSURE. DESIGN-SYSTEM.md: "Navigation and article text
// must work before animation or client-side enhancement." <details> is
// keyboard-operable (Enter and Space on the summary), exposed to assistive tech
// as a disclosure with its expanded state, findable by in-page search in
// Chrome, and works with scripting off and before hydration. A hand-rolled
// button + aria-expanded would reimplement all of that and get one of them
// wrong.
//
// The +/x marker is CSS-only: `details[open] .marker` rotates it. Rotation
// reads --surge-motion, so prefers-reduced-motion stops it dead. The answer
// text is in the served HTML whether the item is open or not, which is what
// lets the same copy back the FAQPage structured data on the page.

export type FaqItem = { q: string; a: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="border-t border-[var(--surge-border)]">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-[var(--surge-border)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[var(--surge-space-3)] text-[length:var(--surge-body)] font-semibold text-[var(--surge-ink)] [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="relative flex h-6 w-6 flex-none items-center justify-center text-[var(--surge-ink)] transition-transform duration-[var(--surge-motion)] group-open:rotate-45"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M10 4v12M4 10h12" />
              </svg>
            </span>
          </summary>
          <p className="max-w-[var(--surge-measure)] pb-[var(--surge-space-4)] text-[length:var(--surge-body)] leading-[var(--surge-leading-body)] text-[var(--surge-muted)]">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
