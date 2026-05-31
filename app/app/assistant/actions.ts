"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import {
  getTodayBoundsUTC,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
} from "@/lib/utils/dates";

type ChatMessage = { role: "user" | "assistant"; text: string };

export type ProposedAction = {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
};

export type AssistantResult =
  | { kind: "answer"; text: string }
  | { kind: "action"; text: string; action: ProposedAction }
  | { kind: "error"; text: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}
function cname(c: unknown): string {
  if (!c) return "One-off";
  if (Array.isArray(c)) return (c[0] as { name?: string })?.name ?? "One-off";
  return (c as { name?: string })?.name ?? "One-off";
}
function pname(p: unknown): string {
  if (!p) return "";
  if (Array.isArray(p)) return (p[0] as { name?: string })?.name ?? "";
  return (p as { name?: string })?.name ?? "";
}
function bizRev(t: Row): number {
  return t.handled_by === "partner" ? num(t.cookie_amount) : num(t.price_total);
}
function fmt(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function runReadTool(
  name: string,
  args: Row,
  ctx: { supabase: Row; tz: string; business: Row }
): Promise<unknown> {
  const { supabase, tz, business } = ctx;

  if (name === "search_trips") {
    const scope = args.scope ?? "recent";
    let q = supabase
      .from("trips")
      .select("id, scheduled_at, price_total, cookie_amount, trip_status, handled_by, payment_collected, driver_id, is_lead, customer:customers(name), partner:partners(name)");
    const nowIso = new Date().toISOString();
    if (scope === "today") {
      const { start, end } = getTodayBoundsUTC(tz);
      q = q
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString())
        .order("scheduled_at", { ascending: true });
    } else if (scope === "upcoming") {
      q = q
        .gte("scheduled_at", nowIso)
        .not("trip_status", "in", "(cancelled,no_show,lost)")
        .order("scheduled_at", { ascending: true });
    } else if (scope === "unpaid") {
      q = q
        .eq("handled_by", "self")
        .eq("payment_collected", false)
        .not("trip_status", "in", "(cancelled,no_show,lost)")
        .order("scheduled_at", { ascending: false });
    } else {
      q = q.order("scheduled_at", { ascending: false });
    }
    if (args.status) q = q.eq("trip_status", args.status);
    q = q.limit(Math.min(Number(args.limit) || 15, 30));
    const { data } = await q;
    let rows: Row[] = data ?? [];
    if (args.customer) {
      const needle = String(args.customer).toLowerCase();
      rows = rows.filter((t) =>
        cname(t.customer).toLowerCase().includes(needle)
      );
    }
    return rows.map((t) => ({
      id: t.id,
      when: fmt(t.scheduled_at, tz),
      customer: cname(t.customer),
      status: t.trip_status,
      amount: bizRev(t),
      paid: t.payment_collected,
      handled_by: t.handled_by,
      driver_id: t.driver_id,
      is_lead: t.is_lead,
      partner: pname(t.partner) || undefined,
    }));
  }

  if (name === "get_trip") {
    const { data } = await supabase
      .from("trips")
      .select("*, customer:customers(id,name,email,phone), vehicle:vehicles(id,name), partner:partners(id,name)")
      .eq("id", args.trip_id)
      .maybeSingle();
    if (!data) return { error: "not found" };
    return {
      id: data.id,
      when: data.scheduled_at ? fmt(data.scheduled_at, tz) : null,
      customer: cname(data.customer),
      pickup: data.pickup_address,
      dropoff: data.dropoff_address,
      price_total: num(data.price_total),
      status: data.trip_status,
      paid: data.payment_collected,
      handled_by: data.handled_by,
      partner: pname(data.partner) || undefined,
      cookie_amount: data.cookie_amount != null ? num(data.cookie_amount) : undefined,
      driver_id: data.driver_id,
      vehicle: (data.vehicle as Row)?.name,
      passengers: data.passenger_count,
      luggage: data.luggage_count,
      flight: data.flight_number,
      terminal: data.terminal,
      notes: data.notes,
    };
  }

  if (name === "search_customers") {
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .order("name")
      .limit(200);
    let rows: Row[] = data ?? [];
    if (args.query) {
      const n = String(args.query).toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(n) ||
          (c.email || "").toLowerCase().includes(n) ||
          (c.phone || "").toLowerCase().includes(n)
      );
    }
    return rows.slice(0, Number(args.limit) || 15);
  }

  if (name === "search_vehicles") {
    const { data } = await supabase
      .from("vehicles")
      .select("id, name, is_active")
      .order("name");
    return data ?? [];
  }

  if (name === "search_partners") {
    const { data } = await supabase
      .from("partners")
      .select("id, name, default_cookie_percent, default_cookie_flat")
      .order("name");
    return data ?? [];
  }

  if (name === "search_drivers") {
    if (business.drivers_enabled === false)
      return { note: "Drivers feature is turned off." };
    const { data } = await supabase
      .from("drivers")
      .select("id, name, status")
      .order("name");
    return data ?? [];
  }

  if (name === "revenue") {
    const period = args.period ?? "month";
    let start: Date, end: Date;
    if (period === "today") ({ start, end } = getTodayBoundsUTC(tz));
    else if (period === "week") ({ start, end } = getWeekBoundsUTC(tz));
    else ({ start, end } = getMonthBoundsUTC(tz));
    const { data } = await supabase
      .from("trips")
      .select("price_total, cookie_amount, handled_by")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .eq("trip_status", "completed");
    const rows: Row[] = data ?? [];
    return {
      period,
      completedTrips: rows.length,
      earnings: rows.reduce((s, t) => s + bizRev(t), 0),
    };
  }

  return { error: "Unknown tool: " + name };
}

