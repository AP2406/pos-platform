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
import type { AttentionSignal, Pace } from "@/lib/services/dashboard-signals";
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
        <span className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 [&_svg]:size-4">
          <Rocket />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {left} thing{left === 1 ? "" : "s"} left before you can take real
            payments
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.requiredDone} of {report.requiredTotal} done. Each one links
            to where you finish it.
          </p>
        </div>
        <Link
          href="/app/go-live"
          className="shrink-0 text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
        >
          Full checklist
        </Link>
      </div>
      <ul className="divide-y divide-line border-t border-line">
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
  if (pace.status === "level") {
    return (
      <Chip tone="neutral">
        <Minus className="size-3" />
        Even with last {weekday}
      </Chip>
    );
  }
  if (pace.status === "ahead") {
    return (
      <Chip tone="success">
        <ArrowUpRight className="size-3" />
        {pct}% ahead of last {weekday}
      </Chip>
    );
  }
  return (
    <Chip tone="warning">
      <ArrowDownRight className="size-3" />
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
        {/* The swatches are decoration; the words beside them are the legend. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px] bg-chart-1" />
            {scopeWord}
          </span>
          {curve.benchmark.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px] bg-chart-2" />
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
        <line x1="0" y1="0" x2={W} y2="0" className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={H} x2={W} y2={H} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {curve.benchmark.length > 0 && (
          <path
            d={line(curve.benchmark)}
            fill="none"
            className="stroke-chart-2"
            strokeWidth="1.5"
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
  saleCount,
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
  saleCount: number;
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
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-5 sm:p-6">
      {/* Two-line header zone — title, then what the number is net of. Square
          and Lightspeed both carry a subtitle here; we carried none anywhere. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Sales {scope}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {saleCount} sale{saleCount === 1 ? "" : "s"} · net of refunds,
            training excluded
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

      <div className="mt-3 text-4xl sm:text-5xl font-bold tabular-nums tracking-tight leading-none">
        {money(pace.today, currency)}
      </div>

      {/* The percentage is for comparing; the dollar figure is what an owner
          feels. They convert one into the other in their head anyway. */}
      {!failed && hasBenchmark && (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {pace.status === "level" ? "Within " : null}
          <span className="font-medium tabular-nums text-foreground">
            {money(deltaAbs, currency)}
          </span>
          {pace.status === "level"
            ? " of last "
            : pace.status === "ahead"
              ? " ahead of last "
              : " behind last "}
          {weekday}
          {benchmarkTimeLabel ? " at " + benchmarkTimeLabel : ""}.
        </p>
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
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-line">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Needs you now</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everything blocking service or costing money, as of right now.
          </p>
        </div>
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
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 [&_svg]:size-4">
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
        <ul className="divide-y divide-line">
          {signals.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors"
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
        <div className="flex items-start gap-2 px-5 py-3 border-t border-line bg-surface-2 text-xs text-muted-foreground">
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
    <section className="flex flex-col rounded-xl bg-card ring-1 ring-line shadow-elevation p-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      </div>

      {failed ? (
        <p className="mt-3 flex-1 text-xs text-muted-foreground">
          Couldn&apos;t load this. The figures below would be wrong, so they
          aren&apos;t shown.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {stats.map((s) => (
              <div key={s.label}>
                <div
                  className={
                    "text-2xl font-bold tabular-nums tracking-tight leading-none " +
                    (s.muted ? "text-muted-foreground" : "text-foreground")
                  }
                >
                  {s.value}
                </div>
                {/* 11px sat below every competitor's floor, and 20-against-11
                    was not a step you could see. 24/12 is Toast's ratio. */}
                <div className="text-xs text-muted-foreground mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <p
            className={
              "mt-3 flex-1 text-xs " +
              (tone === "attention"
                ? "text-amber-500"
                : tone === "good"
                  ? "text-emerald-500"
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

export function ChecksTable({
  rows,
  failed,
  title,
  subtitle,
  itemHeading,
  href,
  hrefLabel,
}: {
  rows: CheckRow[];
  failed: boolean;
  title: string;
  /** The second line of the header zone — what this list is and isn't. */
  subtitle: string;
  /** What the wide middle column holds, in the merchant's own word. */
  itemHeading: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-line">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
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
          <div className="flex items-center gap-3 px-5 py-2 bg-raised border-b border-line text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="w-16 shrink-0">Time</span>
            <span className="min-w-0 flex-1">{itemHeading}</span>
            <span className="shrink-0 hidden sm:block">Status</span>
            <span className="w-24 shrink-0 text-right">Amount</span>
          </div>
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {r.time}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">
                    {r.label}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
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
