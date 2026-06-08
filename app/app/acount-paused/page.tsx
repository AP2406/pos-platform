import { getCurrentBusiness } from "@/lib/services/tenancy";

export const dynamic = "force-dynamic";

export default async function AccountPausedPage() {
  // getCurrentBusiness does NOT block, so this page never loops back on itself.
  const ctx = await getCurrentBusiness();
  const name = ctx ? ctx.business.name : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold">Account paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {name ? name + " is currently paused." : "This account is currently paused."}
          {" "}
          Access has been temporarily suspended. Please get in touch to reactivate it.
        </p>
        
          href="mailto:billing@surgetechpos.com"
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Contact Surge
        </a>
        <div className="mt-4">
          <a href="/login" className="text-xs text-muted-foreground underline">
            Sign in with a different account
          </a>
        </div>
      </div>
    </div>
  );
}