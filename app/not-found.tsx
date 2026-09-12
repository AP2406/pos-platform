import Link from "next/link";
import { SurgeLogo } from "@/components/brand/surge-logo";

// Branded 404 for any unmatched route (replaces Next's bare default page).
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
      {/* A 404 is a full empty page with nothing competing for the middle, so
          it gets the lockup rather than icon + typeset "Surge". */}
      <div className="mb-8">
        <SurgeLogo className="h-[65px] w-[220px]" />
      </div>
      {/* Flat, where this was a --brand -> --primary sweep clipped to the text.
          --primary and not --brand, unlike MetricCard's hero: that one sits on
          a white CARD and this sits on the page CANVAS, where the logo blue
          manages only 3.07:1 — a pass by arithmetic and a coin-flip in
          practice, which is the same argument --ring already makes one file
          over. --primary measures 4.53:1 on the same canvas. In dark the two
          tokens are the same value, so only light mode moves. */}
      <p className="text-6xl font-bold tabular-nums tracking-tight text-primary">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/app"
        // Matches Button's `primary` variant exactly — now a flat --primary
        // fill, so the 404's way out and the register's Charge key are still
        // the same control.
        className="mt-8 inline-flex items-center justify-center h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-elevation-sm hover:brightness-110 transition"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
