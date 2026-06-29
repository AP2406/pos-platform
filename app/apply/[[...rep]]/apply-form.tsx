"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INDUSTRIES = [
  { v: "restaurant", label: "Restaurant" },
  { v: "retail", label: "Retail" },
  { v: "service", label: "Service" },
  { v: "transportation", label: "Transportation" },
  { v: "mobile_seller", label: "Mobile / pop-up" },
];
const PLANS = [
  { v: "Starter $49", label: "Starter — $49/mo" },
  { v: "Pro $99", label: "Pro — $99/mo" },
  { v: "", label: "Not sure yet" },
];

export function ApplyForm({ repCode }: { repCode: string | null }) {
  const [f, setF] = useState({ business_name: "", contact_name: "", contact_email: "", contact_phone: "", industry: "restaurant", plan: "Starter $49" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ready = f.business_name.trim() && f.contact_email.includes("@");

  async function submit() {
    setErr(null);
    if (!ready) { setErr("Add your business name and a valid email."); return; }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_application", {
      p_business_name: f.business_name,
      p_contact_name: f.contact_name,
      p_contact_email: f.contact_email,
      p_contact_phone: f.contact_phone,
      p_industry: f.industry,
      p_plan: f.plan,
      p_rep: repCode,
    });
    setBusy(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) { setErr("Something went wrong. Please try again."); return; }
    setDone(true);
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center py-10">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Application received</h1>
          <p className="text-zinc-600 mt-2">Thanks, {f.contact_name || "there"} — the Surge team will reach out about <span className="font-medium">{f.business_name}</span> shortly.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-zinc-900">Apply to Surge</h1>
      <p className="text-zinc-600 mt-1 mb-6">Tell us about your business and we&apos;ll get you set up with payments + the POS.</p>
      {repCode && <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1 inline-block mb-4">Referred by {repCode}</p>}
      <div className="space-y-3">
        <Field label="Business name"><input value={f.business_name} onChange={set("business_name")} className="inp" placeholder="Aathy Bistro" /></Field>
        <Field label="Your name"><input value={f.contact_name} onChange={set("contact_name")} className="inp" placeholder="Owner name" /></Field>
        <Field label="Email"><input value={f.contact_email} onChange={set("contact_email")} inputMode="email" className="inp" placeholder="you@business.com" /></Field>
        <Field label="Phone"><input value={f.contact_phone} onChange={set("contact_phone")} inputMode="tel" className="inp" placeholder="(optional)" /></Field>
        <Field label="Industry"><select value={f.industry} onChange={set("industry")} className="inp">{INDUSTRIES.map((i) => <option key={i.v} value={i.v}>{i.label}</option>)}</select></Field>
        <Field label="Plan"><select value={f.plan} onChange={set("plan")} className="inp">{PLANS.map((p) => <option key={p.label} value={p.v}>{p.label}</option>)}</select></Field>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={submit} disabled={busy || !ready} className="w-full h-12 rounded-lg bg-zinc-900 text-white font-medium disabled:opacity-50">{busy ? "Submitting…" : "Apply"}</button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 my-8">
        {children}
        <style>{`.inp{height:2.75rem;width:100%;border-radius:0.5rem;border:1px solid #d4d4d8;padding:0 0.75rem;font-size:0.875rem;background:#fff;color:#18181b}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
