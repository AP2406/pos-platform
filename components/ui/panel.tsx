import * as React from "react"

import { cn } from "@/lib/utils"

// ONE header treatment, for every titled card on the admin home.
//
// The page used to run two: sentence-case bold for the big modules (Sales
// today, Needs you now, Payment mix) and uppercase-tracked-plus-icon for the
// small ones (SERVICE, MENU & STOCK, TEAM). Two header systems on one screen is
// the loudest "unfinished" signal a dashboard can send — a reader can't tell
// whether the difference means anything, so they assume it means nothing was
// decided.
//
// Sentence-case bold won, and the icon survived the merge rather than being
// dropped: a glyph beside a title is a cheap, quiet way to make a small panel
// findable in peripheral vision, and it costs nothing once the type stops
// shouting. The uppercase micro-label deliberately stays alive elsewhere — a
// KPI tile's "SALES TODAY" and a table's column names are captions ABOVE a
// value, not titles OF a panel, and they are internally consistent with each
// other. This primitive is about panel titles.
//
// It exists as a component rather than a convention because a convention is
// something the next person diverges from without noticing.

/**
 * 20px, and it is the only horizontal inset any dashboard panel uses.
 *
 * Every card on the page therefore starts its content on the same two vertical
 * lines, whichever column it lands in — which is most of what "one designed
 * surface" means and none of what it costs.
 */
export const PANEL_X = "px-5"

/** Card-header glyph: 16px at hairline weight. The only header icon size. */
export const ICON_HEADER = "[&_svg]:size-4 [&_svg]:stroke-[1.5]"

/** Inline / trailing glyph: 14px at body weight. Chevrons, delta arrows. */
export const ICON_INLINE = "size-3.5"

/**
 * A card's place in the page's arrival order.
 *
 * `step` is a position, not a duration — the multiplication happens in CSS
 * against `--motion-stagger`, so the whole page's cadence is retuned by
 * changing one token rather than by finding sixteen hard-coded millisecond
 * values. Reading order, top-left to bottom-right; two elements are allowed to
 * share a step when they arrive side by side.
 *
 * The cast is unavoidable: React's CSSProperties has no index signature for
 * custom properties, and the alternative is a `style` attribute assembled as a
 * string, which loses every other type guarantee on the way past.
 */
export function enterAt(step: number): React.CSSProperties {
  return {
    "--in-delay": `calc(${step} * var(--motion-stagger))`,
  } as React.CSSProperties
}

/**
 * THE THREE TIERS.
 *
 * Every panel on the admin home used to be set in one size of title, one body
 * inset and one shadow, which is a page that has declined to say what matters.
 * `size` is the type-and-space half of the answer (position and the figures
 * themselves are the other half, and those live in the modules):
 *
 *   lg — primary. Exactly one card on the page: the one that answers "how is
 *        today going". Larger title, more room around it.
 *   md — secondary. The attention rail, the KPI band, the fortnight chart.
 *        Legible and structured, clearly under the primary.
 *   sm — tertiary. The ops band, the payment mix, the register. A quieter,
 *        lighter, lower-contrast title and a tighter body, because these are
 *        reference: you come to them on purpose, they do not hail you.
 *
 * The step has to survive a squint, so it is carried by three things at once —
 * size, weight and contrast — rather than by size alone. 16 → 14 is a step you
 * can measure and not one you can see; 16/semibold/ink → 14/medium/muted is.
 *
 * The sizes are one step up from the grotesque's (17/15/13) because Times has
 * a small x-height and 13px of it reads like 11px of the face it replaced —
 * see the ladder note in globals.css.
 *
 * The weight half of the step is now doing LESS work than it reads as doing,
 * and that is worth knowing before someone tunes it. Times New Roman ships two
 * weights, so 400 and 500 render identically and 600 and 700 both render as
 * its Bold: `font-medium` on the sm tier is, in practice, regular. The tier
 * still separates cleanly — 14/regular/muted against 16/bold/ink is a wider
 * gap than the grotesque's 13/medium/muted against 15/semibold/ink ever was —
 * but it is separating on size and contrast, with weight now a two-position
 * switch rather than a three-position one. Anything that needs a middle step
 * has to buy it with colour or size; there is no half-bold to reach for.
 */
type PanelSize = "lg" | "md" | "sm"

