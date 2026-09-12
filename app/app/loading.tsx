import { SurgeSymbol } from "@/components/brand/surge-logo";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5">
      <div className="relative flex items-center justify-center w-20 h-20">
        <span className="absolute inset-0 rounded-2xl bg-primary/25 blur-xl animate-pulse" />
        <svg
          viewBox="0 0 100 100"
          fill="none"
          className="absolute inset-0 w-20 h-20 animate-spin text-primary/40"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="72 220"
          />
        </svg>
        {/* The symbol alone inside the ring — a lockup would not fit a circle,
            and at 48px this is the largest size the kit still calls a symbol
            rather than an icon. No rounded-xl/shadow-lg any more: the mark now
            has transparent background and the kit forbids adding shadows to
            it, so the drop shadow went with the old opaque tile. */}
        <SurgeSymbol className="relative w-12 h-12" title={null} />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">
        Loading your workspace…
      </p>
    </div>
  );
}