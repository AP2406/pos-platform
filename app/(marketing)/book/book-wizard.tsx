"use client";

import { useState, useEffect, type FormEvent } from "react";
import { submitBooking } from "../actions";

const choiceSteps = [
  { key: "businessType", q: "What kind of business do you run?", options: ["Cafe / quick-serve", "Restaurant / bar", "Retail / shop", "Salon / services", "Transportation", "Other"] },
  { key: "volume", q: "Roughly how much do you process in card sales each month?", options: ["Under $5k", "$5k - $20k", "$20k - $50k", "$50k - $100k", "$100k+"] },
  { key: "avgTicket", q: "What is your average sale size?", options: ["Under $15", "$15 - $50", "$50 - $150", "$150+"] },
  { key: "paymentMix", q: "How do most customers pay?", options: ["Mostly in person", "A mix of both", "Mostly online or phone"] },
];

const TOTAL = choiceSteps.length + 1;

export function BookWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [preferred, setPreferred] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; } else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function start() {
    setStep(0); setAnswers({}); setStatus("idle"); setError("");
    setName(""); setBusiness(""); setEmail(""); setPhone(""); setInterest(""); setPreferred(""); setMessage("");
    setOpen(true);
  }

  function choose(key: string, value: string) {
    setAnswers(function (a) { const next = Object.assign({}, a); next[key] = value; return next; });
    setStep(function (s) { return s + 1; });
  }

  function back() { setStep(function (s) { return Math.max(0, s - 1); }); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending"); setError("");
    const res = await submitBooking({ name: name, business: business, email: email, phone: phone, businessType: answers.businessType || "", volume: answers.volume || "", avgTicket: answers.avgTicket || "", paymentMix: answers.paymentMix || "", interest: interest, preferred: preferred, message: message });
    if (res.ok) { setStatus("ok"); } else { setStatus("error"); setError(res.error || "Something went wrong."); }
  }

  const pct = Math.round((step / TOTAL) * 100);
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <>
      <button type="button" onClick={start} className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_14px_44px_-10px_rgba(37,99,235,0.6)] transition-transform hover:scale-105">Book my free call</button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-lg [animation:surge-rise_0.35s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -inset-[2px] overflow-hidden rounded-[calc(1.5rem+2px)]">
              <div className="absolute left-1/2 top-1/2 h-[260%] w-[260%] bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#38bdf8,#a5f3fc,#06b6d4,#2563eb)] [animation:surge-spin_12s_linear_infinite]" />
            </div>
            <div className="relative max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">&times;</button>

              {status === "ok" ? (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg viewBox="0 0 20 20" className="h-7 w-7" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">You are booked in</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">Thanks{name ? ", " + name : ""}! We will reach out shortly to lock in your free call and show you your exact savings.</p>
                  <button type="button" onClick={() => setOpen(false)} className="mt-6 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Done</button>
                </div>
              ) : (
                <>
                  <div className="pr-8">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Free 15-min call &bull; Step {Math.min(step + 1, TOTAL)} of {TOTAL}</div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300" style={{ width: pct + "%" }} /></div>
                  </div>

                  <div key={step} className="mt-6 [animation:surge-rise_0.3s_ease-out]">
                    {step < choiceSteps.length ? (
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{choiceSteps[step].q}</h3>
                        <div className="mt-5 grid gap-2.5">
                          {choiceSteps[step].options.map((opt) => (
                            <button key={opt} type="button" onClick={() => choose(choiceSteps[step].key, opt)} className={"flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition " + (answers[choiceSteps[step].key] === opt ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50")}><span>{opt}</span><span className="text-slate-300">&rarr;</span></button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={onSubmit}>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">Last step &mdash; where do we reach you?</h3>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="b-name" className="text-sm font-medium text-slate-700">Name</label>
                            <input id="b-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label htmlFor="b-business" className="text-sm font-medium text-slate-700">Business <span className="text-slate-400">(optional)</span></label>
                            <input id="b-business" type="text" value={business} onChange={(e) => setBusiness(e.target.value)} className={inputClass} />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="b-email" className="text-sm font-medium text-slate-700">Email</label>
                            <input id="b-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label htmlFor="b-phone" className="text-sm font-medium text-slate-700">Phone <span className="text-slate-400">(optional)</span></label>
                            <input id="b-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                          </div>
                        </div>
                        <div className="mt-4">
                          <label htmlFor="b-interest" className="text-sm font-medium text-slate-700">Mainly interested in <span className="text-slate-400">(optional)</span></label>
                          <select id="b-interest" value={interest} onChange={(e) => setInterest(e.target.value)} className={inputClass}><option value="">Choose one</option><option value="Lower payment rates">Lower payment rates</option><option value="POS software">POS software</option><option value="Custom software build">Custom software build</option><option value="Not sure yet">Not sure yet</option></select>
                        </div>
                        <div className="mt-4">
                          <label htmlFor="b-preferred" className="text-sm font-medium text-slate-700">Best time to reach you <span className="text-slate-400">(optional)</span></label>
                          <input id="b-preferred" type="text" value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="e.g. weekday mornings" className={inputClass} />
                        </div>
                        {status === "error" ? (<p className="mt-3 text-sm text-red-600">{error}</p>) : null}
                        <button type="submit" disabled={status === "sending"} className="mt-5 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)] disabled:opacity-60">{status === "sending" ? "Booking..." : "Book my free call"}</button>
                      </form>
                    )}
                  </div>

                  {step > 0 ? (<button type="button" onClick={back} className="mt-5 text-sm font-medium text-slate-400 transition hover:text-slate-700">&larr; Back</button>) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}