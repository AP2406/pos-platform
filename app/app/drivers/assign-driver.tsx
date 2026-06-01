"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignDriverToTrip } from "./actions";
import { useVocab } from "../_components/vocab-provider";

type Driver = { id: string; name: string };

export function AssignDriver({
  tripId,
  currentDriverId,
}: {
  tripId: string;
  currentDriverId: string | null;
}) {
  const router = useRouter();
  const vocab = useVocab();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState<string>(currentDriverId ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (active) {
        setDrivers(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setDone(false);
    const res = await assignDriverToTrip(tripId, selected || null);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      setDone(true);
      router.refresh();
    }
  }

  const changed = selected !== (currentDriverId ?? "");

  if (loading) {
    return <p className="text-sm text-muted-foreground">{"Loading " + vocab.resource_plural.toLowerCase() + "..."}</p>;
  }

  if (drivers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {"No active " + vocab.resource_plural.toLowerCase() + " yet. Add one on the " + vocab.resource_plural + " page first."}
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setDone(false);
        }}
        className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={saving || !changed}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Assign"}
      </button>
      {done && !changed && (
        <span className="text-sm text-emerald-600">Saved.</span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}