import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (anything with "use client").
 * Reads env vars at build time.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}