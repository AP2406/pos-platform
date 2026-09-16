import { getCurrentBusiness } from "@/lib/services/tenancy";

export const dynamic = "force-dynamic";

export default async function AccountPausedPage() {
  const ctx = await getCurrentBusiness();
  const name = ctx ? ctx.business.name : "This account";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Account paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">{name} is currently paused. Access has been temporarily suspended. Please contact Surge to reactivate it.</p>
        <a href="mailto:billing@surgetechpos.com" className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Contact Surge</a>
        <div className="mt-4"><a href="/login" className="text-xs text-muted-foreground underline">Sign in with a different account</a></div>
      </div>
    </div>
  );
}