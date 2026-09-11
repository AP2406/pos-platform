"use client";

import Image from "next/image";
import { SurgeLogo } from "@/components/brand/surge-logo";

// THE TWO LEFT-HAND PANELS ON /login.
//
// Both were approved as mockups and both are built, because the choice between
// them is a marketing one that will be made more than once: the photo panel
// sells the room, the stats panel sells the product. Swapping is a one-word
// edit in app/login/page.tsx rather than a rebuild, and neither can rot in a
// branch while the other ships.
//
// Everything on this side is decoration. It carries no control, no link and no
// state, so on a narrow viewport it is simply not rendered — see LoginView.
export type LoginHero = "photo" | "stats";

// The kit's horizontal lockup has a stated floor of 220px wide; below that its
// README says use the optical icon instead. Both panels have a whole column, so
// both get the lockup, at exactly that floor.
const LOCKUP = "h-[65px] w-[220px]";

/* ===========================================================================
   VARIANT A — "photo"

   THE PHOTOGRAPH IS NOT THE MOCKUP'S. The mockup's restaurant interior is an
   unlicensed comp; shipping it would put an asset we do not own on the one page
   every operator sees. public/jpg9.jpg is the nearest thing we DO own that
   means the same thing — a real hospitality counter mid-transaction, with the
   terminal in frame — and it is already licensed and in production on the
   marketing home page ("Cafes & coffee shops"). 1800x1200, which is enough for
   a half-width column at 2x on a 1440 display.

   It is also considerably brighter than the comp, which is why the scrim below
   is two layers and sized against a blown-out white pixel rather than against
   this particular frame. See --auth-scrim / --auth-scrim-top in globals.css.
   =========================================================================== */
export function PhotoHero() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-auth-panel">
      <Image
        src="/jpg9.jpg"
        // Described, not labelled "hero image": a screen reader landing here
        // should learn what the room is, or nothing at all.
        alt="A customer paying at the counter of a local coffee shop"
        fill
        // The panel is display:none below lg, but a hidden <img> is still
        // fetched. The 1px candidate below that breakpoint is what keeps a
        // phone off the 250KB download for a panel it will never show.
        sizes="(min-width: 1024px) 56vw, 1px"
        // `priority` is deprecated in Next 16; eager + high is the documented
        // replacement for "this is the LCP element".
        loading="eager"
        fetchPriority="high"
        className="object-cover"
      />
      {/* Layer 1 — the flat wash. Unifies the frame with the theme and stops a
          warm photograph from reading as a different product beside a cool
          form column. */}
      <div className="absolute inset-0 bg-auth-scrim" />
      {/* Layer 2 — the band that carries the lockup. Gradients cannot be
          expressed as a single token, so the token is the stop colour and the
          geometry lives here: full strength at the top edge, gone by 42%,
          which is well clear of the mark's baseline at any panel height. */}
      <div className="absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-auth-scrim-top to-transparent" />
      <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
        {/* `tone="dark"` is pinned rather than `auto`: this panel is ink in
            BOTH themes, so the lettering must stay white even in light mode,
            where --logo-ink would otherwise resolve to near-black. */}
        <SurgeLogo tone="dark" className={LOCKUP} />
      </div>
    </div>
  );
}

/* ===========================================================================
   VARIANT B — "stats"
   =========================================================================== */

/**
 * ILLUSTRATIVE ONLY — THIS IS NOT A QUERY AND MUST NEVER BECOME ONE.
 *
 * These figures are art direction on a signed-OUT page. There is no session
 * here, so there is no business to read from and no row this could legally be
 * fetched against; wiring it to anything real would mean exposing one tenant's
 * takings to every visitor who loads /login. If somebody later wants a real
 * "your day so far" panel, it belongs behind auth on /app, not here.
 *
 * The numbers are internally consistent so they survive being read closely:
 * the hourly bars sum to exactly the net sales figure, and net sales / orders
 * rounds to exactly the average order. A reader who checks the arithmetic
 * should find it holds; a developer who checks the source should find this
 * comment first.
 */
