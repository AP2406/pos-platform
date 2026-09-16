// The admin home page's building blocks.
//
// Split out of pos-dashboard.tsx purely so that file can stay a readable
// description of *what the page asks the database* — the loader got long enough
// that the layout was hiding inside it. Every export here is a server component
// with no data access of its own: hand it numbers, it renders them.
//
// THE COLOUR BUDGET. Neutral is the default. Beyond it the whole page is
// allowed exactly two hues, and they mean strictly different things:
//
//   brand blue  — identity, interactive affordance, and data. The chart bars,
//                 the channel bar, link hover.
//   red         — one human, one action, right now. It appears on the attention
//                 rail's severity mark when something is BLOCKED, and nowhere
//                 else on this screen.
//
// Green, amber and sky are gone, and they are not coming back for the rebuild.
// Green was the expensive one: "Till open since 10:02 a.m." is good news, and
// painting good news makes it compete with the one thing that isn't. Amber went
// with it — a page with an amber tier has to spend amber on every heads-up, and
// then red has to shout over amber to be heard. Both are expressed the way print
// has always expressed them: contrast. Something you should notice is set in
// ink; everything routine is set in the muted grey the timestamps use.
//
// The rule that survives unchanged: colour never carries meaning alone. The red
// marks on this page sit beside words that say the same thing, so the page still
// works for a colour-blind owner and in a sunlit dining room.
//
// EVERY FILL IS FLAT. No gradients anywhere — not in a bar, not under a line,
// not behind a figure. Where a chart needs two weights of the same idea it takes
// two rungs of --ramp-N, which is a ladder of discrete stops tuned for how many
// steps the eye can order, rather than one colour at two opacities.
//
// AND EVERY MODULE HAS A WRITTEN ZERO STATE. The competitor study found
// Lightspeed's empty home repeating "No data found" across five cards and
// reading like a broken product, and found our sentences better than anything
// else in the category. A module here is not finished until the case where it
// has nothing to show reads as a sentence a person wrote.

import Link from "next/link";
import { AlertCircle, ChevronRight, Rocket } from "lucide-react";
import {
  ICON_INLINE,
  PANEL_X,
  Panel,
  PanelBody,
  PanelHeader,
  enterAt,
} from "@/components/ui/panel";
import { axisDivisions } from "@/lib/services/dashboard-signals";
import type { AttentionSignal } from "@/lib/services/dashboard-signals";
import type { ChannelCount } from "@/lib/services/order-channel";
import type { ReadinessReport } from "@/lib/services/launch-readiness";

export function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(Number.isFinite(n) ? n : 0);
}

/** Money with the cents dropped — for an axis tick, where they are noise. */
function moneyRound(n: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

/**
 * A y-axis tick.
 *
 * The ends carry the currency and the middle rungs don't: "$0 · 200 · 400 · 600
 * · 800 · $1K" reads as one scale with its unit stated, while repeating the
 * dollar sign six times up the side of a chart is six times the ink for one
 * fact. The top tick goes compact past a thousand because "$1,200" is nearly as
 * wide as the axis gutter it has to sit in.
 */
function axisTick(v: number, i: number, last: number, currency: string): string {
  if (i !== 0 && i !== last) {
    return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(v);
  }
  if (v >= 1000) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(v);
  }
  return moneyRound(v, currency);
}

// ---------------------------------------------------------------------------
// 0 · The chart ramp
// ---------------------------------------------------------------------------
//
// Tailwind reads class names as literal text, so a rung can't be interpolated
// (`"bg-ramp-" + n` compiles to nothing). This table is the price of that.
//
// The channel bar picks rungs 1, 3, 5, 6, 7 rather than 1–5: adjacent rungs of
// this ladder are one step apart by design, and five one-step segments laid side
// by side in a 12px bar read as a smudge. Skipping to every other rung at the
// dark end keeps the first three — which are almost always dine-in, takeout and
// delivery, the three a person is actually comparing — visibly distinct.
const RAMP_BG: Record<number, string> = {
  1: "bg-ramp-1",
  2: "bg-ramp-2",
  3: "bg-ramp-3",
  4: "bg-ramp-4",
  5: "bg-ramp-5",
  6: "bg-ramp-6",
  7: "bg-ramp-7",
};

const CHANNEL_RUNGS = [1, 3, 5, 6, 7];

// ---------------------------------------------------------------------------
// 0b · The line under a KPI
// ---------------------------------------------------------------------------

export type DeltaDirection = "up" | "down" | "flat";

export type KpiDelta = {
  direction: DeltaDirection;
  /** The magnitude, pre-formatted: "8.2%", "18", "$41.20". */
  text: string;
  /** What it is measured against: "vs last Tuesday". Stays muted. */
  suffix: string;
};

