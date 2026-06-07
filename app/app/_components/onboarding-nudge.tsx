"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissOnboarding } from "./onboarding-actions";

export function OnboardingNudge() {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    startTransition(async () => {
      await dismissOnboarding();
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">Finish setting up Surge</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Add your items, set your tax rate, and open a register to start selling.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/onboarding"
          className="px-3 py-1.5 text-sm rounded-md border border-foreground bg-accent font-medium"
        >
          Finish setup
        </Link>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label="Dismiss"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="w-4 h-4"
          >
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}