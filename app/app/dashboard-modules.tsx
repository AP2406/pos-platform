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
//   brand blue  — identity, interactive affordance, and data. The chart line,
//                 the share ramp, the one solid button, link hover.
//   red         — one human, one action, right now. It appears on the
//                 attention rail's accent bar and severity dot when something
//                 is BLOCKED, and nowhere else on this screen.
//
// Green, amber and sky are gone. Green was the expensive one: "Till open since
// 10:02 a.m." and "Everyone on shift is clocked in cleanly" are good news, and
// painting good news makes it compete with the one thing that isn't. Amber went
// with it — a page with an amber tier has to spend amber on every heads-up, and
// then red has to shout over amber to be heard. Both are now expressed the way
// print has always expressed them: contrast. Something you should notice is set
// in ink; everything routine is set in the muted grey the timestamps use.
//
// The rule that survives unchanged: colour never carries meaning alone. The two
// red marks on this page sit beside words that say the same thing, so the page
// still works for a colour-blind owner and in a sunlit dining room.

import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Minus,
  Rocket,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ICON_INLINE,
  PANEL_X,
  Panel,
  PanelBody,
  PanelHeader,
  enterAt,
} from "@/components/ui/panel";
import { niceCeiling } from "@/lib/services/dashboard-signals";
import type {
  AttentionSignal,
  Pace,
  PaymentSlice,
} from "@/lib/services/dashboard-signals";
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
 * The same figure, split at the decimal point.
 *
 * Only the hero number uses this. At 48px the cents are two thirds of a
 * character's worth of information taking up a fifth of the width of the
 * loudest thing on the page, and setting them smaller and quieter lets the
 * dollars read as a single shape — which is how a person actually reads
 * "forty-eight twenty". Everywhere else the cents stay full size, because at
 * 28px and below the difference is fussiness rather than typography.
 *
 * Built from formatToParts rather than by splitting on ".", so it survives a
 * currency with no minor unit (JPY returns no fraction part, and `cents` comes
 * back null) and a locale that groups with the character it decimalises with.
 */
function moneyParts(n: number, currency: string): { main: string; cents: string | null } {
  const parts = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).formatToParts(Number.isFinite(n) ? n : 0);

  const at = parts.findIndex((p) => p.type === "decimal");
  if (at === -1) return { main: parts.map((p) => p.value).join(""), cents: null };
  return {
    main: parts.slice(0, at).map((p) => p.value).join(""),
    cents: parts.slice(at).map((p) => p.value).join(""),
  };
}

/**
 * The hero figure: dollars at full weight, cents stepped down and back.
 *
 * tabular-nums on the wrapper rather than the pieces so both halves are lining
 * figures — this number changes on every reload, and proportional digits make
 * it jitter sideways as the totals climb through the day.
 */
