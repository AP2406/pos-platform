"use client";

import { useState } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookClient({ businessId, timezone }: { businessId: string; timezone: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setErr(null);
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (!when) { setErr("Please pick a date and time."); return; }
    setBusy(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.rpc("submit_online_reservation", {
      p_business_id: businessId,
      p_name: name.trim(),
      p_email: email.trim() || null,
      p_phone: phone.trim() || null,
      p_party: Number(party) || 2,
      p_scheduled_at: new Date(when).toISOString(),
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr("Sorry, we couldn't submit that. Please try again."); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="text-2xl mb-2">✓</div>
        <h2 className="font-medium">Request received</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Thanks, {name.trim()}! Your booking request is in. {email.trim() ? "We'll email a confirmation shortly." : "We'll hold your table."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Party size</Label><Input value={party} onChange={(e) => setParty(e.target.value)} inputMode="numeric" /></div>
        <div className="space-y-1"><Label className="text-xs">Date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="For your confirmation" /></div>
      <div className="space-y-1"><Label className="text-xs">Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, occasion…" /></div>
      <Button className="w-full h-11" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Request booking"}</Button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-[11px] text-muted-foreground text-center">All times shown are {timezone.replace(/_/g, " ")}.</p>
    </div>
  );
}
