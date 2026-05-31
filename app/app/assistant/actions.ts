"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  getTodayBoundsUTC,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
} from "@/lib/utils/dates";

type ChatMessage = { role: "user" | "assistant"; text: string };

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
  if (!p) return "Partner";
  if (Array.isArray(p)) return (p[0] as { name?: string })?.name ?? "Partner";
  return (p as { name?: string })?.name ?? "Partner";
}

function bizRev(t: Row): number {
  return t.handled_by === "partner" ? num(t.cookie_amount) : num(t.price_total);
}

export async function askAssistant(
  question: string,
  history: ChatMessage[]
): Promise<{ answer: string } | { error: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return { error: "AI isn't configured yet (missing GEMINI_API_KEY)." };
  }
  if (!question.trim()) {
    return { error: "Ask me something first." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const currency = business.currency || "CAD";

  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);
  const { start: weekStart, end: weekEnd } = getWeekBoundsUTC(tz);
  const { start: monthStart, end: monthEnd } = getMonthBoundsUTC(tz);

  const [todayRes, upcomingRes, weekRes, monthRes, unpaidRes, cookiesRes, leadsRes] =
    await Promise.all([
      supabase
        .from("trips")
        .select("scheduled_at, price_total, trip_status, handled_by, cookie_amount, customer:customers(name), pickup_address, dropoff_address")
        .gte("scheduled_at", todayStart.toISOString())
        .lt("scheduled_at", todayEnd.toISOString())
        .eq("is_lead", false)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("trips")
        .select("scheduled_at, price_total, trip_status, handled_by, cookie_amount, customer:customers(name), pickup_address, dropoff_address")
        .gte("scheduled_at", todayEnd.toISOString())
        .eq("is_lead", false)
        .not("trip_status", "in", "(cancelled,no_show,lost)")
        .order("scheduled_at", { ascending: true })
        .limit(10),
      supabase
        .from("trips")
        .select("price_total, cookie_amount, handled_by")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .eq("trip_status", "completed"),
      supabase
        .from("trips")
        .select("price_total, cookie_amount, handled_by")
        .gte("scheduled_at", monthStart.toISOString())
        .lt("scheduled_at", monthEnd.toISOString())
        .eq("trip_status", "completed"),
      supabase
        .from("trips")
        .select("price_total, scheduled_at, customer:customers(name)")
        .eq("handled_by", "self")
        .eq("payment_collected", false)
        .not("trip_status", "in", "(cancelled,no_show,lost)")
        .order("scheduled_at", { ascending: false })
        .limit(20),
      supabase
        .from("trips")
        .select("cookie_amount, partner:partners(name)")
        .eq("handled_by", "partner")
        .eq("cookie_collected", false)
        .not("cookie_amount", "is", null)
        .not("trip_status", "in", "(cancelled,no_show,lost)")
        .limit(20),
      supabase
        .from("trips")
        .select("scheduled_at, customer:customers(name), pickup_address, dropoff_address, price_total")
        .eq("is_lead", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const todayTrips: Row[] = todayRes.data ?? [];
  const today = todayTrips.map((t) => ({
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(t.scheduled_at)),
    customer: cname(t.customer),
    from: t.pickup_address,
    to: t.dropoff_address,
    status: t.trip_status,
    amount: bizRev(t),
  }));
  const todayCompletedGross = todayTrips
    .filter((t) => t.trip_status === "completed")
    .reduce((s, t) => s + bizRev(t), 0);

  const upcoming = (upcomingRes.data ?? []).map((t: Row) => ({
    when: new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(t.scheduled_at)),
    customer: cname(t.customer),
    from: t.pickup_address,
    to: t.dropoff_address,
    status: t.trip_status,
    amount: bizRev(t),
  }));

  const weekGross = (weekRes.data ?? []).reduce(
    (s: number, t: Row) => s + bizRev(t),
    0
  );
  const monthData: Row[] = monthRes.data ?? [];
  const monthGross = monthData.reduce((s, t) => s + bizRev(t), 0);

  const unpaid = (unpaidRes.data ?? []).map((t: Row) => ({
    customer: cname(t.customer),
    amount: num(t.price_total),
  }));
  const unpaidTotal = unpaid.reduce((s: number, u) => s + u.amount, 0);

  const cookies = (cookiesRes.data ?? []).map((t: Row) => ({
    partner: pname(t.partner),
    amount: num(t.cookie_amount),
  }));
  const cookiesTotal = cookies.reduce((s: number, c) => s + c.amount, 0);

  const leads = (leadsRes.data ?? []).map((t: Row) => ({
    customer: cname(t.customer),
    from: t.pickup_address,
    to: t.dropoff_address,
  }));

  const snapshot = {
    business: { name: business.name, industry: business.industry, currency },
    today: { trips: today, completedEarnings: todayCompletedGross },
    upcoming,
    earnings: {
      thisWeek: weekGross,
      thisMonth: monthGross,
      completedTripsThisMonth: monthData.length,
    },
    outstanding: {
      customersOweMe: { total: unpaidTotal, items: unpaid },
      partnersOweMe: { total: cookiesTotal, items: cookies },
    },
    openLeads: { count: leads.length, items: leads },
  };

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

  const prompt =
    "You are the AI assistant built into Surge, the POS/CRM used by " +
    business.name +
    ", a " +
    business.industry +
    " business. Today is " +
    todayStr +
    ". All money is in " +
    currency +
    ".\n\n" +
    "Answer the user's question using ONLY the business data in the JSON below. Be concise, specific, and warm. Use real names and numbers, and format money like $1,234.50. If the question asks for something not in the data (a specific past month, one customer's full history, or anything not present), say you can't see that just yet and tell them what you CAN answer: today's schedule, this week/month earnings, who owes money, upcoming trips, and open leads. Never invent data.\n\n" +
    "BUSINESS DATA:\n" +
    JSON.stringify(snapshot) +
    "\n\n" +
    (histText ? "Recent conversation:\n" + histText + "\n\n" : "") +
    "User's question: " +
    question;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const answer =
      response.text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    if (!answer.trim()) {
      return { error: "I couldn't come up with an answer. Try rephrasing?" };
    }
    return { answer: answer.trim() };
  } catch (error) {
    console.error("askAssistant:", error);
    return { error: "Something went wrong reaching the AI. Try again." };
  }
}