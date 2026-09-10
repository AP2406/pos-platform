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
import type { AttentionSignal, Pace } from "@/lib/services/dashboard-signals";
import type { ReadinessReport } from "@/lib/services/launch-readiness";

export function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
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
          <h2 className="text-sm font-semibold tracking-tight">
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

export function TodayModule({
  pace,
  saleCount,
  currency,
  weekday,
  benchmarkTimeLabel,
  lastSaleLabel,
  everSold,
  failed,
}: {
  pace: Pace;
  saleCount: number;
  currency: string;
  /** "Wednesday" — the weekday being compared against. */
  weekday: string;
  /** Local clock time the benchmark was truncated at, e.g. "2:15 PM". */
  benchmarkTimeLabel: string;
  /** Human date of the most recent sale on record, or null if there is none. */
  lastSaleLabel: string | null;
  everSold: boolean;
  /** True when the comparison query failed — never dress that up as a flat week. */
  failed: boolean;
}) {
  // Scale the track to whichever is larger so a record-breaking day doesn't
  // render as a bar that overflows its own container.
  const ceiling = Math.max(pace.benchmarkFull, pace.today, 1);
  const fillPct = Math.min(100, (pace.today / ceiling) * 100);
  const tickPct = Math.min(100, (pace.benchmarkSoFar / ceiling) * 100);
  const showBar = pace.status !== "no-benchmark";

  return (
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted-foreground">
            Sales today
          </div>
          <div className="mt-2 text-4xl sm:text-5xl font-bold tabular-nums tracking-tight leading-none">
            {money(pace.today, currency)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {saleCount} sale{saleCount === 1 ? "" : "s"} · net of refunds,
            training excluded
          </div>
        </div>
        <div className="shrink-0">
          {failed ? (
            <Chip tone="danger">Comparison unavailable</Chip>
          ) : (
            <PaceChip pace={pace} weekday={weekday} />
          )}
        </div>
      </div>

      {showBar && !failed && (
        <div className="mt-6">
          <div className="relative">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={
                  "h-full rounded-full " +
                  (pace.status === "behind" ? "bg-amber-500" : "bg-primary")
                }
                style={{ width: fillPct + "%" }}
              />
            </div>
            {/* Where last week stood at this exact time — the only honest
                "am I on track" marker, since half a day can't be compared to
                a whole one. */}
            <span
              aria-hidden
              className="absolute -top-1 h-4 w-px bg-foreground/50"
              style={{ left: tickPct + "%" }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Last {weekday} by {benchmarkTimeLabel}:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {money(pace.benchmarkSoFar, currency)}
              </span>
            </span>
            <span>
              Full day:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {money(pace.benchmarkFull, currency)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* The case that actually ships: nothing today, and nothing to hold it
          against. Say which kind of quiet this is — a first day, a slow
          morning, or a business that stopped ringing sales weeks ago. */}
      {!showBar && !failed && (
        <p className="mt-5 text-sm text-muted-foreground">
          {!everSold ? (
            <>
              No sales recorded yet. Your first one lands here the moment it&apos;s
              rung up.
            </>
          ) : lastSaleLabel ? (
            <>
              Nothing yet today, and last {weekday} was quiet too — so there is
              nothing to pace against. Your most recent sale was{" "}
              <span className="font-medium text-foreground">{lastSaleLabel}</span>.
            </>
          ) : (
            <>Nothing yet today, and last {weekday} was quiet too.</>
          )}
        </p>
      )}

      {failed && (
        <p className="mt-5 text-sm text-muted-foreground">
          Today&apos;s total is correct. Last {weekday}&apos;s figures
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
  return (
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
        <h2 className="text-sm font-semibold tracking-tight">Needs you now</h2>
        {signals.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {signals.length} open
          </span>
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
                    "text-xl font-bold tabular-nums tracking-tight leading-none " +
                    (s.muted ? "text-muted-foreground" : "text-foreground")
                  }
                >
                  {s.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
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
  href,
  hrefLabel,
}: {
  rows: CheckRow[];
  failed: boolean;
  title: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <section className="rounded-xl bg-card ring-1 ring-line shadow-elevation overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link
          href={href}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {hrefLabel} →
        </Link>
      </div>

      {failed ? (
        <div className="flex items-start gap-2 px-4 py-6 text-sm text-muted-foreground">
          <AlertCircle className="shrink-0 size-4 mt-0.5" />
          <span>
            Couldn&apos;t load this list. It is a fault, not an empty
            register — try again, and check the server log if it persists.
          </span>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="border-0 rounded-none bg-transparent py-8"
          title="No sales on record yet"
          description="Every check you open and every sale you settle shows up here, newest first."
        />
      ) : (
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
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
              <span className="shrink-0 hidden sm:block">
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
      )}
    </section>
  );
}
