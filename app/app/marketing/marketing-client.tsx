"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMarketingAudience, sendCampaign, type Channel } from "./marketing-actions";

export function MarketingClient({
  tags,
  consentedCount,
  emailConfigured,
  smsConfigured,
}: {
  tags: { id: string; name: string }[];
  consentedCount: number;
  emailConfigured: boolean;
  smsConfigured: boolean;
}) {
  const [channel, setChannel] = useState<Channel>("email");
  const [segment, setSegment] = useState<string>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(consentedCount);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Recompute the audience whenever the segment or channel changes.
  useEffect(() => {
    let cancelled = false;
    getMarketingAudience(segment, channel)
      .then((a) => { if (!cancelled) setAudience(a.count); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [segment, channel]);

  const channelConfigured = channel === "sms" ? smsConfigured : emailConfigured;

  function send() {
    setErr(null);
    setResult(null);
    startTransition(async () => {
      const res = await sendCampaign({ subject, body, segment, channel });
      setConfirm(false);
      if ("error" in res) { setErr(res.error); return; }
      setResult("Sent to " + res.sent + (res.failed > 0 ? " (" + res.failed + " failed)" : "") + ".");
      setSubject("");
      setBody("");
    });
  }

  const canReview = !pending && channelConfigured && body.trim() !== "" && audience > 0 && (channel === "sms" || subject.trim() !== "");

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2">
        {(["email", "sms"] as Channel[]).map((c) => (
          <button key={c} type="button" onClick={() => { setChannel(c); setConfirm(false); }} className={"text-sm rounded-md px-3 py-1.5 border capitalize " + (channel === c ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>
            {c === "sms" ? "Text (SMS)" : "Email"}
          </button>
        ))}
      </div>

      {!channelConfigured && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-500">
          {channel === "sms" ? "Texting (Twilio) isn't configured yet, so SMS campaigns can't be sent. Add TWILIO_* credentials to enable." : "Email sending isn't configured for this workspace yet, so campaigns can't be sent."}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Audience</Label>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="h-9 w-full rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
            <optgroup label="Smart segments">
              <option value="all">All opted-in customers</option>
              <option value="active">Active — ordered in the last 30 days</option>
              <option value="lapsed">Lapsed — no order in 60+ days</option>
              <option value="vip">VIP — top 20% by spend</option>
              <option value="loyalty">Loyalty members</option>
              <option value="new">New — first order in the last 30 days</option>
            </optgroup>
            {tags.length > 0 && (
              <optgroup label="Tags">
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{"Tagged: " + t.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="text-xs text-muted-foreground">
            {audience + (audience === 1 ? " consented recipient" : " consented recipients") + (channel === "sms" ? " with a phone." : " with an email.")}
          </p>
        </div>

        {channel === "email" && (
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A note from us" className="h-9" />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Message</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={channel === "sms" ? "Short text message. A STOP opt-out is added automatically." : "Write your message. An unsubscribe link is added automatically."}
            rows={channel === "sms" ? 4 : 8}
            maxLength={channel === "sms" ? 900 : undefined}
            className="w-full rounded-md border border-border bg-transparent text-foreground px-3 py-2 text-sm"
          />
          {channel === "sms" && <p className="text-[12px] text-muted-foreground">{body.length} chars · keep it short to avoid multi-part messages.</p>}
        </div>

        {!confirm ? (
          <Button onClick={() => { setErr(null); setResult(null); setConfirm(true); }} disabled={!canReview}>
            Review &amp; send
          </Button>
        ) : (
          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-sm">Send by {channel === "sms" ? "text" : "email"} to <span className="font-semibold">{audience}</span> {audience === 1 ? "customer" : "customers"}?</p>
            <div className="flex gap-2">
              <Button onClick={send} disabled={pending}>{pending ? "Sending…" : "Send now"}</Button>
              <Button variant="outline" onClick={() => setConfirm(false)} disabled={pending}>Cancel</Button>
            </div>
          </div>
        )}

        {result && <p className="text-sm text-emerald-600">{result}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