const TITLE_TYPE: Record<PanelSize, string> = {
  lg: "text-[18px] font-semibold leading-6 tracking-tight",
  md: "text-[16px] font-semibold leading-5 tracking-tight",
  sm: "text-[14px] font-medium leading-5 tracking-tight text-muted-foreground",
}

const HEADER_PAD: Record<PanelSize, string> = {
  lg: "pt-6",
  md: "pt-5",
  sm: "pt-4",
}

const HEADER_PAD_BORDERED: Record<PanelSize, string> = {
  lg: "py-5",
  md: "py-4",
  sm: "py-3",
}

const BODY_PAD: Record<PanelSize, string> = {
  lg: "pt-5 pb-7",
  md: "pt-4 pb-5",
  sm: "pt-3 pb-4",
}

/**
 * The card shell. `overflow-hidden` is not decoration — the rail's accent bar
 * and every full-bleed row inside a panel rely on the corner clip so an inner
 * element never has to re-declare the outer radius (and get it wrong).
 *
 * NO SHADOW BY DEFAULT. Every panel used to carry --elevation, which is a page
 * where everything floats — and if everything floats, nothing does. A card is
 * defined by its hairline against the canvas now; --line is strong enough in
 * both themes to do that on its own. What survives is `shadow-sheen`, which is
 * the inset top highlight with the drop shadow taken out of it: on ink that
 * highlight is the only cue that a card is a surface rather than a hole, and
 * that is a fact about light, not about height. Exactly one card on this page
 * passes `shadow-elevation` back in through className — the primary one — and
 * it does so because being lifted is part of how it says it is primary.
 *
 * `lit` replaces the uniform top hairline with one that has a light source:
 * brightest at the left, gone by two thirds across. It is a prop rather than
 * the default because the effect is only legible while it is rare — on every
 * card it stops being light falling on a surface and becomes a stripe, which
 * is precisely the kind of nameable decoration this page is not allowed. Two
 * cards carry it: the hero, and the rail. They are the two that lead their
 * columns, so the page opens with light in the top-left of each.
 */
function Panel({
  className,
  lit = false,
  ...props
}: React.ComponentProps<"section"> & { lit?: boolean }) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-line shadow-sheen",
        // relative is what .u-lit's ::before hangs off; overflow-hidden above is
        // what clips it back inside the corner radius.
        lit && "relative u-lit",
        className
      )}
      {...props}
    />
  )
}

/**
 * Title, optional subtitle, optional icon, optional trailing element.
 *
 * `bordered` is for panels whose body is a list or a table: the hairline is
 * what stops the header reading as the first row. Padded-body panels (the
 * charts, the hero) don't get one, because inside a card a divider should only
 * appear where something actually divides.
 */
function PanelHeader({
  icon,
  title,
  subtitle,
  trailing,
  bordered = false,
  size = "md",
  as: Heading = "h2",
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  bordered?: boolean
  /** Which tier this panel sits in. See PanelSize. */
  size?: PanelSize
  as?: "h2" | "h3"
  className?: string
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex items-start justify-between gap-3",
        PANEL_X,
        bordered
          ? cn(HEADER_PAD_BORDERED[size], "border-b border-line-soft")
          : HEADER_PAD[size],
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span
            aria-hidden
            className={cn(
              // mt-px, not items-center: the glyph aligns to the title's
              // cap-height, and centring it against a two-line header would
              // float it into the gap between the two lines.
              "mt-px shrink-0 text-muted-foreground/70",
              ICON_HEADER
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Heading className={TITLE_TYPE[size]}>{title}</Heading>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

/**
 * The body under a PanelHeader. At `md` the `pt-4` is the within-a-group step
 * of the vertical scale and `pb-5` matches the header's own top inset, so a
 * padded card is optically square.
 *
 * `size` moves with the header's: spatial generosity is one of the four tools
 * the tiers are built out of, and a tertiary card that keeps a primary card's
 * padding is a tertiary card taking up a primary card's room.
 */
function PanelBody({
  className,
  size = "md",
  ...props
}: React.ComponentProps<"div"> & { size?: PanelSize }) {
  return (
    <div
      data-slot="panel-body"
      className={cn(PANEL_X, BODY_PAD[size], className)}
      {...props}
    />
  )
}

export { Panel, PanelHeader, PanelBody, type PanelSize }
