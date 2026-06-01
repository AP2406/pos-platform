"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useVocab } from "../_components/vocab-provider";

export function TripsTabs({
  tripCount,
  leadCount,
}: {
  tripCount: number;
  leadCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vocab = useVocab();
  const view = searchParams.get("view") === "leads" ? "leads" : "trips";

  function go(target: "trips" | "leads") {
    if (target === "leads") {
      router.push("/app/trips?view=leads");
    } else {
      router.push("/app/trips");
    }
  }

  const base =
    "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors";
  const active = "border-foreground text-foreground";
  const inactive =
    "border-transparent text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center gap-2 border-b border-border mb-4">
      <button
        onClick={() => go("trips")}
        className={base + " " + (view === "trips" ? active : inactive)}
      >
        {vocab.job_plural} ({tripCount})
      </button>
      <button
        onClick={() => go("leads")}
        className={base + " " + (view === "leads" ? active : inactive)}
      >
        Leads ({leadCount})
      </button>
    </div>
  );
}