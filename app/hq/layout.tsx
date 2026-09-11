import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/services/platform";

export const dynamic = "force-dynamic";

// Surge HQ shell — deliberately distinct from the /app tenant chrome. The gate runs
// here (404 for non-admins) AND in every page/action below it.
export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/hq" className="font-semibold tracking-tight">Surge <span className="text-emerald-400">HQ</span></Link>
            <nav className="flex items-center gap-3 text-sm text-zinc-400">
              <Link href="/hq/merchants" className="hover:text-zinc-100">Merchants</Link>
              <Link href="/hq/portfolio" className="hover:text-zinc-100">Portfolio</Link>
              <Link href="/hq/onboarding" className="hover:text-zinc-100">Onboarding</Link>
              <Link href="/hq/reps" className="hover:text-zinc-100">Reps</Link>
              <Link href="/hq/ops" className="hover:text-zinc-100">Ops</Link>
            </nav>
          </div>
          <div className="text-xs text-zinc-400">
            {admin.email} · <span className="text-zinc-200 capitalize">{admin.role}</span>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
