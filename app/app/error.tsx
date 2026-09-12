"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// There was no error boundary anywhere under /app, so an exception in a server
// component fell through to Next's default screen — a stack trace in dev and a
// blank page in production. That matters more now that must()
// (lib/supabase/query.ts) deliberately throws when a page's primary query
// fails: a broken query should look broken, but it should look broken the way a
// product does, not the way a crash does.
//
// Deliberately does NOT show the raw message in production. A PostgREST error
// can carry column and table names; a merchant doesn't need the schema, and
// neither does anyone reading over their shoulder.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled render error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8">
        <h1 className="text-xl font-semibold">This screen didn&rsquo;t load</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Something went wrong fetching the data for this page. Your sales and
          settings are unaffected — nothing was saved or changed.
        </p>

        {isDev && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-raised border border-border p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {error.message}
          </pre>
        )}

        {error.digest && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/app">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