const CATALOG =
  "READ tools (run automatically; chain as many as needed):\n" +
  "- search_trips(scope?: today|upcoming|unpaid|recent, customer?, status?, limit?)\n" +
  "- get_trip(trip_id)\n" +
  "- search_customers(query?, limit?)\n" +
  "- search_vehicles()\n" +
  "- search_partners()\n" +
  "- search_drivers()\n" +
  "- revenue(period: today|week|month)\n\n" +
  "WRITE tools (NEVER run automatically — propose for confirmation):\n" +
  "- mark_paid(trip_id) / mark_unpaid(trip_id)\n" +
  "- set_status(trip_id, status: new_lead|confirmed|decision_making|completed|lost)\n" +
  "- assign_driver(trip_id, driver_id)   (driver_id null = unassign)\n" +
  "- create_customer(name, email?, phone?)";

export async function askAssistant(
  question: string,
  history: ChatMessage[]
): Promise<AssistantResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { kind: "error", text: "AI isn't configured yet (missing GEMINI_API_KEY)." };
  }
  if (!question.trim()) {
    return { kind: "error", text: "Ask me something first." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const currency = business.currency || "CAD";

  const todayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const histText = history
    .slice(-6)
    .map((m) => (m.role === "user" ? "User: " : "Assistant: ") + m.text)
    .join("\n");

  const sys =
    "You are the assistant inside Surge, the POS/CRM for " +
    business.name +
    " (" +
    business.industry +
    "). Today is " +
    todayStr +
    ". Money is in " +
    currency +
    ".\n\n" +
    "You work in steps. Each step, respond with ONLY one JSON object (no markdown):\n" +
    '{ "action": "tool" | "final" | "confirm", "tool": "<read tool>", "args": {}, "answer": "<reply when final>", "write": { "tool": "<write tool>", "args": {}, "summary": "<short yes/no confirmation describing exactly what will change>" } }\n\n' +
    "Rules:\n" +
    "- To answer, call read tools (action=tool) until you have the facts, then action=final with your answer. Do any math yourself.\n" +
    "- Use action=confirm ONLY when the user clearly asks to change/create something. First resolve ids with read tools (find the trip/customer). The summary must name the specific record and the exact change.\n" +
    "- Never invent ids, names, or numbers. If unsure what they mean, action=final asking them to clarify.\n" +
    "- Be concise. Format money like $1,234.50.\n\n" +
    "TOOLS:\n" +
    CATALOG;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let scratchpad = "";

  for (let step = 0; step < 5; step++) {
    const prompt =
      sys +
      "\n\nConversation:\n" +
      histText +
      "\nUser: " +
      question +
      "\n" +
      (scratchpad ? "\nObservations:" + scratchpad + "\n" : "") +
      "\nRespond with your next JSON step now.";

    let raw = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      raw =
        response.text ??
        response.candidates?.[0]?.content?.parts?.[0]?.text ??
        "";
    } catch (e) {
      console.error("askAssistant gemini:", e);
      return { kind: "error", text: "I couldn't reach the AI. Try again." };
    }

    let parsed: Row;
    try {
      const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return { kind: "error", text: "I got a bit tangled up. Try rephrasing?" };
    }

    if (parsed.action === "final") {
      return {
        kind: "answer",
        text: String(parsed.answer ?? "").trim() || "Done.",
      };
    }
    if (parsed.action === "confirm" && parsed.write && parsed.write.tool) {
      return {
        kind: "action",
        text: String(parsed.write.summary ?? "Confirm this action?"),
        action: {
          tool: String(parsed.write.tool),
          args: (parsed.write.args ?? {}) as Record<string, unknown>,
          summary: String(parsed.write.summary ?? ""),
        },
      };
    }
    if (parsed.action === "tool" && parsed.tool) {
      const obs = await runReadTool(String(parsed.tool), parsed.args ?? {}, {
        supabase,
        tz,
        business,
      });
      scratchpad +=
        "\n- " +
        parsed.tool +
        "(" +
        JSON.stringify(parsed.args ?? {}) +
        ") => " +
        JSON.stringify(obs);
      continue;
    }
    return { kind: "error", text: "I wasn't sure how to handle that. Try rephrasing?" };
  }

  return {
    kind: "answer",
    text: "That needed too many steps — try asking it more directly.",
  };
}

