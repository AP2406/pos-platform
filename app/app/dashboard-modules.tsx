// The admin home page's building blocks.
//
// Split out of pos-dashboard.tsx purely so that file can stay a readable
// description of *what the page asks the database* — the loader got long enough
// that the layout was hiding inside it. Every export here is a server component
// with no data access of its own: hand it numbers, it renders them.
//
// The one rule these all obey: colour never carries meaning alone. Every amber
// bar, red chip and green dot sits beside words that say the same thing, so the
// page still works for a colour-blind owner and in a sunlit dining room.

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
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
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
    <span className="tabular-nums">
      {main}
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
  /**
   * Which direction counts as good. Sales climbing is a win; refunds climbing
   * is not, and painting both green would make the colour decorative.
   */
  good: "up" | "down";
  /**
   * Withhold the verdict: the arrow points but the line stays grey. For gaps
   * inside the noise band, where a direction exists and a judgement doesn't.
   */
  neutral?: boolean;
};

/**
 * An arrow, a number, and what it's against.
 *
 * The arrow carries the direction and the colour carries the judgement, but the
 * words after it carry both — so this still reads correctly in greyscale, which
 * is the rule every other coloured thing on this page obeys.
 */
function Delta({ delta, size = "sm" }: { delta: KpiDelta; size?: "sm" | "md" }) {
  const verdict =
    delta.neutral || delta.direction === "flat"
      ? "flat"
      : delta.direction === delta.good
        ? "good"
        : "bad";
  // 600/400 rather than a flat 500: emerald-500 on a white card is a pale
  // green that reads as decorative, and red-500 on ink is a shout. This is the
  // one place on a KPI card that is allowed to be coloured at all, so it had
  // better be legible in both themes.
  const tone =
    verdict === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : verdict === "bad"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
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
      <span
        className={
          "inline-flex items-center gap-0.5 font-semibold whitespace-nowrap " + tone
        }
      >
        <Glyph className={(size === "md" ? "size-4" : "size-3.5") + " shrink-0"} />
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
 * Four small cards above the fold: the figures an owner would recite from
 * memory, each against the same weekday last week.
 *
 * This is not the seven-tile grid the page was rebuilt to get rid of. The
 * difference is the delta: a tile that says "$1,284" tells you nothing you can
 * act on, and one that says "$1,284, 8% behind last Tuesday" tells you whether
 * to worry. Everything without a comparison stayed downstairs in the ops blocks.
 */
export function KpiStrip({ items }: { items: Kpi[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <section
          key={k.id}
          className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-4 sm:p-5"
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
            <span
              aria-hidden
              className="shrink-0 text-muted-foreground/70 [&_svg]:size-[18px] [&_svg]:stroke-[1.5]"
            >
              {k.icon}
            </span>
          </div>
          <div className="mt-3 text-[26px] sm:text-[32px] font-bold tabular-nums tracking-[-0.02em] leading-none">
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
    <section className="rounded-xl bg-card ring-1 ring-amber-500/25 shadow-elevation overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        {/* Outlined rather than filled, same reasoning as Chip: the ring says
            "amber" as clearly as a wash of it and leaves the glyph legible. */}
        <span className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg ring-1 ring-inset ring-amber-500/35 text-amber-600 dark:text-amber-400 [&_svg]:size-4 [&_svg]:stroke-[1.5]">
          <Rocket />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {left} thing{left === 1 ? "" : "s"} left before you can take real
            payments
          </h2>
          {/* The count is the whole message. "Each one links to where you
              finish it" described the underline under the reader's cursor. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.requiredDone} of {report.requiredTotal} done
          </p>
        </div>
        <Link
          href="/app/go-live"
          className="shrink-0 text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
        >
          Full checklist
        </Link>
      </div>
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {report.outstanding.map((c) => (
          <li key={c.id}>
            <Link
              href={c.href}
              className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors"
            >
              <span className="shrink-0 size-1.5 rounded-full bg-amber-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">
                  {c.title}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {c.detail}
                </span>
              </span>
              <ChevronRight className="shrink-0 size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2 · Today, with pace
// ---------------------------------------------------------------------------

function PaceChip({ pace, weekday }: { pace: Pace; weekday: string }) {
  if (pace.status === "no-benchmark") {
    return (
      <Chip tone="neutral">No {weekday} to compare</Chip>
    );
  }
  const pct = Math.abs(Math.round(pace.deltaPct ?? 0));
  // dot={false} throughout: the arrow is already this chip's coloured mark, and
  // it says more than a dot can — a dot has a hue, an arrow has a direction.
  if (pace.status === "level") {
    return (
      <Chip tone="neutral" dot={false}>
        <Minus className="size-3 stroke-[2.5]" />
        Even with last {weekday}
      </Chip>
    );
  }
  if (pace.status === "ahead") {
    return (
      <Chip tone="success" dot={false}>
        <ArrowUpRight className="size-3 stroke-[2.5]" />
        {pct}% ahead of last {weekday}
      </Chip>
    );
  }
  return (
    <Chip tone="warning" dot={false}>
      <ArrowDownRight className="size-3 stroke-[2.5]" />
      {pct}% behind last {weekday}
    </Chip>
  );
}

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
            <span aria-hidden className="size-2 rounded-[2px] bg-chart-1" />
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
          <path
            d={line(curve.benchmark)}
            fill="none"
            className="stroke-muted-foreground/55"
            strokeWidth="1.25"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {curve.today.length > 0 && (
          <>
            <path
              d={line(curve.today) + " L " + todayEnd.toFixed(2) + " " + H + " L 0 " + H + " Z"}
              className="fill-chart-1/10"
              stroke="none"
            />
            <path
              d={line(curve.today)}
              fill="none"
              className="stroke-chart-1"
              strokeWidth="2"
              strokeLinejoin="round"
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
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-6 sm:p-7">
      {/* Two-line header zone — title, then what the number is net of. Square
          and Lightspeed both carry a subtitle here; we carried none anywhere. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Sales {scope}
          </h2>
          {/* The sale count moved to the KPI strip, so this line is down to the
              one thing the big number can't say for itself: what it is net of. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Net of refunds · training excluded
          </p>
        </div>
        <div className="shrink-0">
          {failed ? (
            <Chip tone="danger">Comparison unavailable</Chip>
          ) : (
            <PaceChip pace={pace} weekday={weekday} />
          )}
        </div>
      </div>

      {/* -0.02em rather than the default: at 48px, tracking set for body copy
          leaves lakes of air between digits and the figure stops reading as one
          object. This is the loudest thing on the page and it should look
          drawn, not typed. */}
      <div className="mt-3.5 text-4xl sm:text-5xl font-bold tracking-[-0.02em] leading-none">
        <HeroMoney amount={pace.today} currency={currency} />
      </div>

      {/* The percentage is for comparing; the dollar figure is what an owner
          feels. The chip above already carries the percent, so this carries the
          money — as an arrow and a figure rather than the sentence it used to
          be, because "$412.80 ahead of last Wednesday at 2:15 p.m." is a
          caption an owner reads once and never again. */}
      {!failed && hasBenchmark && (
        <div className="mt-2">
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
              good: "up",
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
    </section>
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
}: {
  bars: DayBar[];
  /** Takings across the whole window. */
  total: number;
  /** Last seven days against the seven before them. Null when either is empty. */
  trend: KpiDelta | null;
  currency: string;
  failed: boolean;
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
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Sales by day</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
        </div>
        {!failed && (
          <div className="shrink-0 text-right">
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
        )}
      </div>

      {failed ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Couldn&apos;t load the last fortnight. The bars are missing because the
          query failed, not because the days were empty.
        </p>
      ) : ceiling <= 0 ? (
        // Fourteen empty tracks is a picture of nothing, and drawing it would
        // imply we measured fourteen zeroes rather than found no sales at all.
        <p className="mt-4 text-sm text-muted-foreground">
          No sales in the last 14 days. Each day you trade adds a bar here, so
          the shape of your week builds itself.
        </p>
      ) : (
        <>
          <figure className="mt-4">
            <figcaption className="flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>Daily takings</span>
              <span className="tabular-nums">{moneyRound(ceiling, currency)}</span>
            </figcaption>
            <svg
              viewBox={"0 0 " + W + " " + H}
              preserveAspectRatio="none"
              className="mt-1.5 w-full h-[132px]"
              role="img"
              aria-label={
                "Daily takings for the last 14 days. " +
                bars.map((b) => b.full + ": " + money(b.amount, currency)).join(", ")
              }
            >
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
                      className="fill-foreground/[0.045]"
                    />
                    {/* One hue, two rungs of it. The scoped day — the one the
                        hero figure above is talking about — at full strength;
                        the other thirteen stepped well down, because their job
                        is to be the shape this day sits in rather than to
                        compete with it. Two thirds of a hue was not enough of a
                        step: the current bar didn't read as the current bar. */}
                    {drawn > 0 && (
                      <rect
                        x={x}
                        y={H - drawn}
                        width={barW}
                        height={drawn}
                        rx={radius}
                        className={b.current ? "fill-ramp-1" : "fill-ramp-1/40"}
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
    </section>
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
}: {
  slices: PaymentSlice[];
  total: number;
  currency: string;
  failed: boolean;
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
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Payment mix</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
        </div>
      </div>

      {failed ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Couldn&apos;t load the payment mix. It is a fault, not an all-cash
          fortnight.
        </p>
      ) : total <= 0 || slices.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing settled in the last 14 days, so there is no mix to split.
          Cash, card and gift cards each get a slice once sales start landing.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-4">
          <div className="relative shrink-0 w-[132px] h-[132px]">
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
              {arcs.map((a) => (
                <circle
                  key={a.slice.key}
                  cx="66"
                  cy="66"
                  r={RING_R}
                  fill="none"
                  className={RAMP_STROKE[a.slice.hue] ?? RAMP_STROKE[6]}
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

          {/* 190px is the width at which "Store credit" and its figure both fit
              unabbreviated. Below that the legend drops under the ring rather
              than truncating — a legend reading "Deli… 9%" labels nothing. */}
          <ul className="min-w-[190px] flex-1 space-y-2">
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
                <span className="shrink-0 tabular-nums font-semibold text-foreground">
                  {s.pct}%
                </span>
                <span className="shrink-0 w-[68px] text-right tabular-nums text-muted-foreground">
                  {moneyRound(s.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
    <section
      className={
        "relative rounded-xl bg-card shadow-elevation overflow-hidden ring-1 " +
        (worst === "clear" ? "ring-line" : "ring-line-strong")
      }
    >
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-0 w-[3px] " +
          (worst === "blocked"
            ? "bg-red-500"
            : worst === "attention"
              ? "bg-amber-500"
              : "bg-line-strong")
        }
      />
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line-soft">
        {/* No subtitle. "Everything blocking service or costing money, as of
            right now" restated the heading at four times the length, and the
            rows underneath already say what each thing is. The empty state
            below still gets its sentences — that is when explanation earns
            its place. */}
        <h2 className="text-[15px] font-semibold tracking-tight">Needs you now</h2>
        {signals.length > 0 && (
          <Chip
            tone={worst === "blocked" ? "danger" : "warning"}
            className="shrink-0 tabular-nums"
          >
            {signals.length} open
          </Chip>
        )}
      </div>

      {signals.length === 0 ? (
        // "Nothing to do" is a result, not an empty state — it deserves a
        // confident line rather than the dashed placeholder box that means
        // "you haven't set this up yet".
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ring-1 ring-inset ring-emerald-500/35 text-emerald-600 dark:text-emerald-400 [&_svg]:size-4 [&_svg]:stroke-[1.5]">
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
                className="flex items-center gap-3 px-5 py-4 hover:bg-surface-2 transition-colors"
              >
                <span
                  aria-hidden
                  className={
                    "shrink-0 size-2 rounded-full " +
                    (s.severity === "blocked" ? "bg-red-500" : "bg-amber-500")
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{s.title}</span>
                    {/* The dot above is decoration; this word is the signal. */}
                    <Chip tone={s.severity === "blocked" ? "danger" : "warning"}>
                      {s.severity === "blocked" ? "Blocked" : "Attention"}
                    </Chip>
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {s.detail}
                  </span>
                </span>
                <span className="shrink-0 hidden sm:flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {s.actionLabel}
                  <ChevronRight className="size-3.5" />
                </span>
                <ChevronRight className="shrink-0 sm:hidden size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {degraded.length > 0 && (
        // The whole point of the rail is that an empty one means "all clear".
        // If a check didn't run, say so here rather than let its silence read
        // as a pass.
        <div className="flex items-start gap-2 px-5 py-3 border-t border-line-soft bg-surface-2 text-xs text-muted-foreground">
          <AlertCircle className="shrink-0 size-3.5 mt-px" />
          <span>
            Couldn&apos;t check {degraded.join(", ")}. Those may be hiding
            something — this list is incomplete.
          </span>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4 · Operational blocks
// ---------------------------------------------------------------------------

export type OpsStat = { value: string; label: string; muted?: boolean };

/**
 * A number, a state, one action. Deliberately not a KPI tile: the `state` line
 * is the point, and it is a sentence, not a delta.
 */
export function OpsBlock({
  title,
  icon,
  stats,
  state,
  tone = "neutral",
  action,
  failed,
}: {
  title: string;
  icon: React.ReactNode;
  stats: OpsStat[];
  state: string;
  tone?: "neutral" | "good" | "attention";
  action?: { label: string; href: string } | null;
  failed?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-xl bg-card ring-1 ring-line shadow-elevation p-5">
      <div className="flex items-center gap-2.5">
        {/* The well here was already neutral (bg-muted), which is the shape the
            KPI cards should have had all along — but at this size even a
            neutral box is one more rectangle in a column of rectangles, and the
            glyph carries the block on its own. */}
        <span className="shrink-0 text-muted-foreground/70 [&_svg]:size-4 [&_svg]:stroke-[1.5]">
          {icon}
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {title}
        </h3>
      </div>

      {failed ? (
        <p className="mt-3 flex-1 text-xs text-muted-foreground">
          Couldn&apos;t load this. The figures below would be wrong, so they
          aren&apos;t shown.
        </p>
      ) : (
        <>
          <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {stats.map((s) => (
              <div key={s.label}>
                <div
                  className={
                    "text-[26px] font-bold tabular-nums tracking-[-0.02em] leading-none " +
                    (s.muted ? "text-muted-foreground" : "text-foreground")
                  }
                >
                  {s.value}
                </div>
                {/* 11px sat below every competitor's floor, and 20-against-11
                    was not a step you could see. 24/12 is Toast's ratio, and
                    26/12 widens it a little further — the ladder between the
                    quietest and loudest type is most of what "considered"
                    means on a screen this dense. */}
                <div className="text-xs text-muted-foreground mt-1.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <p
            className={
              "mt-3.5 flex-1 text-xs " +
              (tone === "attention"
                ? "text-amber-600 dark:text-amber-400"
                : tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground")
            }
          >
            {state}
          </p>
        </>
      )}

      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          {action.label}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </section>
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
  status: { text: string; tone: "neutral" | "info" | "success" | "warning" | "danger" };
  amount: string;
  href: string;
  /** Open checks read as live money; settled ones are history. */
  open: boolean;
};

// The row tint is gone.
//
// It was three full-width washes — amber still moving, green finished, red
// money gone backwards — and the argument for it was that a sighted owner could
// find the refunds without reading. That argument was right about the goal and
// wrong about the material. Eight rows of alternating pastel is the single
// cheapest-looking thing a table can do: the colour stops being a signal and
// becomes upholstery, the card stops reading as one white object, and the
// figures in the amount column end up sitting on four different backgrounds.
//
// The status chip beside each row already carries the state, in a hue, in
// words, with a saturated dot — which is a smaller and more precise instrument
// pointed at exactly the same job. So the rows go back to the card surface,
// separated by hairlines, and the chip does the work alone.

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
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line-soft">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-2.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <span className="text-xs text-muted-foreground">{note}</span>
        </div>
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {hrefLabel} →
        </Link>
      </div>

      {failed ? (
        <div className="flex items-start gap-2 px-5 py-6 text-sm text-muted-foreground">
          <AlertCircle className="shrink-0 size-4 mt-0.5" />
          <span>
            Couldn&apos;t load this list. It is a fault, not an empty
            register — try again, and check the server log if it persists.
          </span>
        </div>
      ) : rows.length === 0 ? (
        // No column header over an empty register: naming four columns that
        // hold nothing turns a written explanation into a broken-looking grid.
        <EmptyState
          className="border-0 rounded-none bg-transparent py-8"
          title="No sales on record yet"
          description="Every check you open and every sale you settle shows up here, newest first."
        />
      ) : (
        <>
          {/* An explicit header row, on the raised rung of the ladder. Every
              competitor's table names its columns; ours were a w-16 of times
              and a w-24 of money with nothing to say which was which. The
              status cell carries no width because the amount column beside it
              is fixed — both right edges land in the same place regardless of
              how long a status reads. */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-line-soft text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            <span className="w-16 shrink-0">Time</span>
            <span className="min-w-0 flex-1">{itemHeading}</span>
            <span className="shrink-0 hidden sm:block">Status</span>
            <span className="w-24 shrink-0 text-right">Amount</span>
          </div>
          <div className="divide-y divide-line-soft">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
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
                    {[r.channel, r.who].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="shrink-0 hidden sm:flex justify-end">
                  <Chip tone={r.status.tone}>{r.status.text}</Chip>
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
    </section>
  );
}
