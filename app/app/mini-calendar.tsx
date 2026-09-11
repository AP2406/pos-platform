"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TripLite = {
  id: string;
  scheduled_at: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  trip_status: string;
  customer: { name: string } | { name: string }[] | null;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function tzDayKey(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return y + "-" + m + "-" + d;
}

function cellKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return year + "-" + m + "-" + d;
}

function customerName(t: TripLite): string {
  if (!t.customer) return "One-off";
  if (Array.isArray(t.customer)) return t.customer[0]?.name ?? "One-off";
  return t.customer.name ?? "One-off";
}

function timeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MiniCalendar({ timezone }: { timezone: string }) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [trips, setTrips] = useState<TripLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      const to = new Date(Date.UTC(year, month + 2, 1)).toISOString();
      const { data } = await supabase
        .from("trips")
        .select("id, scheduled_at, pickup_address, dropoff_address, trip_status, customer:customers(name)")
        .gte("scheduled_at", from)
        .lt("scheduled_at", to)
        .order("scheduled_at", { ascending: true });
      if (active) {
        setTrips((data as TripLite[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, TripLite[]>();
    for (const t of trips) {
      const key = tzDayKey(t.scheduled_at, timezone);
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [trips, timezone]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = cellKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    setSelected(null);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    setSelected(null);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const selectedTrips = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Calendar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-sm">
            {MONTHS[month]} {year}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Previous month"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Next month"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="text-[10px] uppercase text-muted-foreground font-semibold py-1"
            >
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={"b" + i} />;
            const key = cellKey(year, month, day);
            const dayTrips = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(isSelected ? null : key)}
                className={
                  "relative h-9 rounded-md text-sm flex items-center justify-center transition-colors " +
                  (isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-accent text-foreground font-semibold"
                    : "hover:bg-accent text-foreground")
                }
              >
                {day}
                {dayTrips.length > 0 && (
                  <span
                    className={
                      "absolute bottom-1 w-1.5 h-1.5 rounded-full " +
                      (isSelected ? "bg-primary-foreground" : "bg-primary")
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
        {loading && (
          <div className="text-xs text-muted-foreground mt-2">Loading...</div>
        )}
      </div>

      {/* Selected day's trips */}
      <div className="bg-card border border-border rounded-lg p-4">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground py-8">
            Tap a day to see its trips.
          </div>
        ) : selectedTrips.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground py-8">
            No trips on this day.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-1">
              {selectedTrips.length} trip{selectedTrips.length === 1 ? "" : "s"}
            </div>
            {selectedTrips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push("/app/trips/" + t.id)}
                className="w-full text-left p-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium tabular-nums w-14 shrink-0">
                    {timeLabel(t.scheduled_at, timezone)}
                  </span>
                  <span className="font-medium text-sm truncate">
                    {customerName(t)}
                  </span>
                </div>
                {(t.pickup_address || t.dropoff_address) && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5 pl-16">
                    {t.pickup_address} → {t.dropoff_address}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}