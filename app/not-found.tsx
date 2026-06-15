import Link from "next/link";

// Branded 404 for any unmatched route (replaces Next's bare default page).
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
      <div className="flex items-center gap-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/surge-appicon.svg" alt="Surge" className="w-9 h-9 rounded-lg" />
        <span className="font-semibold text-lg tracking-tight">Surge</span>
      </div>
      <p className="text-6xl font-bold tabular-nums tracking-tight bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/app"
        className="mt-8 inline-flex items-center justify-center h-11 px-5 rounded-lg bg-gradient-to-br from-primary to-chart-2 text-primary-foreground text-sm font-medium shadow-elevation-sm hover:brightness-110 transition"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