/**
 * The OTHER shape a KPI's second line can take: a state and the threshold it is
 * measured against, rather than a movement and a comparison day.
 *
 * This came out of the mockup and it is the better instrument for a bounded
 * ratio. A labour percentage that moved 2.4% since last Thursday is noise — it
 * is a ratio of two things that both moved, and no owner stands up for it.
 * "Within target · Below 28%" is the same field carrying a fact somebody set on
 * purpose and can be over or under. Anything with a target the merchant
 * configured should use this rather than a delta.
 *
 * `alert` is the only place a KPI cell is allowed ink instead of grey, and it
 * means over the number the merchant themselves set — not "down on last week".
 */
export type KpiStatus = {
  text: string;
  suffix: string;
  alert?: boolean;
};

/**
 * An arrow, a number, and what it's against — in ink, never in a hue.
 *
 * There used to be a `good` field here, and the arrow was painted green when the
 * delta pointed the way the field said it should and red when it didn't. Four of
 * those across a KPI band is most of a rainbow, and it was buying nothing: the
 * ARROW already encodes the direction and the words already encode the
 * comparison, so the colour was a third statement of a fact stated twice. It
 * also spent the page's alert hue on a figure nobody can act on — an average
 * order 8% down is not a thing you get up and fix, and once red means "8% down"
 * it cannot also mean "the kitchen is blocked".
 *
 * What is left is a contrast step: the magnitude sits in full ink beside a muted
 * comparison, which is enough to make it the thing you read first in a two-line
 * block and costs the page no colour at all.
 *
 * The glyphs are drawn rather than imported. lucide's ArrowUpRight is a 24-unit
 * icon scaled to 14 and it sat visibly heavier than the 13px text beside it;
 * these are three line segments at the type's own weight, and they sit on the
 * text baseline instead of floating above it.
 */
function Delta({ delta }: { delta: KpiDelta }) {
  return (
    // Wraps rather than truncates: in a two-up KPI band on a phone there is room
    // for "18 more" and "than last Thursday" on separate lines, and there is
    // never room for "than last Thurs…", which reads as broken.
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-foreground">
        <TrendGlyph direction={delta.direction} />
        <span className="tabular-nums">{delta.text}</span>
      </span>
      <span className="text-muted-foreground">{delta.suffix}</span>
    </span>
  );
}