function HeroMoney({ amount, currency }: { amount: number; currency: string }) {
  const { main, cents } = moneyParts(amount, currency);
  return (
    // D6 · The dollars take the flat foreground. This used to be a
    // background-clip ramp that spent 18% of the foreground's lightness on a
    // top-to-bottom fade; flat, the figure is the same ink all the way down
    // and measures 17.73:1 on a white card instead of losing contrast toward
    // the baseline of every digit. The cents keep their 45% step-back, which
    // is one flat colour against another and not a fade.
    <span className="tabular-nums">
      <span className="u-hero-fill">{main}</span>
      {cents && (
        <span className="text-[0.58em] font-semibold text-foreground/45 align-baseline">
          {cents}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 0 · Chart palette
// ---------------------------------------------------------------------------
//
// Tailwind reads class names as literal text, so a hue can't be interpolated
// (`"text-ramp-" + n` compiles to nothing). These tables are the price of that,
// and keeping them in one place is what stops a slice's swatch in the legend
// drifting away from the arc it labels.
//
// These index --ramp-N, not --chart-N. The donut used to spend seven fully
// saturated hues — blue, teal, green, purple, olive, red, magenta — on seven
// shares of one quantity, and a rainbow is what a chart library gives you when
// nobody has decided anything. Money arriving by card and money arriving by
// gift card are not two unrelated series; they are two sizes of the same thing,
// so they get two rungs of one hue. --chart-1..7 stay exactly as they were:
// /app/reports draws series that genuinely are unrelated.
//
// The index is still PAYMENT_HUE's fixed per-tender number, not the slice's
// rank, so cash is the same rung on Friday that it was on Monday. Ranking the
// ramp would read marginally cleaner on any single day and would make the
// legend a different picture every day, which is the more expensive mistake.

const RAMP_BG: Record<number, string> = {
  1: "bg-ramp-1",
  2: "bg-ramp-2",
  3: "bg-ramp-3",
  4: "bg-ramp-4",
  5: "bg-ramp-5",
  6: "bg-ramp-6",
  7: "bg-ramp-7",
};

const RAMP_STROKE: Record<number, string> = {
  1: "stroke-ramp-1",
  2: "stroke-ramp-2",
  3: "stroke-ramp-3",
  4: "stroke-ramp-4",
  5: "stroke-ramp-5",
  6: "stroke-ramp-6",
  7: "stroke-ramp-7",
};

// ---------------------------------------------------------------------------
// 0b · The coloured delta
// ---------------------------------------------------------------------------

export type DeltaDirection = "up" | "down" | "flat";

export type KpiDelta = {
  direction: DeltaDirection;
  /** The magnitude, pre-formatted: "8.2%", "3 more", "$41.20". */
  text: string;
  /** What it is measured against: "vs last Tuesday". Stays muted. */
  suffix: string;
};

/**
 * An arrow, a number, and what it's against — in ink, never in a hue.
 *
 * There used to be a `good` field here, and the arrow was painted green when
 * the delta pointed the way the field said it should and red when it didn't.
 * Four of those across the KPI strip is most of the rainbow the page was
 * accused of being, and it was buying nothing: the ARROW already encodes the
 * direction and the words already encode the comparison, so the colour was a
 * third statement of a fact stated twice. It also spent the page's alert hue on
 * a figure nobody can act on — an average check 8% down is not a thing you get
 * up and fix, and once red means "8% down" it cannot also mean "the kitchen is
 * blocked".
 *
 * What is left is a contrast step: the magnitude sits in full ink beside a
 * muted comparison, which is enough to make it the thing you read first in a
 * two-line block and costs the page no colour at all.
 */
function Delta({ delta, size = "sm" }: { delta: KpiDelta; size?: "sm" | "md" }) {
  const Glyph =
    delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;

  return (
    // Wraps rather than truncates: in a two-up KPI strip on a phone there is
    // room for "2 more" and "than last Thursday" on separate lines, and there
    // is never room for "than last Thurs…", which reads as broken.
    <span
      className={
        "inline-flex flex-wrap items-center gap-x-1 " +
        (size === "md" ? "text-[13px]" : "text-xs")
      }
    >
      <span className="inline-flex items-center gap-0.5 font-semibold whitespace-nowrap text-foreground">
        {/* One inline glyph size across the page. The md/sm split used to move
            this arrow between 14px and 16px, which made the same mark two
            different objects depending on which card it landed in. */}
        <Glyph className={ICON_INLINE + " shrink-0"} />
        <span className="tabular-nums">{delta.text}</span>
      </span>
      <span className="text-muted-foreground">{delta.suffix}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// 0c · The KPI strip
// ---------------------------------------------------------------------------

export type Kpi = {
  id: string;
  /** Two or three words. The number below is what gets read. */
  label: string;
  value: string;
  icon: React.ReactNode;
  /** Null when there is no honest comparison. Never a fabricated 0%. */
  delta: KpiDelta | null;
  /**
   * What stands in for the delta when there isn't one. This is the line that
   * has to distinguish "last Tuesday was closed" from "the query broke", so it
   * is a sentence and it is required.
   */
  note: string;
};

/**
 * Four figures an owner would recite from memory, each against the same
 * weekday last week — as ONE band divided by hairlines, not four cards.
 *
 * This is not the seven-tile grid the page was rebuilt to get rid of. The
 * difference is the delta: a tile that says "$1,284" tells you nothing you can
 * act on, and one that says "$1,284, 8% behind last Tuesday" tells you whether
 * to worry. Everything without a comparison stayed downstairs in the ops blocks.
 *
 * WHY IT STOPPED BEING FOUR CARDS. They were four ringed, shadowed rectangles
 * carrying 32px figures, sitting ABOVE the one number the page exists to
 * answer — so at a squint the strip out-weighed the hero, and the first thing
 * the eye found was a row of four things of equal importance, which is another
 * way of saying it found nothing. Merged into a single band the strip reads as
 * one object at one weight, the page loses four edges and four shadows, and the
 * figures step back to 26px, which is comfortably under the hero and comfortably
 * over the ops band. It is the same move that turned three ops cards into one
 * panel, for the same reason: things that are one system should look like one.
 *
 * The `Sales today` cell deliberately still duplicates the hero figure. It is
 * the anchor of the row — you read across from it — and deleting it to avoid a
 * repeat would leave a three-cell band whose first column is a comparison
 * against a number that isn't there.
 */
export function KpiStrip({
  items,
  enterFrom = 0,
}: {
  items: Kpi[];
  /**
   * Where this strip sits in the page's arrival order. The four cells stagger
   * off it left to right — this is the one band whose members arrive
   * individually rather than together, because four landing at once is a row
   * appearing and four landing in sequence is a row being dealt.
   */
  enterFrom?: number;
}) {
  if (items.length === 0) return null;
  return (
    <Panel>
      {/* `divide-*` can't do this: it draws between flex/grid children in
          source order, which on a 2×2 phone layout would put a rule down the
          middle AND one between cells 2 and 3 that are not beside each other.
          So the cells own their own left and top hairline and the ones at the
          start of a row switch theirs off — two rules, one for each breakpoint,
          and the grid stays a grid. */}
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {items.map((k, i) => (
          <section
            key={k.id}
            style={enterAt(enterFrom + i)}
            className={
              "u-in px-5 py-4 border-line-soft " +
              // Phone: two columns, so a rule left of every odd cell is wrong
              // and a rule above the second row is right.
              "border-l [&:nth-child(2n+1)]:border-l-0 [&:nth-child(n+3)]:border-t " +
              // Desktop: one row of four, so the top rules go and only the
              // first cell loses its left one.
              "lg:[&:nth-child(2n+1)]:border-l lg:[&:nth-child(4n+1)]:border-l-0 lg:[&:nth-child(n+3)]:border-t-0"
            }
          >
            <div className="flex items-start justify-between gap-2">
              {/* Quieter and wider than it was. The gap between the softest and
                  loudest type on a screen is most of what reads as "considered",
                  and this label is the floor of that ladder — its job is to be
                  found when looked for and ignored otherwise. */}
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
                {k.label}
              </span>
              {/* No tinted well. A blue rounded square behind a banknote glyph is
                  furniture from a template: it spends a saturated block of colour
                  on an icon that is already only decorative, and four of them in
                  four different hues across one strip is the single loudest
                  un-earned thing on the page. The glyph alone, hairline weight,
                  in the same grey as the label it sits beside. */}
              {/* 16px, the same as every other card-header glyph. It was 18 —
                  the only 18 on the page — which made four of the page's icons
                  subtly larger than the rest for no reason anyone could name. */}
              <span
                aria-hidden
                className="shrink-0 text-muted-foreground/70 [&_svg]:size-4 [&_svg]:stroke-[1.5]"
              >
                {k.icon}
              </span>
            </div>
            <div className="mt-3 text-[22px] sm:text-[26px] font-bold tabular-nums tracking-[-0.02em] leading-none">
              {k.value}
            </div>
            <div className="mt-2.5 min-w-0">
              {k.delta ? (
                <Delta delta={k.delta} />
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
// 1 · Launch readiness — loud while it matters, gone the moment it doesn't
// ---------------------------------------------------------------------------

/**
 * For a merchant who can't take a payment yet, "today's sales: $0.00" is a true
 * statement and a useless one. Until the required setup is done this outranks
 * the numbers, because finishing it is literally the only thing that can change
 * them.
 *
 * It renders nothing once `ready` — a permanent checklist is a permanent
 * accusation, and there is no "dismiss" here on purpose: the way to remove it
 * is to finish, which takes about five minutes.
 */
export function ReadinessPanel({ report }: { report: ReadinessReport }) {
  if (report.ready) return null;
  const left = report.outstanding.length;

  return (
    // Brand, not amber, and not the alert hue either. This panel is a task
    // list — "here are the three things standing between you and taking a
    // payment" — and every one of its rows is a link to the screen that
    // finishes one. That is an affordance, which is what brand blue means on
    // this page. Amber would have reopened a third colour story for a panel
    // most tenants see once; red would have spent the page's one alarm on
    // something that is not an alarm, it is a to-do list. The panel is loud
    // enough by being first, being wide, and saying what it says.
    <Panel className="ring-primary/30">
      {/* The same header primitive as every other panel, keeping only what is
          genuinely different here: the glyph is in a ring rather than bare,
          because this panel is the one thing on the page allowed to raise its
          voice. Outlined rather than filled — the ring says it as clearly as a
          wash of it would and leaves the glyph legible. */}
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
        /* The count is the whole message. "Each one links to where you finish
           it" described the underline under the reader's cursor. */
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
              {/* A bullet, not a warning light. It marks where a row starts;
                  the row's own words say what it is. */}
              <span className="shrink-0 size-1.5 rounded-full bg-line-strong" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">
                  {c.title}
                </span>
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
// 2 · Today, with pace
// ---------------------------------------------------------------------------

// THE PACE CHIP IS GONE, AND IT WAS NOT RESTYLED.
//
// It sat in the hero's header and read "↗ 8% ahead of last Thursday", in green,
// in a pill. Directly beneath it — same card, two lines down — the delta line
// read "↗ $361.70 vs last Thursday at 4:12 p.m.". Two marks, two hues, one
// fact, and the one that was deleted is the one that carried the WEAKER figure:
// a percentage is for comparing and a dollar amount is what an owner feels. The
// no-benchmark and failed variants went with it, because the card's body
// already writes both of those out as a sentence — a pill saying "Comparison
// unavailable" above a paragraph explaining that the comparison is unavailable
// is the same duplication wearing a different hat.

/** The two cumulative curves, pre-sampled by the page. */
export type PaceCurve = {
  /** Cumulative takings so far, truncated at the current sample. */
  today: number[];
  /** The comparison day, whole. Empty when there is nothing to compare to. */
  benchmark: number[];
  /** Samples in a full day — both arrays are indexed against this. */
  steps: number;
  /** 0–1 through the day, or null once the day is over. */
  nowFrac: number | null;
  /** A few clock times to hang under the axis, positioned by day fraction. */
  xLabels: { at: number; text: string }[];
};

/**
 * Cumulative takings, this day against the same weekday last week.
 *
 * Hand-rolled SVG rather than a chart library: two monotonic series, two
 * gridlines and one marker do not justify a runtime, and this way the lines are
 * painted in the same OKLCH tokens as everything else on the page.
 * `preserveAspectRatio="none"` lets the box stretch to whatever column it lands
 * in — desktop's wide primary column or a phone — and `vector-effect` keeps the
 * strokes a hairline when it does.
 *
 * The caller decides whether there is anything worth drawing. A flat line along
 * the floor of an empty day looks like a reading, and it isn't one.
 */
function PaceChart({
  curve,
  ceiling,
  currency,
  weekday,
  scopeWord,
}: {
  curve: PaceCurve;
  ceiling: number;
  currency: string;
  weekday: string;
  scopeWord: string;
}) {
  const W = 600;
  const H = 120;

  const y = (v: number) =>
    ceiling > 0 ? H - Math.min(1, Math.max(0, v / ceiling)) * H : H;
  const x = (i: number) => ((i + 1) / curve.steps) * W;

  // Every curve starts the day at zero, so the path opens at the origin rather
  // than at whatever the first half-hour happened to take.
  const line = (series: number[]) => {
    let d = "M 0 " + H;
    for (let i = 0; i < series.length; i++) {
      d += " L " + x(i).toFixed(2) + " " + y(series[i]).toFixed(2);
    }
    return d;
  };

  const todayEnd = curve.today.length > 0 ? x(curve.today.length - 1) : 0;

  return (
    <figure className="mt-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {/* The swatches are decoration; the words beside them are the legend.
            Only one of them is coloured. The benchmark used to be teal, which
            gave a two-series chart two equal claims on the eye — but these
            series are not equals: one is the number the whole page is about and
            the other is a reference line behind it. Brand hue for today, a grey
            hairline for last week, and the chart says which is which before a
            word of the legend is read. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            {/* Same swatch geometry as the payment-mix legend. It was 2px
                against the donut's 3px, which is invisible on its own and
                exactly the sort of near-miss that adds up. */}
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
            {scopeWord}
          </span>
          {curve.benchmark.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-2 h-px bg-muted-foreground/70" />
              Last {weekday}
            </span>
          )}
        </span>
        <span className="tabular-nums">{moneyRound(ceiling, currency)}</span>
      </figcaption>

      <svg
        viewBox={"0 0 " + W + " " + H}
        preserveAspectRatio="none"
        className="mt-1.5 w-full h-[120px]"
        role="img"
        aria-label={
          "Takings accumulating through the day" +
          (curve.benchmark.length > 0
            ? ", against last " + weekday + ". The figures are written out below."
            : ". The figures are written out below.")
        }
      >
        {/* Gridlines take the soft line, not the card's edge weight: inside a
            card, structure should be quieter than the boundary around it. */}
        <line x1="0" y1="0" x2={W} y2="0" className="stroke-line-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="stroke-line-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={H} x2={W} y2={H} className="stroke-line-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {curve.benchmark.length > 0 && (
          // The reference line draws first and slightly faster, so by the time
          // today's line has finished arriving there is already something for
          // it to be measured against. Drawing them in the other order would
          // show the reader an answer before the question.
          <path
            d={line(curve.benchmark)}
            fill="none"
            pathLength="1"
            className="u-draw stroke-muted-foreground/55"
            style={enterAt(5)}
            strokeWidth="1.25"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {curve.today.length > 0 && (
          <>
            {/* D2 · The area under the line: ONE flat tint of the series
                colour, --chart-1-area, at a single alpha (0.14). It was a
                top-to-baseline fade from 0.22 to nothing, which read as the
                line casting light downward; flat, it reads as the area the
                line encloses, which is the thing the shape actually means.
                The alpha is a token rather than a number here so that the next
                area chart cannot pick a second one — the whole point of
                "one alpha everywhere" is that it is written down once.
                The fill still fades UP on arrival rather than being drawn: an
                area mask that unrolled with the line would need a clip rect
                animating its width, which is the layout-costing animation the
                rest of this page avoids. That is an opacity transition for
                motion, not a colour gradient. */}
            <path
              d={line(curve.today) + " L " + todayEnd.toFixed(2) + " " + H + " L 0 " + H + " Z"}
              fill="var(--chart-1-area)"
              className="u-fade"
              style={enterAt(6)}
              stroke="none"
            />
            {/* pathLength="1" normalises the dash maths, which is what lets a
                server-rendered chart draw itself: nothing here ever has to
                call getTotalLength(), so there is no measuring pass, no
                client component, and the line is complete and correct in the
                HTML before a frame of animation runs. */}
            <path
              d={line(curve.today)}
              fill="none"
              pathLength="1"
              className="u-draw stroke-chart-1"
              style={enterAt(6)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Where the day has got to. Without it the shorter line reads as a
            collapse rather than as a day that isn't finished. */}
        {curve.nowFrac != null && (
          <line
            x1={curve.nowFrac * W}
            y1="0"
            x2={curve.nowFrac * W}
            y2={H}
            className="stroke-foreground/35"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground">
        {curve.xLabels.map((l) => (
          <span
            key={l.at}
            className="absolute -translate-x-1/2 tabular-nums whitespace-nowrap"
            style={{ left: l.at * 100 + "%" }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function TodayModule({
  pace,
  currency,
  weekday,
  scope,
  benchmarkTimeLabel,
  lastSaleLabel,
  everSold,
  failed,
  curve,
}: {
  pace: Pace;
  currency: string;
  /** "Wednesday" — the weekday being compared against. */
  weekday: string;
  /** Which day the figures cover. Only ever the current one or the last one. */
  scope: "today" | "yesterday";
  /**
   * Local clock time the benchmark was truncated at, e.g. "2:15 p.m." — null
   * when the day being shown is already over and the comparison is whole-day.
   */
  benchmarkTimeLabel: string | null;
  /** Human date of the most recent sale on record, or null if there is none. */
  lastSaleLabel: string | null;
  everSold: boolean;
  /** True when the comparison query failed — never dress that up as a flat week. */
  failed: boolean;
  /** Null when the page had no timestamps to sample. */
  curve: PaceCurve | null;
}) {
  const hasBenchmark = pace.status !== "no-benchmark";
  const scopeWord = scope === "today" ? "Today" : "Yesterday";
  // "Nothing yet" is only true of a day still running.
  const quietOpener = scope === "today" ? "Nothing yet today" : "Nothing yesterday";

  // A curve of zeroes is a picture of nothing. Draw only once at least one of
  // the two days actually took money — otherwise the honest render is the
  // sentence underneath, which says which kind of quiet this is.
  const ceiling = niceCeiling(Math.max(pace.today, pace.benchmarkFull));
  const showChart =
    !failed && curve != null && curve.today.length > 0 && ceiling > 0;

  const deltaAbs = Math.abs(pace.today - pace.benchmarkSoFar);

  return (
    // flex-1 on the card, and min-h-0 inside it: this is one of the two cards
    // that terminate a column, and whichever column comes up short absorbs the
    // difference here rather than leaving a ragged foot of canvas. See the
    // grid note in pos-dashboard.tsx.
    // `lit` puts a flat brand-tinted hairline along the top edge. Only this
    // card and the rail carry it: they lead their columns, and on a third card
    // a coloured top edge stops being an accent and starts being a stripe.
    //
    // THE ONLY CARD ON THE PAGE WITH A SHADOW. Elevation means "this floats
    // above the page", and it can only mean that while it is rare — every panel
    // used to carry it, which made it wallpaper. This is the primary tier: the
    // one object that answers "how is today going", and being lifted is part of
    // how it says so. Everything else is defined by its hairline. The other
    // exception on the screen is the `New sale` button, which is a key you press
    // rather than a surface you read.
    <Panel lit className="h-full shadow-elevation">
      {/* Two-line header zone — title, then what the number is net of. Square
          and Lightspeed both carry a subtitle here; we carried none anywhere. */}
      <PanelHeader
        size="lg"
        title={"Sales " + scope}
        /* The sale count moved to the KPI strip, so this line is down to the
           one thing the big number can't say for itself: what it is net of. */
        subtitle="Net of refunds · training excluded"
      />

      <PanelBody size="lg" className="flex flex-1 flex-col">
      {/* -0.02em rather than the default: at 48px, tracking set for body copy
          leaves lakes of air between digits and the figure stops reading as one
          object. This is the loudest thing on the page and it should look
          drawn, not typed. */}
      {/* 44/64, up from 36/48. The KPI band below now tops out at 26 and the
          ops band at 22, which makes this figure roughly 2.5× the next loudest
          number on the page — a ratio you read at a squint rather than one you
          have to measure. It was 48 against the strip's 32, which is 1.5×, and
          1.5× is what two things of the same importance look like. */}
      {/* D1 · THE DARK-MODE BLOOM IS GONE. It was a brand-hue radial glow
          behind the figure, and a radial glow is a gradient with no flat form
          to take — flattening it would mean painting a coloured rectangle
          behind the number, which is a worse object than no object. The
          figure sits on the card's own surface step and the page's one drop
          shadow, which is what it sat on before the bloom existed.
          `isolate` and `-z-10` went with it; nothing is layered here now. */}
      <div className="w-fit text-[44px] sm:text-[64px] font-bold tracking-[-0.02em] leading-none">
        <HeroMoney amount={pace.today} currency={currency} />
      </div>

      {/* The percentage is for comparing; the dollar figure is what an owner
          feels. The chip above already carries the percent, so this carries the
          money — as an arrow and a figure rather than the sentence it used to
          be, because "$412.80 ahead of last Wednesday at 2:15 p.m." is a
          caption an owner reads once and never again. */}
      {!failed && hasBenchmark && (
        <div className="mt-3">
          <Delta
            size="md"
            delta={{
              direction:
                pace.status === "ahead" ? "up" : pace.status === "behind" ? "down" : "flat",
              text: money(deltaAbs, currency),
              suffix:
                (pace.status === "level" ? "of last " : "vs last ") +
                weekday +
                (benchmarkTimeLabel ? " at " + benchmarkTimeLabel : ""),
            }}
          />
        </div>
      )}

      {showChart && curve && (
        <>
          <PaceChart
            curve={curve}
            ceiling={ceiling}
            currency={currency}
            weekday={weekday}
            scopeWord={scopeWord}
          />
          {hasBenchmark && (
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Last {weekday}
                {benchmarkTimeLabel ? " by " + benchmarkTimeLabel : ""}:{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {money(pace.benchmarkSoFar, currency)}
                </span>
              </span>
              {benchmarkTimeLabel && (
                <span>
                  Full day:{" "}
                  <span className="tabular-nums font-medium text-foreground">
                    {money(pace.benchmarkFull, currency)}
                  </span>
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* The case that actually ships: nothing today, and nothing to hold it
          against. Say which kind of quiet this is — a first day, a slow
          morning, or a business that stopped ringing sales weeks ago. */}
      {!hasBenchmark && !failed && (
        <p className="mt-5 text-sm text-muted-foreground">
          {pace.today > 0 ? (
            // Sales, but no comparison day. The old copy said "nothing yet
            // today" here too, which was simply untrue whenever a new merchant
            // rang their first week of sales.
            <>
              Last {weekday} was quiet, so there is nothing to pace against —{" "}
              {scope === "today" ? "today" : "yesterday"}&apos;s total stands on
              its own.
            </>
          ) : !everSold ? (
            <>
              No sales recorded yet. Your first one lands here the moment it&apos;s
              rung up.
            </>
          ) : lastSaleLabel ? (
            <>
              {quietOpener}, and last {weekday} was quiet too — so there is
              nothing to pace against. Your most recent sale was{" "}
              <span className="font-medium text-foreground">{lastSaleLabel}</span>.
            </>
          ) : (
            <>
              {quietOpener}, and last {weekday} was quiet too.
            </>
          )}
        </p>
      )}

      {failed && (
        <p className="mt-5 text-sm text-muted-foreground">
          {scopeWord}&apos;s total is correct. Last {weekday}&apos;s figures
          couldn&apos;t be loaded, so the pace comparison is missing — this is a
          fault, not a flat week.
        </p>
      )}
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2b · Sales by day — the fortnight behind the hero number
// ---------------------------------------------------------------------------

export type DayBar = {
  /** Local date key, e.g. "2026-09-10". Stable across renders, so it's the key. */
  key: string;
  /** One or two letters under the bar: "M", "Tu". */
  tick: string;
  /** Spoken date, for the accessible summary: "Tue, Sep 9". */
  full: string;
  amount: number;
  /** The scoped day — the one the hero number above is talking about. */
  current: boolean;
};

/**
 * Fourteen days of takings, each bar standing in its own full-height track.
 *
 * The track is the point. Bars alone answer "which day was biggest"; bars in
 * tracks also answer "how big could a day be here", because every column is the
 * same height and the empty part of it is the headroom. A Monday at a third of
 * the track reads as a third of a good day, which is the sentence an owner
 * would say out loud, and no axis is needed to say it.
 *
 * SVG, stretched with preserveAspectRatio="none", the same trick the pace chart
 * uses — the box has to survive a 760px desktop column and a 335px phone, and
 * the only thing that distorts is a 4px corner radius.
 */
export function DailySalesCard({
  bars,
  total,
  trend,
  currency,
  failed,
  className,
}: {
  bars: DayBar[];
  /** Takings across the whole window. */
  total: number;
  /** Last seven days against the seven before them. Null when either is empty. */
  trend: KpiDelta | null;
  currency: string;
  failed: boolean;
  /** The grid passes flex-1 here — this card terminates the wide column. */
  className?: string;
}) {
  const W = 600;
  const H = 132;
  const slot = bars.length > 0 ? W / bars.length : W;
  // 60% bar, 40% air. Wider and the tracks merge into one grey block; narrower
  // and fourteen bars start to look like a barcode.
  const barW = slot * 0.6;
  const ceiling = niceCeiling(Math.max(...bars.map((b) => b.amount), 0));
  const radius = Math.min(4, barW / 2);

  return (
    <Panel className={"h-full " + (className ?? "")}>
      <PanelHeader
        title="Sales by day"
        subtitle="Last 14 days"
        trailing={
          !failed ? (
            <div className="text-right">
              <div className="text-[22px] font-bold tabular-nums tracking-[-0.02em] leading-none">
                {money(total, currency)}
              </div>
              <div className="mt-1.5 flex justify-end">
                {trend ? (
                  <Delta delta={trend} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Not enough history to trend yet
                  </span>
                )}
              </div>
            </div>
          ) : null
        }
      />

      <PanelBody className="flex flex-1 flex-col">
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the last fortnight. The bars are missing because the
          query failed, not because the days were empty.
        </p>
      ) : ceiling <= 0 ? (
        // Fourteen empty tracks is a picture of nothing, and drawing it would
        // imply we measured fourteen zeroes rather than found no sales at all.
        <p className="text-sm text-muted-foreground">
          No sales in the last 14 days. Each day you trade adds a bar here, so
          the shape of your week builds itself.
        </p>
      ) : (
        <>
          {/* flex-1, with 132px as a floor rather than a fixed height. This is
              the card that terminates the wide column, so any slack left over
              when the two columns don't match exactly is spent on taller bars
              — which is the one place on the page where extra height is worth
              something — instead of on a ragged foot of empty canvas. */}
          <figure className="flex flex-1 flex-col">
            <figcaption className="flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>Daily takings</span>
              <span className="tabular-nums">{moneyRound(ceiling, currency)}</span>
            </figcaption>
            <svg
              viewBox={"0 0 " + W + " " + H}
              preserveAspectRatio="none"
              className="mt-1.5 w-full flex-1 min-h-[132px]"
              role="img"
              aria-label={
                "Daily takings for the last 14 days. " +
                bars.map((b) => b.full + ": " + money(b.amount, currency)).join(", ")
              }
            >
              {/* D2 · No <defs>. The three gradients that used to live here —
                  two bar fills and the track — are three flat tokens now.
                  The ramp is what makes that work: --ramp-N is already a
                  ladder of DISCRETE stops of one hue, tuned for how many rungs
                  the eye can order, so "a step down" is a real value in the
                  system rather than an opacity invented at the call site. */}
              {bars.map((b, i) => {
                const x = i * slot + (slot - barW) / 2;
                const h = ceiling > 0 ? Math.min(1, b.amount / ceiling) * H : 0;
                // A day that traded but barely has to stay visible, or the chart
                // says "closed" about a day that wasn't.
                const drawn = b.amount > 0 ? Math.max(h, 3) : 0;
                return (
                  <g key={b.key}>
                    <rect
                      x={x}
                      y={0}
                      width={barW}
                      height={H}
                      rx={radius}
                      fill="var(--well)"
                    />
                    {/* One hue, two rungs of it, both flat. The scoped day —
                        the one the hero figure above is talking about — takes
                        --ramp-1, the strongest rung in either theme; the other
                        thirteen take --ramp-3, two rungs down.
                        --ramp-3 rather than something fainter on purpose: the
                        idle bars used to be the same two rungs at 32–50%
                        opacity, which put them at roughly 1.5:1 against the
                        card. Flat --ramp-3 measures 3.24:1 in light and 4.71:1
                        in dark, so the thirteen days a reader is meant to see
                        the SHAPE of now clear the 3:1 graphical floor they
                        never used to. The step to --ramp-1 is 1.83:1, which is
                        two rungs of a ladder built to be ordered by eye, and
                        the current day's axis tick is also set in semibold
                        foreground below — the highlight is carried twice. */}
                    {drawn > 0 && (
                      // scaleY from a bottom origin, so fourteen bars grow out
                      // of the baseline for the price of a transform each and
                      // no layout at all. `transform-box: fill-box` (in
                      // .u-rise) is what pins the origin to the bar's own foot
                      // rather than to the SVG's origin, which is the whole
                      // difference between growing and sliding.
                      // The stagger runs left to right, oldest day first, at
                      // half the page's step: fourteen bars at a full 40ms
                      // would take 560ms to deal out, which is longer than the
                      // entire rest of the page's arrival.
                      <rect
                        x={x}
                        y={H - drawn}
                        width={barW}
                        height={drawn}
                        rx={radius}
                        className="u-rise"
                        style={enterAt(7 + i * 0.5)}
                        fill={b.current ? "var(--ramp-1)" : "var(--ramp-3)"}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-1.5 flex text-[10px] sm:text-[11px] text-muted-foreground">
              {bars.map((b) => (
                <span
                  key={b.key}
                  className={
                    "flex-1 text-center tabular-nums " +
                    (b.current ? "font-semibold text-foreground" : "")
                  }
                >
                  {b.tick}
                </span>
              ))}
            </div>
          </figure>
        </>
      )}
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2c · Payment mix
// ---------------------------------------------------------------------------

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/**
 * How the money arrived, as a ring with the percentages written beside it.
 *
 * The legend is the chart here — nobody eyeballs "is that arc 26% or 31%" — so
 * the arcs are really a colour key for a list of numbers, and the numbers are
 * rounded together so they sum to 100 (see paymentMix()).
 *
 * It matters operationally, not decoratively: a cash share that jumps is a
 * till that needs counting more often, and a delivery-app share that climbs is
 * commission quietly eating a margin nobody re-checked.
 */
export function PaymentMixCard({
  slices,
  total,
  currency,
  failed,
  className,
}: {
  slices: PaymentSlice[];
  total: number;
  currency: string;
  failed: boolean;
  /** The grid passes flex-1 here — this card terminates the narrow column. */
  className?: string;
}) {
  // Arcs are laid end to end from twelve o'clock. A 1.5px gap between them
  // keeps two adjacent slices from reading as one; a slice too small to hold
  // the gap simply doesn't get one rather than being drawn inside-out.
  const arcLen = (pct: number) => (pct / 100) * RING_C;
  const arcs = slices.map((s, i) => {
    const len = arcLen(s.pct);
    // Prefix sum rather than a running counter: seven slices at most, and a
    // mutable accumulator inside a render is the kind of thing that quietly
    // stops being reset when this component is eventually memoised.
    const offset = slices.slice(0, i).reduce((sum, x) => sum + arcLen(x.pct), 0);
    const gap = len > 6 ? 1.5 : 0;
    return { slice: s, len: Math.max(0, len - gap), offset };
  });

  return (
    <Panel className={"h-full " + (className ?? "")}>
      {/* Tertiary. This is reference — a shape you check against last month,
          not a thing that hails you — so its title is a rung quieter than the
          rail's beside it and its body is tighter. */}
      <PanelHeader size="sm" title="Payment mix" subtitle="Last 14 days" />

      <PanelBody size="sm" className="flex flex-1 flex-col">
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the payment mix. It is a fault, not an all-cash
          fortnight.
        </p>
      ) : total <= 0 || slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing settled in the last 14 days, so there is no mix to split.
          Cash, card and gift cards each get a slice once sales start landing.
        </p>
      ) : (
        // Ring above, legend below, both full-width — not side by side.
        //
        // This card lives in the narrow column and terminates it, so it is the
        // card that absorbs whatever the two columns don't agree on. Stacked,
        // that slack lands in the ring's own breathing room and the legend gets
        // the whole column width, so "Delivery app" and its figure stop
        // fighting for 190px. Side by side, the same slack would have been dead
        // air under a donut.
        <div className="flex flex-1 flex-col items-center gap-5">
          <div className="relative flex w-full flex-1 items-center justify-center py-1">
          <div className="relative w-[150px] h-[150px]">
            <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90" role="img"
              aria-label={
                "Payment mix: " +
                slices.map((s) => s.pct + " percent " + s.label).join(", ")
              }
            >
              {/* The unfilled ring underneath, so a mix that somehow doesn't
                  reach 100 shows as a gap rather than as a smaller donut. */}
              <circle
                cx="66"
                cy="66"
                r={RING_R}
                fill="none"
                className="stroke-foreground/[0.06]"
                strokeWidth="14"
              />
              {arcs.map((a, i) => (
                // C2 · Each arc sweeps out from its own start point, in order,
                // so the ring assembles the way the money arrived rather than
                // rotating into place as a finished object.
                //
                // The animation drives stroke-dasharray, not stroke-dashoffset:
                // dashoffset would slide the arc around the ring from
                // somewhere else, and what this needs is for the arc to GROW
                // from where it belongs. The offset stays a static attribute
                // pinning the start, and --arc-len / --arc-gap are the only
                // things the keyframe has to know — which is why they are
                // handed in as custom properties from here, the only place a
                // slice's share is known.
                <circle
                  key={a.slice.key}
                  cx="66"
                  cy="66"
                  r={RING_R}
                  fill="none"
                  className={"u-sweep " + (RAMP_STROKE[a.slice.hue] ?? RAMP_STROKE[6])}
                  style={
                    {
                      "--arc-c": RING_C.toFixed(2),
                      "--arc-len": a.len.toFixed(2),
                      "--arc-gap": (RING_C - a.len).toFixed(2),
                      ...enterAt(8 + i * 0.5),
                    } as React.CSSProperties
                  }
                  strokeWidth="14"
                  strokeLinecap="butt"
                  strokeDasharray={a.len.toFixed(2) + " " + (RING_C - a.len).toFixed(2)}
                  strokeDashoffset={(-a.offset).toFixed(2)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[19px] font-bold tabular-nums tracking-[-0.02em] leading-none">
                {moneyRound(total, currency)}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.09em] text-muted-foreground mt-1.5">
                taken
              </span>
            </div>
          </div>
          </div>

          {/* The legend now owns the full column width, so nothing truncates
              and the two numeric columns are fixed-width and right-aligned —
              percentages line up under percentages, money under money. */}
          <ul className="w-full space-y-2.5">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2.5 text-xs">
                <span
                  aria-hidden
                  className={"shrink-0 size-2.5 rounded-[3px] " + (RAMP_BG[s.hue] ?? RAMP_BG[6])}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {s.label}
                </span>
                {/* The percentage used to be painted in the slice's own hue,
                    which was fine when every slice was a saturated mid-tone and
                    is unreadable now that the pale end of the ramp exists — a
                    4%-chroma blue is a swatch, not a text colour. The swatch
                    two columns left already ties this row to its arc, so the
                    figure gets to be the loud thing in the row instead. */}
                <span className="shrink-0 w-10 text-right tabular-nums font-semibold text-foreground">
                  {s.pct}%
                </span>
                <span className="shrink-0 w-[76px] text-right tabular-nums text-muted-foreground">
                  {moneyRound(s.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </PanelBody>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 3 · The attention rail
// ---------------------------------------------------------------------------

export function AttentionRail({
  signals,
  degraded,
}: {
  signals: AttentionSignal[];
  /** Human names of the checks that couldn't be run, so "clear" is never a lie. */
  degraded: string[];
}) {
  // No competitor back office has an exception rail at all, so there is no
  // convention here to be quiet about. This is the reason to buy Surge, and it
  // should not read as the fourth identical white rectangle on the page: a
  // stronger edge and an accent bar in the worst signal's severity, echoing the
  // ReadinessPanel, which already earns its own ring.
  const worst = signals.some((s) => s.severity === "blocked")
    ? "blocked"
    : signals.length > 0
      ? "attention"
      : "clear";

  return (
    <Panel
      lit
      className={worst === "clear" ? "ring-line" : "ring-line-strong"}
    >
      {/* C5 · The accent bar announces itself twice on arrival and then stops.
          It pulses only when there is actually something in the rail — a
          bar that breathes over "nothing needs you right now" is the product
          asking for attention it hasn't earned.

          RED, OR NOTHING. This bar is one of the two places on the whole page
          that is allowed a hue other than brand, and it takes it only when
          something is BLOCKED — a server standing at a terminal, food going
          cold, a till of yesterday's cash uncounted. A rail whose worst signal
          is `attention` gets the strong neutral instead, which is still a
          drawn edge and is still visibly not the "clear" state. That is the
          whole of why red works here: on a normal afternoon this bar is grey,
          so the day it turns red you look. */}
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-0 w-[3px] " +
          (worst === "clear" ? "" : "u-pulse ") +
          (worst === "blocked" ? "bg-red-500" : "bg-line-strong")
        }
        style={enterAt(7)}
      />
      {/* No subtitle. "Everything blocking service or costing money, as of
          right now" restated the heading at four times the length, and the
          rows underneath already say what each thing is. The empty state
          below still gets its sentences — that is when explanation earns
          its place. */}
      <PanelHeader
        bordered
        title="Needs you now"
        trailing={
          // A count, not a badge. It was a coloured pill, which made it the
          // fourth thing in the header competing to be read and the third
          // encoding of a severity the bar and the row dots already carry.
          // A number in the same muted grey as every other subtitle on the
          // page says "three" perfectly well.
          signals.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {signals.length} open
            </span>
          ) : null
        }
      />

      {signals.length === 0 ? (
        // "Nothing to do" is a result, not an empty state — it deserves a
        // confident line rather than the dashed placeholder box that means
        // "you haven't set this up yet".
        <div className={"flex flex-1 items-center gap-3 py-6 " + PANEL_X}>
          {/* Not green. "Nothing needs you right now" is good news, and good
              news does not need to shout — painting it emerald is exactly what
              forces the red on the row above it to compete for the same eye.
              A neutral tick reads as calm, which is what it is. */}
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ring-1 ring-inset ring-line-strong text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.5]">
            <CheckCircle2 />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Nothing needs you right now.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No late tickets, no stale checks, no approvals waiting.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {signals.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className={
                  "group u-tx u-focus-inset flex items-center gap-3 py-4 hover:bg-raised " +
                  PANEL_X
                }
              >
                {/* THE ROW'S ONE SEVERITY MARK. There used to be three of them
                    per row — this dot, an accent bar in the same hue up the
                    left edge of the card, and a `Blocked` / `Attention` pill
                    beside the title — all encoding the identical fact. The
                    pills were deleted outright rather than restyled: a row
                    reading "4 kitchen tickets late" beside a pill reading
                    "Blocked" is a label captioning a sentence that already
                    said it. Red for blocked, muted neutral for attention; the
                    ORDER of the rows carries the rest, because rankSignals
                    puts every blocked row above every attention one. */}
                <span
                  aria-hidden
                  className={
                    "shrink-0 size-2 rounded-full " +
                    (s.severity === "blocked" ? "bg-red-500" : "bg-muted-foreground/70")
                  }
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block text-sm " +
                      // The contrast step that replaced the pill. A blocked row
                      // is set in full ink at semibold; an attention row is
                      // medium, like every other row title on the page. It is a
                      // smaller instrument than a hue and it is pointed at the
                      // same job.
                      (s.severity === "blocked"
                        ? "font-semibold text-foreground"
                        : "font-medium")
                    }
                  >
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {s.detail}
                  </span>
                </span>
                {/* The row's affordance, revealed rather than always-on: at
                    rest the action label is muted and sits still, and on hover
                    it comes up to full ink while the chevron leans 2px toward
                    where it is taking you. Two pixels is under the threshold
                    where it reads as the icon relocating and over the one where
                    nothing happened. Both changes are on the row's own hover,
                    so a keyboard user gets them from :focus-visible too — the
                    focus ring and the lit row arrive together. */}
                <span className="u-tx shrink-0 hidden sm:flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  {s.actionLabel}
                  <ChevronRight className={"u-arrow " + ICON_INLINE} />
                </span>
                <ChevronRight
                  className={
                    "u-arrow u-tx shrink-0 sm:hidden text-muted-foreground group-hover:text-foreground " +
                    ICON_INLINE
                  }
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {degraded.length > 0 && (
        // The whole point of the rail is that an empty one means "all clear".
        // If a check didn't run, say so here rather than let its silence read
        // as a pass. mt-auto pins it to the foot of the card so it reads as a
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
// 4 · Operational blocks
// ---------------------------------------------------------------------------

export type OpsStat = { value: string; label: string; muted?: boolean };

/** A number, a state, one action — one column of the operations band. */
export type OpsSection = {
  /** Stable key. Also what tells the skeleton how many columns to draw. */
  id: string;
  title: string;
  icon: React.ReactNode;
  stats: OpsStat[];
  state: string;
  /**
   * Two values, not three. There used to be a `good` tone, painted emerald,
   * and it carried lines like "Till open since 10:02 a.m." and "Everyone on
   * shift is clocked in cleanly" — which is good news, and good news is not
   * something you act on. It was a third of the page's colour spent saying
   * "nothing to see here" in the loudest available way, and it is what made
   * the genuinely amber and genuinely red things on the page look like more of
   * the same. Good news is neutral news now, and the only step left is between
   * routine and worth-noticing.
   */
  tone?: "neutral" | "attention";
  action?: { label: string; href: string } | null;
  failed?: boolean;
};

/**
 * Service, Menu & stock and Team as ONE panel divided by hairlines, not three
 * cards separated by canvas.
 *
 * They were always one system — same structure, same three rungs of type, same
 * "here is a number, here is what it means, here is where you fix it" — and
 * three identical objects sitting apart is a layout saying they are unrelated
 * when they aren't. Inside one panel with a rule between them, the eye reads
 * the band once instead of three times, and the page loses two card edges and
 * two shadows it was paying for and getting nothing from.
 *
 * Laid across at desktop rather than stacked, which is also what makes the
 * columns above balance: three sections stacked in the narrow rail is 530px of
 * height, and the same three across the full width is 176.
 *
 * flex-1 rather than a fixed column count, because the gates decide how many
 * sections exist — a business with no catalog module gets two, a bookkeeper
 * with neither gets one, and a three-column grid would leave a hole for both.
 * The vertical rhythm is guaranteed rather than agreed: every section is the
 * same PanelHeader + PanelBody as every other card on the page, and the action
 * link is pinned with mt-auto so all three land on one line however long the
 * state sentences run.
 */
export function OpsPanel({ sections }: { sections: OpsSection[] }) {
  if (sections.length === 0) return null;
  return (
    <Panel className="flex-col divide-y divide-line-soft lg:flex-row lg:divide-y-0 lg:divide-x">
      {sections.map((s) => (
        <div key={s.id} className="flex min-w-0 flex-1 flex-col">
          {/* Tertiary throughout. These three used to carry the same 15px
              semibold title as the hero and the rail, which is a band saying
              it is as important as the number the page is about. It isn't:
              it is the state of the room, and you read it after you have read
              how the day is going. */}
          <PanelHeader as="h3" size="sm" icon={s.icon} title={s.title} />
          <PanelBody size="sm" className="flex flex-1 flex-col">
            {s.failed ? (
              <p className="text-xs text-muted-foreground">
                Couldn&apos;t load this. The figures below would be wrong, so
                they aren&apos;t shown.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  {s.stats.map((st) => (
                    <div key={st.label}>
                      {/* 22, down from 26. It is the third rung of the page's
                          numeric ladder — 64 hero, 26 KPI band, 22 here — and
                          it used to be the joint-second, which is a tertiary
                          band shouting at the same volume as the summary
                          above it. */}
                      <div
                        className={
                          "text-[22px] font-bold tabular-nums tracking-[-0.02em] leading-none " +
                          (st.muted ? "text-muted-foreground" : "text-foreground")
                        }
                      >
                        {st.value}
                      </div>
                      {/* 11px sat below every competitor's floor, and 20-against-11
                          was not a step you could see. 24/12 is Toast's ratio, and
                          26/12 widens it a little further — the ladder between the
                          quietest and loudest type is most of what "considered"
                          means on a screen this dense. */}
                      <div className="text-xs text-muted-foreground mt-1.5">
                        {st.label}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Contrast, not hue. A state worth noticing is set in ink at
                    medium weight; a routine one sits in the same muted grey as
                    the stat labels above it. Against a card of muted 12px type
                    that step is perfectly loud — and it leaves the page's one
                    alert hue where it belongs, on the rail, which is also
                    where every one of these attention states is already
                    listed with somewhere to go and fix it. */}
                <p
                  className={
                    "mt-3.5 text-xs " +
                    (s.tone === "attention"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground")
                  }
                >
                  {s.state}
                </p>
              </>
            )}

            {s.action && (
              // `group` here rather than on the whole section: only the link is
              // a target, and warming a 400px-wide ops column because the
              // cursor crossed it would be the panel reacting to being passed
              // over rather than to being aimed at.
              <Link
                href={s.action.href}
                className="group u-tx u-focus mt-auto pt-3.5 inline-flex items-center gap-1 self-start text-xs font-medium hover:text-primary"
              >
                {s.action.label}
                <ChevronRight className={"u-arrow " + ICON_INLINE} />
              </Link>
            )}
          </PanelBody>
        </div>
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 5 · The check register
// ---------------------------------------------------------------------------

export type CheckRow = {
  id: string;
  /** "Check 12" / "Sale #431" — whatever the merchant would say out loud. */
  label: string;
  /** Time the check opened, or the sale settled. Pre-formatted for the tz. */
  time: string;
  /** "Dine-in", "Takeout", "Online" … or null when the order didn't say. */
  channel: string | null;
  /** Server name, when we have one. */
  who: string | null;
  /**
   * The state, and how loudly to say it.
   *
   * `quiet` is the boring majority — settled, paid, waiting on the guest — and
   * it is set in the same muted grey as the timestamp two columns left, which
   * is as close to invisible as a legible thing gets. `notable` is the handful
   * a person actually scans this table for: a refund, a partial refund, a check
   * that has been open past the late mark. Neither carries a hue.
   */
  status: { text: string; tone: "quiet" | "notable" };
  /**
   * Money, or an em dash where there honestly isn't any. Never a line count.
   *
   * It used to hold "9 lines" for open checks and "$84.20" for settled ones,
   * under one right-aligned "Amount" heading. Two different kinds of quantity
   * stacked in one column is a column that can't be scanned: the eye is trying
   * to compare figures and keeps landing on a word, the tabular-nums does
   * nothing for text, and the heading is a lie for half the rows. The line
   * count is a property of the check, so it moved down to the check's own
   * line, beside the guest count and the server — which is where a person
   * would say it out loud.
   */
  amount: string;
  /** "9 lines" — sits in the row's detail line, not in the money column. */
  lines: string | null;
  href: string;
  /** Open checks read as live money; settled ones are history. */
  open: boolean;
};

// The row tint went first. The status chip went second.
//
// The tint was three full-width washes — amber still moving, green finished,
// red money gone backwards — and the argument for it was that a sighted owner
// could find the refunds without reading. That argument was right about the
// goal and wrong about the material: eight rows of alternating pastel is the
// single cheapest-looking thing a table can do. It was replaced by a chip per
// row, on the reasoning that a chip is a smaller instrument pointed at the same
// job.
//
// It is smaller and it was still the wrong instrument. Eight rows produced
// eight outlined pills in four hues — green, green, green, red, amber, sky,
// red, green — and six of those eight said "Paid", which is the least
// interesting fact this table contains. A pill is a thing you draw around a
// word to say the word is important; drawn around the word that appears on
// three quarters of the rows, it says nothing at all, and it makes the tertiary
// band at the foot of the page the most colourful object on it.
//
// So the status column is text. The routine states sit in the muted grey the
// timestamps use and the eye skates over them, which is exactly what they
// deserve. The two or three rows an owner is actually looking for — a refund, a
// check open past the late mark — sit in ink at medium weight and are the only
// things in the column with any weight, so they are findable from a metre away
// without a single drop of colour being spent.

export function ChecksTable({
  rows,
  failed,
  title,
  note,
  itemHeading,
  href,
  hrefLabel,
}: {
  rows: CheckRow[];
  failed: boolean;
  title: string;
  /**
   * Three words at most. This used to carry a sentence explaining that the list
   * is live rather than scoped to the day above — true, and nobody was reading
   * a second line of prose to learn it.
   */
  note: string;
  /** What the wide middle column holds, in the merchant's own word. */
  itemHeading: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <Panel>
      {/* The note used to sit on the title's baseline as a second phrase, which
          made this the only header on the page with a one-line shape. It is a
          subtitle like every other card's subtitle now. */}
      {/* Tertiary. A register is a log — you look things up in it, it does not
          hail you — so it takes the quiet title and the tight body, and the
          full page width it was already given does the rest. */}
      <PanelHeader
        bordered
        size="sm"
        title={title}
        subtitle={note}
        trailing={
          // The arrow was a literal "→" in the label text — a character from
          // the body font, on the text baseline, at whatever weight the font
          // decided, and a different mark from the ChevronRight that ends
          // every other row on this page. It is the same glyph as the rest
          // now, and it leans on hover like the rest.
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
        <div
          className={
            "flex items-start gap-2 py-6 text-sm text-muted-foreground " + PANEL_X
          }
        >
          <AlertCircle className={"shrink-0 mt-0.5 " + ICON_INLINE} />
          <span>
            Couldn&apos;t load this list. It is a fault, not an empty
            register — try again, and check the server log if it persists.
          </span>
        </div>
      ) : rows.length === 0 ? (
        // No column header over an empty register: naming four columns that
        // hold nothing turns a written explanation into a broken-looking grid.
        //
        // py-12 rather than py-8 now that this panel runs the full width of the
        // page: a two-line message centred in a 1232px band needs vertical room
        // around it or it reads as a caption that lost its picture. The dashed
        // border and the tinted ground come off because the panel around it is
        // already a drawn object — a dashed box inside a solid one is two
        // borders saying the same thing.
        <EmptyState
          className="flex-1 border-0 rounded-none bg-transparent py-12"
          title="No sales on record yet"
          description="Every check you open and every sale you settle shows up here, newest first."
        />
      ) : (
        <>
          {/* An explicit header row. Every competitor's table names its
              columns; ours were a w-16 of times and a w-24 of money with
              nothing to say which was which. Status now carries a width too,
              so at full page width the chips form a column instead of drifting
              wherever the label above them happened to end. */}
          <div
            className={
              "flex items-center gap-3 py-2.5 border-b border-line-soft text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground " +
              PANEL_X
            }
          >
            <span className="w-16 shrink-0">Time</span>
            <span className="min-w-0 flex-1">{itemHeading}</span>
            {/* 28 rather than 36. The column held a pill with its own padding
                and ring; it now holds a word, and the width it was given for
                the pill would leave the words floating in a lane of their own. */}
            <span className="hidden sm:block w-28 shrink-0">Status</span>
            <span className="w-24 shrink-0 text-right">Amount</span>
          </div>
          <div className="divide-y divide-line-soft">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className={
                  "u-tx u-focus-inset flex items-center gap-3 py-3 hover:bg-raised " +
                  PANEL_X
                }
              >
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {r.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">
                    {r.label}
                  </span>
                  {/* Below sm the status chip is dropped for width, so on a
                      phone the status leads this line in words instead. That
                      was introduced to stop the row tint being the only thing
                      saying "refunded"; the tint is gone and the line stays,
                      because it was the better answer either way. */}
                  <span className="block text-xs text-muted-foreground truncate">
                    <span className="sm:hidden">{r.status.text} · </span>
                    {[r.channel, r.who, r.lines].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span
                  className={
                    "hidden sm:block w-28 shrink-0 text-xs " +
                    (r.status.tone === "notable"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground")
                  }
                >
                  {r.status.text}
                </span>
                <span
                  className={
                    "w-24 shrink-0 text-right text-sm font-semibold tabular-nums " +
                    (r.open ? "text-muted-foreground" : "")
                  }
                >
                  {r.amount}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