export async function runAssistantAction(
  action: ProposedAction
): Promise<{ ok: true; message: string } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tool = action?.tool;
  const a = (action?.args ?? {}) as Row;

  if (tool === "mark_paid" || tool === "mark_unpaid") {
    if (!a.trip_id) return { error: "No trip specified." };
    const collected = tool === "mark_paid";
    const { data, error } = await supabase
      .from("trips")
      .update({ payment_collected: collected })
      .eq("id", a.trip_id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Couldn't update that trip." };
    revalidatePath("/app/trips/" + a.trip_id);
    revalidatePath("/app/trips");
    revalidatePath("/app");
    return { ok: true, message: collected ? "Marked as paid." : "Marked as unpaid." };
  }

  if (tool === "set_status") {
    if (!a.trip_id) return { error: "No trip specified." };
    const allowed = ["new_lead", "confirmed", "decision_making", "completed", "lost"];
    const status = String(a.status ?? "");
    if (!allowed.includes(status)) return { error: "That status isn't valid." };
    const { data, error } = await supabase
      .from("trips")
      .update({ trip_status: status, is_lead: status === "new_lead" })
      .eq("id", a.trip_id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Couldn't update that trip." };
    revalidatePath("/app/trips/" + a.trip_id);
    revalidatePath("/app/trips");
    revalidatePath("/app");
    return { ok: true, message: "Status set to " + status.replace("_", " ") + "." };
  }

  if (tool === "assign_driver") {
    if (!a.trip_id) return { error: "No trip specified." };
    const { data, error } = await supabase
      .from("trips")
      .update({ driver_id: a.driver_id ?? null })
      .eq("id", a.trip_id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: "Couldn't assign the driver." };
    revalidatePath("/app/trips/" + a.trip_id);
    revalidatePath("/app/trips");
    return { ok: true, message: a.driver_id ? "Driver assigned." : "Driver removed." };
  }

  if (tool === "create_customer") {
    const name = String(a.name ?? "").trim();
    if (!name) return { error: "A name is required." };
    const { error } = await supabase.from("customers").insert({
      business_id: business.id,
      name,
      email: a.email ? String(a.email) : null,
      phone: a.phone ? String(a.phone) : null,
    });
    if (error) {
      console.error("create_customer:", error);
      return { error: "Couldn't create the customer." };
    }
    revalidatePath("/app/customers");
    return { ok: true, message: "Added customer " + name + "." };
  }

  return { error: "I can't do that one yet." };
}