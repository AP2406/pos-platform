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
      {/* One hue, both stops — the old blue→teal ramp came from the retired
          mark's cyan and the kit has no cyan in it. */}
      <p className="text-6xl font-bold tabular-nums tracking-tight bg-gradient-to-r from-brand to-primary bg-clip-text text-transparent">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/app"
        // Matches Button's `primary` variant exactly — same two stops, so the
        // 404's way out and the register's Charge key are the same control.
        className="mt-8 inline-flex items-center justify-center h-11 px-5 rounded-lg bg-gradient-to-br from-primary to-primary-2 text-primary-foreground text-sm font-medium shadow-elevation-sm hover:brightness-110 transition"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
