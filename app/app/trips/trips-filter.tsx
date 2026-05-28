"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const options = [
  { value: "", label: "All trips" },
  { value: "self", label: "Driving myself" },
  { value: "partner", label: "Farmed out" },
];

export function TripsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("handled") ?? "";

  function setFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("handled", value);
    else params.delete("handled");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center gap-1 mb-4 border-b border-border pb-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setFilter(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            current === o.value
              ? "bg-[oklch(0.62_0.215_254)] text-white font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}