"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBusiness } from "./actions";

type Industry =
  | "transportation"
  | "restaurant"
  | "retail"
  | "service"
  | "mobile_seller";

const industries: { value: Industry; label: string; icon: React.ReactNode }[] = [
  {
    value: "transportation",
    label: "Transportation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 13l1.8-5A2 2 0 0 1 6.7 6.7h10.6A2 2 0 0 1 19.2 8L21 13" />
        <path d="M3 13h18v4h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" />
      </svg>
    ),
  },
  {
    value: "restaurant",
    label: "Restaurant",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M5 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M7 12v9M16 3a3 3 0 0 1 3 3v6h-3M16 3v18" />
      </svg>
    ),
  },
  {
    value: "retail",
    label: "Retail",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 8h12l-1 12H7L6 8z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    value: "service",
    label: "Service",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" />
      </svg>
    ),
  },
  {
    value: "mobile_seller",
    label: "Mobile seller",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="17.5" r="1.5" />
      </svg>
    ),
  },
];

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your business name.");
      return;
    }
    if (!industry) {
      setError("Pick what kind of business you run.");
      return;
    }
    startTransition(async () => {
      const res = await createBusiness({ name: name.trim(), industry });
      if ("error" in res) {
        setError(res.error);
      } else {
        router.push("/app");
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden flex items-center gap-2 mb-8 oa-rise">
        <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M13 2L3 14h7v8l10-12h-7z" />
          </svg>
        </span>
        <span className="font-semibold text-lg tracking-tight">Surge</span>
      </div>

      <div className="oa-rise">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Two quick things and you&apos;re in.
        </p>
      </div>

      <div className="oa-rise mt-8" style={{ animationDelay: "0.08s" }}>
        <label className="text-sm font-medium">Business name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Airlink Ride"
          autoFocus
          className="mt-2 flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div className="oa-rise mt-6" style={{ animationDelay: "0.16s" }}>
        <label className="text-sm font-medium">What do you run?</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2">
          {industries.map((ind) => {
            const selected = industry === ind.value;
            return (
              <button
                key={ind.value}
                type="button"
                onClick={() => setIndustry(ind.value)}
                className={
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all " +
                  (selected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 text-foreground"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent text-muted-foreground")
                }
              >
                <span className={selected ? "text-primary" : ""}>{ind.icon}</span>
                <span className="text-xs font-medium">{ind.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-5 text-sm text-destructive">{error}</p>
      )}

      <div className="oa-rise mt-8" style={{ animationDelay: "0.24s" }}>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Setting up your workspace…
            </>
          ) : (
            "Create workspace"
          )}
        </button>
      </div>
    </div>
  );
}