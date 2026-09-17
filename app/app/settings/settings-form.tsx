"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBusinessSettings } from "./actions";

// Ten North American zones was the whole list, in a product sold
// internationally — and timezone is not cosmetic in a POS. It drives the
// business-day cutoff, the Z-report, the reports day-axis and table aging, so a
// Colombo restaurant set to America/Toronto rolls its business day over in the
// middle of dinner service and every daily figure it reads is wrong.
//
// Grouped, so a list this long stays scannable. Add a zone when a merchant needs
// it — the server accepts any zone the runtime recognises, so this list is a
// convenience, not the boundary.
const TIMEZONE_GROUPS: { label: string; zones: string[] }[] = [
  {
    label: "South Asia",
    zones: ["Asia/Colombo", "Asia/Kolkata", "Asia/Karachi", "Asia/Dhaka", "Asia/Kathmandu"],
  },
  {
    label: "Southeast Asia & Oceania",
    zones: [
      "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Bangkok", "Asia/Jakarta",
      "Asia/Manila", "Asia/Hong_Kong", "Asia/Tokyo",
      "Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Pacific/Auckland",
    ],
  },
  {
    label: "Middle East & Africa",
    zones: ["Asia/Dubai", "Asia/Riyadh", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo"],
  },
  {
    label: "Europe",
    zones: [
      "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris",
      "Europe/Berlin", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm",
      "Europe/Warsaw", "Europe/Athens", "Europe/Istanbul",
    ],
  },
  {
    label: "North America",
    zones: [
      "America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg",
      "America/Halifax", "America/St_Johns", "America/New_York", "America/Chicago",
      "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
      "Pacific/Honolulu", "America/Mexico_City",
    ],
  },
  {
    label: "Latin America",
    zones: ["America/Bogota", "America/Lima", "America/Santiago", "America/Sao_Paulo", "America/Buenos_Aires"],
  },
];

export function SettingsForm({
  initialName,
  initialTimezone,
}: {
  initialName: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await updateBusinessSettings({ name, timezone });
    setSaving(false);

    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Settings saved." });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {/* A zone already saved that is not in the list stays selectable, so
              opening settings never silently reassigns a merchant's timezone. */}
          {!TIMEZONE_GROUPS.some((g) => g.zones.includes(timezone)) && (
            <option value={timezone}>{timezone}</option>
          )}
          {TIMEZONE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.zones.map((tz) => (
                <option key={tz} value={tz}>
                  {/* City, then the region, so "Colombo — Asia" sorts in the
                      head the way a person looks for it. */}
                  {tz.split("/")[1].replace(/_/g, " ") + " — " + tz.split("/")[0]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}