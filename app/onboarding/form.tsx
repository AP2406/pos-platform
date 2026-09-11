"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBusiness } from "./actions";
import { BUSINESS_MODES } from "@/lib/modules/modes";
import { SurgeLogo } from "@/components/brand/surge-logo";

const icons: Record<string, React.ReactNode> = {
  register: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M3 20h18M8 16v4M16 16v4" />
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  ),
  cup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
      <path d="M17 9h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 2v2M11 2v2" />
    </svg>
  ),
  utensils: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M7 12v9M16 3a3 3 0 0 1 3 3v6h-3M16 3v18" />
    </svg>
  ),
  glass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 4h16l-8 8-8-8z" />
      <path d="M12 12v7M8 21h8" />
    </svg>
  ),
  scissors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 8l12 8M8 16l12-8" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
};

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your business name.");
      return;
    }
    if (!mode) {
      setError("Pick what kind of business you run.");
      return;
    }
    startTransition(async () => {
      const res = await createBusiness({ name: name.trim(), mode });
      if ("error" in res) {
        setError(res.error);
      } else {
        router.push("/app");
      }
    });
  }

  return (
    <div className="w-full max-w-lg">
      {/* Narrow-viewport identity, where the brand panel is hidden. Column is
          max-w-lg, so the lockup clears the kit's 220px floor comfortably. */}
      <div className="lg:hidden mb-8 oa-rise">
        <SurgeLogo className="h-[65px] w-[220px]" />
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
          placeholder="e.g. Aat&apos;s Cafe"
          autoFocus
          className="mt-2 flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div className="oa-rise mt-6" style={{ animationDelay: "0.16s" }}>
        <label className="text-sm font-medium">What do you run?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {BUSINESS_MODES.map((m) => {
            const selected = mode === m.key;
            const soon = m.status !== "live";
            return (
              <button
                key={m.key}
                type="button"
                disabled={soon}
                onClick={() => setMode(m.key)}
                className={
                  "relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all " +
                  (soon
                    ? "border-border bg-card opacity-55 cursor-not-allowed"
                    : selected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent")
                }
              >
                <span
                  className={
                    "mt-0.5 shrink-0 " +
                    (selected ? "text-primary" : "text-muted-foreground")
                  }
                >
                  {icons[m.icon]}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {m.label}
                    </span>
                    {soon && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                    {m.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-5 text-sm text-destructive">{error}</p>}

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
              Setting up your workspace...
            </>
          ) : (
            "Create workspace"
          )}
        </button>
      </div>
    </div>
  );
}