const ILLUSTRATIVE_OVERVIEW = {
  netSales: "$4,286.50",
  orders: "142",
  averageOrder: "$30.19",
  // [label, dollars]. 9 AM through 9 PM; the lunch bump and the dinner peak are
  // the shape any full-service restaurant would recognise.
  hours: [
    ["9 AM", 118], ["10 AM", 146.5], ["11 AM", 232], ["12 PM", 398],
    ["1 PM", 341], ["2 PM", 187.5], ["3 PM", 164], ["4 PM", 249.5],
    ["5 PM", 402], ["6 PM", 618], ["7 PM", 553], ["8 PM", 471], ["9 PM", 406],
  ] as const,
  // The one bar that is called out. 6 PM is the peak above, so the highlight
  // is derived from the data rather than pointing at an arbitrary column.
  peakLabel: "6 PM",
  // Only these get a written axis label — thirteen would be a ruler, not a
  // chart, at this size.
  axis: ["9 AM", "12 PM", "3 PM", "6 PM", "9 PM"],
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-auth-panel-muted">{label}</div>
      {/* tabular-nums because these are money and counts sitting in a row —
          the same rule the rest of the product follows for columnar figures. */}
      <div className="mt-1.5 text-2xl font-medium tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function StatsHero() {
  const max = Math.max(...ILLUSTRATIVE_OVERVIEW.hours.map(([, v]) => v));

  return (
    <div className="flex h-full w-full flex-col justify-between bg-auth-panel p-10 text-auth-panel-foreground xl:p-14">
      {/* `auto` tone: unlike the photo panel this surface follows the theme, so
          the lettering should flip ink -> white with it, which is exactly what
          --logo-ink does. */}
      <SurgeLogo className={LOCKUP} />

      <div className="max-w-xl py-10">
        <h2 className="text-4xl font-medium leading-[1.12] tracking-tight xl:text-5xl">
          A clear view.
          <br />
          A better service.
        </h2>
        <p className="mt-7 text-auth-panel-muted">
          Your menu, team and daily operations.
          <br />
          All in one place.
        </p>

        <div className="mt-10 rounded-xl border border-auth-panel-line bg-auth-card p-6 xl:p-7">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold">Restaurant overview</h3>
            {/* Deliberately a <div>, not a <button> or a <select>. There is no
                other range to switch to on a signed-out page, and a control
                that looks live and does nothing is worse than a caption that
                looks like a control. It is the mockup's affordance rendered as
                what it actually is. */}
            <div className="flex items-center gap-1 text-xs text-auth-panel-muted">
              Today
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <Metric label="Net sales" value={ILLUSTRATIVE_OVERVIEW.netSales} />
            <Metric label="Orders" value={ILLUSTRATIVE_OVERVIEW.orders} />
            <Metric label="Average order" value={ILLUSTRATIVE_OVERVIEW.averageOrder} />
          </div>

          {/* The chart is texture. Every number it encodes is already written
              out above it in the three metrics, so there is nothing here for a
              screen reader to lose — and reading thirteen invented dollar
              amounts aloud would be actively misleading on a page where the
              figures are examples. Hidden, with the caption below carrying the
              range in text. */}
          <div className="mt-7 flex h-28 items-end gap-[3px]" aria-hidden="true">
            {ILLUSTRATIVE_OVERVIEW.hours.map(([label, value]) => (
              <div
                key={label}
                className={
                  "flex-1 rounded-t-[3px] " +
                  (label === ILLUSTRATIVE_OVERVIEW.peakLabel
                    ? "bg-auth-bar-peak"
                    : "bg-auth-bar")
                }
                // Percentage rather than a class, because the heights are data.
                // A thirteen-entry safelist of arbitrary Tailwind heights would
                // be the same numbers, further from the array they come from.
                style={{ height: (value / max) * 100 + "%" }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex justify-between text-[10px] tracking-[0.08em] text-auth-panel-muted">
            {ILLUSTRATIVE_OVERVIEW.axis.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <p className="sr-only">
            Example figures for a single trading day, shown to illustrate the
            dashboard. Not live data.
          </p>
        </div>
      </div>

      <div className="text-xs text-auth-panel-muted">
        <p>Built around the way restaurants work.</p>
        <p className="mt-2">© 2026 Surge. All rights reserved.</p>
      </div>
    </div>
  );
}

export function LoginHeroPanel({ hero }: { hero: LoginHero }) {
  return hero === "photo" ? <PhotoHero /> : <StatsHero />;
}
