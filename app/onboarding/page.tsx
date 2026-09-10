import { requireUser, getCurrentBusiness } from "@/lib/services/tenancy";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const isAdding = sp?.add === "1";

  const ctx = await getCurrentBusiness();
  // Only bounce to /app if they already have a business AND aren't deliberately
  // adding another one.
  if (ctx && !isAdding) redirect("/app");

  return (
    <div className="u-serif min-h-screen flex bg-background">
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes oaRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.oa-rise{animation:oaRise .7s cubic-bezier(0.16,1,0.3,1) both}@keyframes oaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-28px)}}.oa-float{animation:oaFloat 9s ease-in-out infinite}",
        }}
      />

      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.21 0.045 265), oklch(0.15 0.02 265))",
          }}
        />
        <div
          className="oa-float absolute -top-24 -left-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: "oklch(0.66 0.19 250 / 0.35)" }}
        />
        <div
          className="oa-float absolute -bottom-16 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "oklch(0.6 0.18 285 / 0.25)", animationDelay: "2.5s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(oklch(1 0 0 / 0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-2.5 oa-rise">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/surge-appicon.svg" alt="Surge" className="w-9 h-9 rounded-lg" />
            <span className="font-semibold text-lg tracking-tight">Surge</span>
          </div>

          <div className="max-w-md">
            <h2
              className="oa-rise text-3xl font-semibold tracking-tight leading-tight"
              style={{ animationDelay: "0.1s" }}
            >
              Run your whole operation from one place.
            </h2>
            <p
              className="oa-rise text-white/60 mt-4 text-sm leading-relaxed"
              style={{ animationDelay: "0.2s" }}
            >
              Payments, orders, customers, staff &mdash; Surge keeps the day-to-day
              moving so you can focus on the work.
            </p>
            <div
              className="oa-rise flex flex-wrap gap-2 mt-6"
              style={{ animationDelay: "0.3s" }}
            >
              {["Take payments", "Track orders", "Run multiple businesses"].map(
                (f) => (
                  <span
                    key={f}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/20 text-white/80"
                  >
                    {f}
                  </span>
                )
              )}
            </div>
          </div>

          <div
            className="oa-rise text-xs text-white/40"
            style={{ animationDelay: "0.4s" }}
          >
            &copy; Surge &middot; surgetechpos.com
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <OnboardingForm />
      </div>
    </div>
  );
}