function TrendGlyph({ direction }: { direction: DeltaDirection }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "flat" ? (
        <path d="M2 6h8" />
      ) : direction === "up" ? (
        <>
          <path d="M2.5 9.5 9.5 2.5" />
          <path d="M4.5 2.5h5v5" />
        </>
      ) : (
        <>
          <path d="M2.5 2.5 9.5 9.5" />
          <path d="M9.5 4.5v5h-5" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 1 · The KPI band
// ---------------------------------------------------------------------------

export type Kpi = {
  id: string;
  /** Two or three words. The number below is what gets read. */
  label: string;
  value: string;
  /** A movement against a comparison period. Null when there is no honest one. */
  delta: KpiDelta | null;
  /** A state against a configured threshold. Used instead of a delta, not beside it. */
  status: KpiStatus | null;
  /**
   * What stands in when there is neither. This is the line that has to
   * distinguish "last Tuesday was closed" from "the query broke" from "nobody
   * has entered a pay rate", so it is a sentence and it is required.
   */
  note: string;
};

/**
 * Four figures an owner would recite from memory — as ONE band divided by
 * hairlines, not four floating cards.
 *
 * The difference between this and the seven-tile grid the page was rebuilt to
 * get rid of is the second line: a tile that says "$4,286.50" tells you nothing
 * you can act on, and one that says "$4,286.50, 12.8% ahead of last Thursday"
 * tells you whether to worry. Anything with no honest comparison either carries
 * a sentence saying why or is not in the band.
 *
 * WHY IT IS ONE PANEL. Four ringed, shadowed rectangles read as four objects of
 * equal importance, which is another way of saying they read as nothing. Merged
 * into a single band divided by hairlines the band reads as one object at one
 * weight, the page loses four edges and four shadows it was paying for, and the
 * cells can sit closer together than four cards with a gutter ever could.
 *
 * The column count follows the data rather than being pinned at four: labour
 * cost is gated on a permission and on pay rates existing, so a three-cell band
 * is a real state, and a four-column grid with a hole in it is the worst
 * possible way to render it.
 */
export function KpiStrip({
  items,
  enterFrom = 0,
}: {
  items: Kpi[];
  /**
   * Where this band sits in the page's arrival order. The cells stagger off it
   * left to right — this is the one band whose members arrive individually
   * rather than together, because four landing at once is a row appearing and
   * four landing in sequence is a row being dealt.
   */
  enterFrom?: number;
}) {
  if (items.length === 0) return null;

  // `divide-*` can't do this: it draws between grid children in source order,
  // which on a 2×2 phone layout would put a rule down the middle AND one between
  // cells 2 and 3, which are not beside each other. So the cells own their own
  // left and top hairline and the ones at the start of a row switch theirs off.
  const cols =
    items.length >= 4
      ? "grid-cols-2 lg:grid-cols-4"
      : items.length === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2";
  const rules =
    items.length >= 4
      ? "border-l [&:nth-child(2n+1)]:border-l-0 [&:nth-child(n+3)]:border-t " +
        "lg:[&:nth-child(2n+1)]:border-l lg:[&:nth-child(4n+1)]:border-l-0 lg:[&:nth-child(n+3)]:border-t-0"
      : items.length === 3
        ? "border-t [&:first-child]:border-t-0 sm:border-t-0 sm:border-l sm:[&:first-child]:border-l-0"
        : "border-l [&:first-child]:border-l-0";

  return (
    <Panel>
      <div className={"grid " + cols}>
        {items.map((k, i) => (
          <section
            key={k.id}
            style={enterAt(enterFrom + i)}
            className={"u-in px-5 py-4 border-line-soft " + rules}
          >
            {/* Quieter and wider than the value it captions. The gap between the
                softest and loudest type on a screen is most of what reads as
                "considered", and this label is the floor of that ladder — its
                job is to be found when looked for and ignored otherwise.
                No icon. A glyph per cell is furniture: it captions a caption,
                and four of them in a row is the loudest un-earned thing a
                summary band can carry. */}
            <div className="text-[11px] font-medium text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-2 text-[24px] sm:text-[30px] font-bold tabular-nums tracking-[-0.02em] leading-none">
              {k.value}
            </div>
            <div className="mt-2.5 min-w-0">
              {k.delta ? (
                <Delta delta={k.delta} />
              ) : k.status ? (
                <span className="inline-flex flex-wrap items-center gap-x-1.5 text-xs">
                  {/* No pill, no dot, no tint. A state worth noticing is set in
                      ink at semibold beside a muted threshold; a routine one is
                      medium. That step is perfectly loud against a card of
                      muted 12px type, and it leaves the page's one alert hue
                      where it belongs — on the rail, where every state worth
                      alarming about is already listed with somewhere to go. */}
                  <span
                    className={
                      "whitespace-nowrap " +
                      (k.status.alert
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground")
                    }
                  >
                    {k.status.text}
                  </span>
                  <span className="text-muted-foreground">{k.status.suffix}</span>
                </span>
              ) : (
                <span className="block text-xs text-muted-foreground">{k.note}</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2 · Launch readiness — loud while it matters, gone the moment it doesn't
// ---------------------------------------------------------------------------

/**
 * For a merchant who can't take a payment yet, "net sales: $0.00" is a true
 * statement and a useless one. Until the required setup is done this outranks
 * the numbers, because finishing it is literally the only thing that can change
 * them.
 *
 * It renders nothing once `ready` — a permanent checklist is a permanent
 * accusation, and there is no "dismiss" here on purpose: the way to remove it is
 * to finish, which takes about five minutes.
 */
export function ReadinessPanel({ report }: { report: ReadinessReport }) {
  if (report.ready) return null;
  const left = report.outstanding.length;

  return (
    // Brand, not amber, and not the alert hue either. This panel is a task list
    // — "here are the three things standing between you and taking a payment" —
    // and every one of its rows is a link to the screen that finishes one. That
    // is an affordance, which is what brand blue means on this page. Amber would
    // have reopened a third colour story for a panel most tenants see once; red
    // would have spent the page's one alarm on something that is not an alarm.
    // The panel is loud enough by being first, being wide, and saying what it says.
    <Panel className="ring-primary/30">
      <PanelHeader
        bordered
        size="lg"
        icon={
          <span className="flex items-center justify-center w-8 h-8 -my-1 rounded-lg ring-1 ring-inset ring-primary/35 text-primary">
            <Rocket />
          </span>
        }
        title={
          <>
            {left} thing{left === 1 ? "" : "s"} left before you can take real
            payments
          </>
        }
        subtitle={report.requiredDone + " of " + report.requiredTotal + " done"}
        trailing={
          <Link
            href="/app/go-live"
            className="u-tx u-focus text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
          >
            Full checklist
          </Link>
        }
      />
      <ul className="divide-y divide-line-soft">
        {report.outstanding.map((c) => (
          <li key={c.id}>
            <Link
              href={c.href}
              className={
                "group u-tx u-focus-inset flex items-center gap-3 py-3 hover:bg-raised " +
                PANEL_X
              }
            >
              {/* A bullet, not a warning light. It marks where a row starts; the
                  row's own words say what it is. */}
              <span className="shrink-0 size-1.5 rounded-full bg-line-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{c.title}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {c.detail}
                </span>
              </span>
              <ChevronRight
                className={
                  "u-arrow u-tx shrink-0 text-muted-foreground group-hover:text-foreground " +
                  ICON_INLINE
                }
              />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 3 · Sales performance
// ---------------------------------------------------------------------------

export type SeriesBar = {
  /** Stable across renders, so it's the React key. */
  key: string;
  /** The axis tick under the bar: "9 AM", "Tu". */
  tick: string;
  /** Spoken form, for the text alternative and the footer: "9–10 AM", "Tue, Sep 9". */
  full: string;
  amount: number;
  /**
   * Draw this bar's TICK in ink. The hour now in progress, or the day the scope
   * control is pointed at — the reader's place in the series, which is not the
   * same fact as which bar is tallest.
   */
  marked?: boolean;
};

/** One half of the Hourly | Daily control. Server-rendered links, like the scope control. */
export type SeriesTab = { key: string; label: string; href: string };

/**
 * Takings across the day or the fortnight, as bars against a real axis.
 *
 * THE AXIS IS THE CHANGE. The version this replaces drew fourteen bars in
 * fourteen full-height tracks with the ceiling printed once, in 11px, above the
 * top right corner. Tracks answer "how big could a day be here" and they answer
 * it in proportions — a bar at a third of its track is a third of a good day —
 * which is genuinely the sentence an owner says out loud. What they cannot
 * answer is "how much is that one", and a back office whose only chart refuses
 * to put numbers up the side is a back office you cannot check a figure against.
 * Five gridlines and six ticks cost about forty pixels of gutter and turn every
 * bar into a readable quantity.
 *
 * Hand-rolled SVG rather than a chart library: bars, five rules and a highlight
 * do not justify a runtime, and this way every fill is one of the page's own
 * OKLCH tokens rather than whatever a library's default palette decided.
 * `preserveAspectRatio="none"` lets the plot stretch to whatever column it lands
 * in; the gridlines keep `vector-effect` so they stay hairlines when it does,
 * and every piece of text lives OUTSIDE the SVG so none of it is stretched with
 * the box.
 */
export function SalesPerformanceCard({
  bars,
  ceiling,
  currency,
  tabs,
  activeTab,
  scopeWord,
  /** "Highest sales hour" / "Best day" — what the footer figure is. */
  peakLabel,
  tickEvery = 1,
  failed,
  emptyLine,
  className,
}: {
  bars: SeriesBar[];
  /** Top gridline. Zero means there is nothing to draw. */
  ceiling: number;
  currency: string;
  tabs: SeriesTab[];
  activeTab: string;
  /** "Today" / "Yesterday" / "Last 14 days" — the legend's one word. */
  scopeWord: string;
  peakLabel: string;
  /** Label every nth bar. 13 hours of "9 AM" will not fit; 14 days of "Tu" will. */
  tickEvery?: number;
  failed: boolean;
  /** The written zero state. Required — this card is never allowed a blank body. */
  emptyLine: string;
  className?: string;
}) {
  const W = 600;
  const H = 200;
  const slot = bars.length > 0 ? W / bars.length : W;
  // 62% bar, 38% air. Wider and the bars merge into one block; narrower and
  // fourteen of them start to look like a barcode.
  const barW = slot * 0.62;
  const radius = Math.min(4, barW / 2);

  const divisions = axisDivisions(ceiling);
  const ticks: number[] = [];
  for (let i = 0; i <= divisions; i++) ticks.push((ceiling / divisions) * i);

  // The tallest bar, and it is the one that gets the ink. Highlighting the peak
  // rather than "now" is what lets the footer line double as the chart's
  // caption: the bar you are looking at is the bar the sentence underneath is
  // naming, so the highlight explains itself and needs no legend entry.
  let peak: SeriesBar | null = null;
  for (const b of bars) if (b.amount > 0 && (!peak || b.amount > peak.amount)) peak = b;

  const drawable = !failed && ceiling > 0 && bars.length > 0;

  return (
    <Panel className={"h-full " + (className ?? "")}>
      <PanelHeader
        title="Sales performance"
        subtitle={"Net sales " + (activeTab === "daily" ? "over the last 14 days" : "throughout the day")}
        trailing={
          // The Hourly | Daily control. Server-rendered links, the same shape as
          // the scope control above it and the range presets on /app/reports:
          // there are two destinations, both are real URLs a manager can
          // bookmark or paste into a message, and client state buys nothing.
          //
          // RADIUS NESTING: the track is rounded-lg (12px) with 2px of padding,
          // so the pill inside wants 10px, not the 9.6 that rounded-md happens
          // to be. An inner radius equal to or larger than its outer is the
          // single most legible sloppiness in a control this small.
          <div
            className="inline-flex items-center rounded-lg bg-raised ring-1 ring-line p-0.5"
            role="group"
            aria-label="Chart interval"
          >
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={t.key === activeTab ? "true" : undefined}
                className={
                  // u-press on both halves, not just the inactive one: the
                  // selected segment is still a link you can click, and a
                  // control where half the targets acknowledge a press and half
                  // don't feels broken in a way people report as "laggy".
                  "u-tx u-tx-move u-press u-focus rounded-[10px] px-2.5 py-1 text-xs " +
                  (t.key === activeTab
                    ? "bg-card font-medium text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground")
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
        }
      />

      <PanelBody className="flex flex-1 flex-col">
        {failed ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load this series. The bars are missing because the
            query failed, not because the hours were empty.
          </p>
        ) : !drawable ? (
          // A row of empty tracks is a picture of nothing, and drawing it would
          // imply we measured thirteen zeroes rather than found no sales at all.
          <p className="text-sm text-muted-foreground">{emptyLine}</p>
        ) : (
          <figure className="flex flex-1 flex-col">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {/* One swatch, because there is one series. A legend for a
                    single-series chart is nearly furniture — it survives
                    because it is the only thing naming WHICH day the bars are,
                    which is the one fact on this card that can be silently
                    stale. */}
                <span aria-hidden className="size-2.5 rounded-[3px] bg-ramp-1" />
                {scopeWord}
              </span>
              <span className="tabular-nums">{currency || "CAD"}</span>
            </figcaption>

            {/* The gutter and the plot are siblings so the ticks can be real
                text at a real size. Putting them inside the SVG would hand them
                to preserveAspectRatio="none", which stretches glyphs
                horizontally by whatever ratio the column happens to be. */}
            <div className="mt-2 flex min-h-[200px] flex-1 gap-2.5">
              <div className="relative w-11 shrink-0">
                {ticks.map((v, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                    style={{ bottom: (i / divisions) * 100 + "%" }}
                  >
                    {axisTick(v, i, divisions, currency)}
                  </span>
                ))}
              </div>

              <div className="relative min-w-0 flex-1">
                <svg
                  viewBox={"0 0 " + W + " " + H}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  role="img"
                  aria-label={
                    // The text alternative is the whole series, read out. A
                    // screen reader gets the same information a sighted reader
                    // gets from the picture, not a summary of it.
                    "Net sales by " +
                    (activeTab === "daily" ? "day" : "hour") +
                    ". " +
                    bars
                      .map((b) => b.full + ": " + money(b.amount, currency))
                      .join(", ") +
                    "."
                  }
                >
                  {ticks.map((_, i) => {
                    const y = H - (i / divisions) * H;
                    return (
                      <line
                        key={i}
                        x1="0"
                        y1={y}
                        x2={W}
                        y2={y}
                        // The baseline is the card's own line weight; the rules
                        // above it are softer. Inside a card, structure should
                        // be quieter than the boundary around it, and the floor
                        // of a chart is a boundary.
                        className={i === 0 ? "stroke-line" : "stroke-line-soft"}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}

                  {bars.map((b, i) => {
                    const x = i * slot + (slot - barW) / 2;
                    const h = Math.min(1, b.amount / ceiling) * H;
                    // An hour that traded but barely still has to be visible, or
                    // the chart says "closed" about an hour that wasn't.
                    const drawn = b.amount > 0 ? Math.max(h, 3) : 0;
                    if (drawn <= 0) return null;
                    return (
                      // scaleY from a bottom origin, so the bars grow out of the
                      // baseline for the price of a transform each and no layout
                      // at all. `transform-box: fill-box` (in .u-rise) is what
                      // pins the origin to the bar's own foot rather than to the
                      // SVG's origin, which is the whole difference between
                      // growing and sliding.
                      //
                      // The stagger runs left to right at half the page's step:
                      // fourteen bars at a full 40ms would take 560ms to deal
                      // out, which is longer than the rest of the page's arrival.
                      <rect
                        key={b.key}
                        x={x}
                        y={H - drawn}
                        width={barW}
                        height={drawn}
                        rx={radius}
                        className="u-rise"
                        style={enterAt(6 + i * 0.5)}
                        // Two rungs of one hue, both flat. The peak takes
                        // --ramp-1, the strongest rung in either theme; the rest
                        // take --ramp-3, two rungs down. --ramp-3 rather than
                        // something fainter on purpose: it measures 3.24:1 in
                        // light and 4.71:1 in dark against the card, so the bars
                        // a reader is meant to see the SHAPE of clear the 3:1
                        // graphical contrast floor. The step between the two
                        // rungs is 1.83:1, which is two rungs of a ladder built
                        // to be ordered by eye — and the peak is named in words
                        // in the footer, so the highlight is carried twice.
                        fill={peak && b.key === peak.key ? "var(--ramp-1)" : "var(--ramp-3)"}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* The tick row is offset by the gutter so the labels sit under the
                bars rather than under the axis. */}
            <div className="mt-2 flex pl-[54px] text-[10px] sm:text-[11px] text-muted-foreground">
              {bars.map((b, i) => (
                <span
                  key={b.key}
                  className={
                    "flex-1 min-w-0 truncate text-center tabular-nums " +
                    (b.marked ? "font-semibold text-foreground" : "")
                  }
                >
                  {i % tickEvery === 0 || i === bars.length - 1 ? b.tick : ""}
                </span>
              ))}
            </div>

            {/* The footer names the highlighted bar. It is the one number on
                this card an owner repeats to somebody else, and reading it off
                a chart by eye is exactly the thing an axis makes possible and a
                sentence makes unnecessary. */}
            {peak && (
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line-soft pt-3.5 text-xs">
                <span className="text-muted-foreground">{peakLabel}</span>
                <span className="font-medium text-foreground">
                  {peak.full}
                  <span className="text-muted-foreground"> · </span>
                  <span className="tabular-nums">{money(peak.amount, currency)}</span>
                </span>
              </div>
            )}
          </figure>
        )}
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 4 · Current service
// ---------------------------------------------------------------------------

export type ServiceStat = {
  key: string;
  label: string;
  /** Pre-formatted: "12 / 24", "18", "14 min". */
  value: string;
  /**
   * Why this figure isn't there. When set, it REPLACES the value — a stat that
   * couldn't be measured must never render as a plausible number, and this card
   * has three different reasons a row can be missing (query failed, module off,
   * nothing fulfilled yet) that a reader has no other way to tell apart.
   */
  absent?: string;
};

/**
 * The state of the room, right now — and it is always right now.
 *
 * The scope control at the top of the page moves the sales figures and nothing
 * else. Occupancy, open orders and prep time scoped to yesterday would be facts
 * about a room that has since emptied, which is the opposite of what this card
 * is for, so the header says "Live" and means it whatever the control says.
 *
 * Rows rather than tiles: three label/value pairs is a list, and a list divided
 * by hairlines in a 380px column reads in one pass. Three tiles in the same
 * space is three boxes of air.
 */
export function CurrentServiceCard({
  stats,
  channels,
  state,
  action,
  emptyLine,
  className,
}: {
  stats: ServiceStat[];
  /**
   * Orders by how they arrived. Empty when nothing has been rung.
   *
   * There is no `failed` flag beside this one, and that is not an oversight:
   * the channel split is derived from the page's must() query, so if it could
   * not be read the error boundary is already showing instead of this card.
   */
  channels: ChannelCount[];
  /**
   * The till, in a sentence, plus how loudly to say it. Null only when the
   * drawer query failed — a state we cannot report is not the same as a till
   * that isn't open, and guessing between them is how "open one to start
   * tracking cash" gets said to somebody who already did.
   *
   * The tone is a prop rather than something this component infers from the
   * words, because a component sniffing a sentence for its own meaning breaks
   * silently the first time somebody rewrites the copy.
   */
  state: { text: string; tone: "neutral" | "attention" } | null;
  action: { label: string; href: string } | null;
  /** The written zero state for the channel bar. Required. */
  emptyLine: string;
  className?: string;
}) {
  return (
    <Panel className={"h-full " + (className ?? "")}>
      <PanelHeader
        bordered
        title="Current service"
        trailing={
          // Quiet text, not a chip. It was a pill in the mockup and a pill is a
          // thing you draw around a word to say the word is important — drawn
          // around a word that is on the card every second of every day, it says
          // nothing and it makes the header the most decorated object on the
          // page. The word alone, in the same muted grey as every other
          // subtitle, says "live" perfectly well.
          <span className="text-xs text-muted-foreground">Live</span>
        }
      />

      <ul className="divide-y divide-line-soft">
        {stats.map((s) => (
          <li
            key={s.key}
            className={"flex items-baseline justify-between gap-3 py-3 " + PANEL_X}
          >
            <span className="text-sm text-muted-foreground">{s.label}</span>
            {s.absent ? (
              // The row keeps its label and loses its figure. "—" would be a
              // number-shaped hole; the reason is what a person needs.
              <span className="text-right text-xs text-muted-foreground">
                {s.absent}
              </span>
            ) : (
              <span className="text-[15px] font-semibold tabular-nums tracking-[-0.01em]">
                {s.value}
              </span>
            )}
          </li>
        ))}
      </ul>

      <PanelBody className="flex flex-1 flex-col">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLine}</p>
        ) : (
          <div>
            {/* One track, flat segments, no gaps. A stacked bar is a
                hundred-percent statement, and a gap between its segments is a
                slice of nothing claiming a share — this is the one chart shape
                where the seams have to close. The rungs are far enough apart on
                the ramp to separate without one. */}
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={
                "Orders by channel: " +
                channels.map((c) => c.label + " " + c.count).join(", ") +
                "."
              }
            >
              {channels.map((c, i) => (
                <span
                  key={c.key}
                  aria-hidden
                  className={RAMP_BG[CHANNEL_RUNGS[i] ?? 7]}
                  // A one-order channel out of two hundred is still a real
                  // channel, and at 0.5% it would round to nothing. 2% is the
                  // narrowest segment that survives a hairline border radius.
                  style={{ width: Math.max(c.pct, 2) + "%" }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {channels.map((c, i) => (
                <li key={c.key} className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    aria-hidden
                    className={
                      "size-2 shrink-0 rounded-[2px] " + RAMP_BG[CHANNEL_RUNGS[i] ?? 7]
                    }
                  />
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The till sentence, and it has outlived three rebuilds of this page.
            "No till open yet. Open one to start tracking cash." is the line
            that tells a first-time merchant what to do next without accusing
            them of anything, and the competitor study found nothing in the
            category that comes close to it. Contrast, not hue: a till left open
            from a previous day is money nobody has counted and is set in ink;
            everything routine sits in the same muted grey as the labels above.
            mt-auto pins the block to the foot of the card so it lands level
            with the chart opposite however tall either column runs. */}
        {(state || action) && (
          <div className="mt-auto pt-4">
            {state && (
              <p
                className={
                  "text-xs " +
                  (state.tone === "attention"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground")
                }
              >
                {state.text}
              </p>
            )}
            {action && (
              <Link
                href={action.href}
                className="group u-tx u-focus mt-2.5 inline-flex items-center gap-1 text-xs font-medium hover:text-primary"
              >
                {action.label}
                <ChevronRight className={"u-arrow " + ICON_INLINE} />
              </Link>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 5 · Top-selling items
// ---------------------------------------------------------------------------

export type TopItemRow = {
  key: string;
  name: string;
  qty: number;
  /** Σ unit_price × quantity. Gross of discounts and refunds — see the heading. */
  revenue: number;
};

/**
 * What sold, by the money it brought in.
 *
 * The money column is headed "Item sales" and NOT "Net sales", which is the one
 * place this card departs from the mockup on purpose. `unit_price × quantity` is
 * the line as it was rung: a check-level discount is not prorated back onto the
 * lines that earned it and a refund does not reduce it, because refunding writes
 * to `refunds` and flips `orders.status` without ever touching the line.
 * /app/reports disclaims exactly this under its own copy of this table. Heading
 * the column "Net sales" would make the dashboard state something the number
 * does not support, three inches below a KPI that genuinely is net.
 *
 * The rank column is the mockup's and it earns its place: four rows of a
 * two-column table have no reading order until something numbers them, and
 * "01" at a tabular width is cheaper than alternating row tints.
 */
export function TopItemsCard({
  rows,
  currency,
  failed,
  href,
  hrefLabel,
  emptyTitle,
  emptyLine,
  className,
}: {
  rows: TopItemRow[];
  currency: string;
  failed: boolean;
  href: string;
  hrefLabel: string;
  /** The written zero state. Required. */
  emptyTitle: string;
  emptyLine: string;
  className?: string;
}) {
  return (
    <Panel className={"h-full " + (className ?? "")}>
      <PanelHeader
        bordered
        title="Top-selling items"
        trailing={
          // The arrow is the same ChevronRight that ends every other row on this
          // page rather than a literal "→" from the body font, so it is one mark
          // at one weight, and it leans on hover like the rest.
          <Link
            href={href}
            className="group u-tx u-focus inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {hrefLabel}
            <ChevronRight className={"u-arrow " + ICON_INLINE} />
          </Link>
        }
      />

      {failed ? (
        <div className={"flex items-start gap-2 py-6 text-sm text-muted-foreground " + PANEL_X}>
          <AlertCircle className={"shrink-0 mt-0.5 " + ICON_INLINE} />
          <span>
            Couldn&apos;t load the item mix. It is a fault, not a day where
            nothing sold — check the server log if it persists.
          </span>
        </div>
      ) : rows.length === 0 ? (
        // No column headings over an empty table: naming three columns that hold
        // nothing turns a written explanation into a broken-looking grid.
        <div className={"flex flex-1 flex-col justify-center py-10 " + PANEL_X}>
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{emptyLine}</p>
        </div>
      ) : (
        <>
          <div
            className={
              "flex items-center gap-3 py-2.5 border-b border-line-soft text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground " +
              PANEL_X
            }
          >
            <span className="w-6 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">Item</span>
            <span className="w-20 shrink-0 text-right">Qty sold</span>
            <span className="w-24 shrink-0 text-right">Item sales</span>
          </div>
          <div className="divide-y divide-line-soft">
            {rows.map((r, i) => (
              <div
                key={r.key}
                className={"flex items-center gap-3 py-3 " + PANEL_X}
              >
                {/* Zero-padded, muted, tabular. It is an index, not a score —
                    at full ink it would out-weigh the item name beside it. */}
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.name}
                </span>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {r.qty}
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {money(r.revenue, currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 6 · The attention rail
// ---------------------------------------------------------------------------

/**
 * The reason to buy Surge, and the one object on this page with no equivalent in
 * the category.
 *
 * The competitor study went looking for an exception rail in Toast, Square,
 * Lightspeed and TouchBistro and found nothing: four back-office homes, and not
 * one of them surfaces "here is what is wrong right now". Toast's is three KPI
 * tiles and a link list, Square's is a balance sentence and a metric grid,
 * Lightspeed's is a metric grid and a best-sellers table, TouchBistro's is three
 * tiles and six donuts. So there is no convention here to be quiet about, and
 * this should not read as the fourth identical white rectangle on the page.
 *
 * What it gets instead of a convention: the brand-tinted top edge (`lit`), a
 * stronger ring the moment anything is in it, and the only red on the screen.
 *
 * The SIGNALS are untouched by the rebuild — same thresholds, same ranking, same
 * degraded[] footnote in lib/services/dashboard-signals.ts. Only the row's
 * anatomy changed, to the mockup's circled mark / bold title / muted second line
 * / chevron.
 */
export function AttentionRail({
  signals,
  degraded,
  className,
}: {
  signals: AttentionSignal[];
  /** Human names of the checks that couldn't be run, so "clear" is never a lie. */
  degraded: string[];
  className?: string;
}) {
  return (
    <Panel
      lit
      className={
        (signals.length === 0 ? "ring-line" : "ring-line-strong") + " " + (className ?? "")
      }
    >
      <PanelHeader
        bordered
        title="Needs attention"
        trailing={
          // A count, not a badge. It was a coloured pill once, which made it the
          // fourth thing in the header competing to be read and a third encoding
          // of a severity the row marks already carry twice. A number in the
          // same muted grey as every other subtitle says "three" perfectly well.
          signals.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {signals.length} task{signals.length === 1 ? "" : "s"}
            </span>
          ) : null
        }
      />

      {signals.length === 0 ? (
        // "Nothing to do" is a result, not an empty state — it deserves a
        // confident line rather than the dashed placeholder box that means "you
        // haven't set this up yet".
        <div className={"flex flex-1 flex-col justify-center py-7 " + PANEL_X}>
          {/* Not green, and no tick in a coloured circle. "Nothing needs you
              right now" is good news, and good news does not need to shout —
              painting it emerald is exactly what forces the red on a real signal
              to compete for the same eye. */}
          <p className="text-sm font-medium">Nothing needs you right now.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No late tickets, no stale checks, no approvals waiting.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {signals.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className={
                  "group u-tx u-focus-inset flex items-start gap-3 py-3.5 hover:bg-raised " +
                  PANEL_X
                }
              >
                {/* THE ROW'S ONE SEVERITY MARK. There used to be three per row —
                    a dot, an accent bar up the left edge of the card in the same
                    hue, and a `Blocked` / `Attention` pill beside the title —
                    all encoding the identical fact. The pills were deleted
                    rather than restyled: a row reading "4 kitchen tickets late"
                    beside a pill reading "Blocked" is a label captioning a
                    sentence that already said it.
                    Red for blocked, muted neutral for attention. The ORDER of
                    the rows carries the rest, because rankSignals puts every
                    blocked row above every attention one — so the colour is
                    never the only thing saying which is which. */}
                <span
                  aria-hidden
                  className={
                    "mt-px shrink-0 [&_svg]:size-[18px] [&_svg]:stroke-[1.75] " +
                    (s.severity === "blocked" ? "text-red-500" : "text-muted-foreground/70")
                  }
                >
                  <AlertCircle />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block text-sm " +
                      // The contrast step that replaced the pill. A blocked row
                      // is set in full ink at semibold; an attention row is
                      // medium, like every other row title on the page. A
                      // smaller instrument than a hue, pointed at the same job.
                      (s.severity === "blocked"
                        ? "font-semibold text-foreground"
                        : "font-medium")
                    }
                  >
                    {s.title}
                  </span>
                  {/* The detail and the action on one line. The mockup's second
                      line reads "12 remaining · Review inventory" — the state
                      and where you fix it, in the reader's own grammar — which
                      is better than our old arrangement of floating the action
                      label out to the right where it lined up with nothing. */}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {s.detail}
                    <span aria-hidden> · </span>
                    <span className="u-tx group-hover:text-foreground">
                      {s.actionLabel}
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className={
                    "u-arrow u-tx mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground " +
                    ICON_INLINE
                  }
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {degraded.length > 0 && (
        // The whole point of the rail is that an empty one means "all clear". If
        // a check didn't run, say so here rather than let its silence read as a
        // pass. mt-auto pins it to the foot of the card so it reads as a
        // footnote to the whole list even when the rail has been stretched.
        <div
          className={
            "mt-auto flex items-start gap-2 py-3 border-t border-line-soft bg-raised text-xs text-muted-foreground " +
            PANEL_X
          }
        >
          <AlertCircle className={"shrink-0 mt-px " + ICON_INLINE} />
          <span>
            Couldn&apos;t check {degraded.join(", ")}. Those may be hiding
            something — this list is incomplete.
          </span>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 7 · The page footer
// ---------------------------------------------------------------------------

/**
 * Two quiet lines at the foot of the page, and one of them is an apology for a
 * claim we can't make.
 *
 * The mockup says "Last synced at 10:04 PM". There is no sync timestamp in this
 * product — no heartbeat, no health route, no outbox to have last flushed, and a
 * service worker with no fetch handler (see docs/dashboard-overview-audit.md §7).
 * What IS true is when the server ran the queries, which is the moment every
 * figure above was correct, and that is what this says. It is not dressed up as
 * a sync state and it does not carry a dot.
 *
 * "Sample data" appears only for a tenant that genuinely is one — businesses.is_demo
 * — because a demo watermark on a real restaurant's takings is a worse lie than
 * no watermark at all.
 */
export function DashboardFooter({
  asOf,
  currency,
  isDemo,
}: {
  /** Pre-formatted local time the page was rendered: "10:04 p.m.". */
  asOf: string;
  currency: string;
  isDemo: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line-soft pt-4 text-xs text-muted-foreground">
      <span>
        Figures as of {asOf}
        <span aria-hidden> · </span>
        All amounts in {currency || "CAD"}
      </span>
      <span>
        Surge Admin
        {isDemo && (
          <>
            <span aria-hidden> · </span>Sample data
          </>
        )}
      </span>
    </div>
  );
}
