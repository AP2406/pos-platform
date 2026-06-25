"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { isAiConfigured, generateJson } from "@/lib/services/ai";
import { schemaPrompt, validateSpec, runAnalytics, type AnalyticsResult } from "@/lib/services/ai-analytics";

export type AskAnswer = {
  ok: true;
  answer: string;
  metricLabel: string;
  isMoney: boolean;
  dimension: string;
  scalar: number | null;
  rows: { label: string; value: number }[];
  periodLabel: string;
  csv: string;
};

const fmt = (v: number, money: boolean) => (money ? "$" + (Math.round(v * 100) / 100).toFixed(2) : String(Math.round(v * 100) / 100));

function periodLabel(start: string, end: string): string {
  if (start === end) return "on " + start;
  return start + " to " + end;
}

function buildAnswer(r: AnalyticsResult): string {
  const period = periodLabel(r.spec.start, r.spec.end);
  const filt = (r.spec.daypart ? " (" + r.spec.daypart + ")" : "") + (r.spec.channel ? " · " + r.spec.channel : "");
  if (r.dimension === "none") {
    return r.metricLabel + " " + period + filt + ": " + fmt(r.scalar ?? 0, r.isMoney) + ".";
  }
  if (r.rows.length === 0) return "No data for " + period + filt + ".";
  const top = r.rows[0];
  const lead = r.spec.sort === "asc" ? "Lowest" : "Top";
  return lead + " " + r.dimension + " by " + r.metricLabel.toLowerCase() + " " + period + filt + ": " +
    top.label + " (" + fmt(top.value, r.isMoney) + ")" + (r.rows.length > 1 ? ", then " + r.rows[1].label + " (" + fmt(r.rows[1].value, r.isMoney) + ")" : "") + ".";
}

function toCsv(r: AnalyticsResult): string {
  if (r.dimension === "none") return r.metricLabel + "\n" + (r.scalar ?? 0);
  const head = (r.dimension === "channel" || r.dimension === "daypart" || r.dimension === "weekday" ? r.dimension : r.dimension) + "," + r.metricLabel;
  const lines = r.rows.map((row) => '"' + row.label.replace(/"/g, '""') + '",' + row.value);
  return [head, ...lines].join("\n");
}

// GAP-2.1: answer a plain-English analytics question. The LLM only produces a
// whitelisted query spec; all numbers come from the business's own data.
export async function askInsights(question: string): Promise<AskAnswer | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can use this." };
  if (!hasFloorService(business)) return { error: "Not available for this business." };
  if (!isAiConfigured()) return { error: "AI isn't configured. Add GEMINI_API_KEY to enable Ask." };
  const q = (question || "").trim().slice(0, 400);
  if (q.length < 3) return { error: "Ask a question about your sales." };

  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  let raw: unknown;
  try {
    raw = await generateJson(schemaPrompt(todayISO, tz) + "\n\nQuestion: " + q);
  } catch (e) {
    console.error("askInsights generate:", e);
    return { error: "The AI couldn't process that. Please try rephrasing." };
  }
  const spec = validateSpec(raw);
  if (!spec) return { error: "I couldn't turn that into a query. Try e.g. “top items last Friday dinner”." };

  const supabase = await createClient();
  let result: AnalyticsResult;
  try {
    result = await runAnalytics(supabase, business.id, tz, spec);
  } catch (e) {
    console.error("askInsights run:", e);
    return { error: "Could not run that query." };
  }

  return {
    ok: true,
    answer: buildAnswer(result),
    metricLabel: result.metricLabel,
    isMoney: result.isMoney,
    dimension: result.dimension,
    scalar: result.scalar,
    rows: result.rows,
    periodLabel: periodLabel(spec.start, spec.end),
    csv: toCsv(result),
  };
}
