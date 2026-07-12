"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="shrink-0 text-sm rounded-md bg-foreground text-background px-3.5 py-2 font-medium hover:opacity-90"
    >
      Print
    </button>
  );
}
