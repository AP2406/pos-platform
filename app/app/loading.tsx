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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/surge-appicon.svg" alt="Surge" className="relative w-12 h-12 rounded-xl shadow-lg" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">
        Loading your workspace…
      </p>
    </div>
  );
}