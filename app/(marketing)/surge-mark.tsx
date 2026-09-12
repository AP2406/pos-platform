import { SurgeIcon } from "@/components/brand/surge-logo";

// The marketing nav's mark. Kept as a named export at this path because the nav
// and the layout both already import it from here.
//
// WHY THIS IS THE ICON AND NOT THE LOCKUP: the nav bar is 68px tall and the
// mark sits beside a typeset "Surge" and six nav links on a 1152px rail. The
// kit's floor for the horizontal lockup is 220px wide; there is nowhere near
// that much room, and the README is explicit that below 48px you reach for the
// dedicated optical icon rather than shrinking the full logo. So: the 32px
// grid, which is the one drawn for this size.
//
// The old component inlined a bespoke card-and-lightning-bolt drawing with
// #2563EB and #06B6D4 hard-coded. That artwork is retired; this delegates to
// the one shared mark so the marketing site and the product can never drift.
export function SurgeMark({ className }: { className?: string }) {
  return <SurgeIcon size={32} className={className} title={null} />;
}
