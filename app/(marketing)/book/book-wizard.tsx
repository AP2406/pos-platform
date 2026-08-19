"use client";

import { useState, useEffect, type FormEvent } from "react";
import { submitBooking } from "../actions";

const businessTypeOptions = ["Cafe / quick-serve", "Restaurant / bar", "Retail / shop", "Salon / services", "Transportation", "Other", "New / not open yet"];
const volumeRanges = ["Under $5k", "$5k - $20k", "$20k - $50k", "$50k - $100k", "$100k+"];
const ticketOptions = ["Under $15", "$15 - $50", "$50 - $150", "$150+", "New business / not sure"];
const mixOptions = ["Mostly in person", "A mix of both", "Mostly online or phone", "New business / not sure"];

const steps: { key?: string; type: string; q?: string; options?: string[] }[] = [
  { key: "businessType", type: "choice", q: "What kind of business do you run?", options: businessTypeOptions },
  { key: "volume", type: "volume", q: "Roughly how much do you process in card sales each month?" },
  { key: "avgTicket", type: "choice", q: "What is your average sale size?", options: ticketOptions },
  { key: "paymentMix", type: "choice", q: "How do most customers pay?", options: mixOptions },
  { type: "contact" },
];

const TOTAL = steps.length;

export function BookWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeInput, setVolumeInput] = useState("");
  const [volumeExact, setVolumeExact] = useState("");
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
    setVolumeInput(""); setVolumeExact("");
    setName(""); setBusiness(""); setEmail(""); setPhone(""); setInterest(""); setPreferred(""); setMessage("");
    setOpen(true);
  }

  function choose(key: string, value: string) {
    setAnswers(function (a) { const next = Object.assign({}, a); next[key] = value; return next; });
    setStep(function (s) { return s + 1; });
  }

  function chooseVolume(label: string, exact: string) {
    setAnswers(function (a) { const next = Object.assign({}, a); next.volume = label; return next; });
    setVolumeExact(exact);
    setStep(function (s) { return s + 1; });
  }

  function submitVolumeNumber() {
    const n = parseInt(volumeInput.replace(/[^0-9]/g, ""), 10);
    if (!n || n <= 0) return;
    chooseVolume("$" + n.toLocaleString("en-CA") + " entered", String(n));
  }

  function back() { setStep(function (s) { return Math.max(0, s - 1); }); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending"); setError("");
    const res = await submitBooking({ name: name, business: business, email: email, phone: phone, businessType: answers.businessType || "", volume: answers.volume || "", volumeExact: volumeExact, avgTicket: answers.avgTicket || "", paymentMix: answers.paymentMix || "", interest: interest, preferred: preferred, message: message });
    if (res.ok) { setStatus("ok"); } else { setStatus("error"); setError(res.error || "Something went wrong."); }
  }

  const pct = Math.round((step / TOTAL) * 100);
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const current = steps[step];
  const curKey = current.key || "";
  const curOptions = current.options || [];

  return (
    <>
      <button type="button" onClick={start} className="rounded-[4px] bg-[#0A2540] px-8 py-4 text-[15.5px] font-bold text-white transition-colors hover:bg-[#123456]">Book my free call</button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-lg [animation:surge-rise_0.35s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -inset-[2px] overflow-hidden rounded-[calc(1.5rem+2px)]">
              
            </div>
            <div className="relative max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">&times;</button>

              {status === "ok" ? (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#1E7B4D] text-white"><svg viewBox="0 0 20 20" className="h-7 w-7" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">You are booked in</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">Thanks{name ? ", " + name : ""}! We will reach out shortly to lock in your free call and show you your exact savings.</p>
                  <button type="button" onClick={() => setOpen(false)} className="mt-6 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Done</button>
                </div>
              ) : (
                <>
                  <div className="pr-8">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Free 15-min call &bull; Step {Math.min(step + 1, TOTAL)} of {TOTAL}</div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[2px] bg-[#E4EAF1]"><div className="h-full rounded-[2px] bg-[#0A2540] transition-all duration-300" style={{ width: pct + "%" }} /></div>
                  </div>

                  <div key={step} className="mt-6 [animation:surge-rise_0.3s_ease-out]">
                    {current.type === "choice" ? (
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{current.q}</h3>
                        <div className="mt-5 grid gap-2.5">
                          {curOptions.map((opt) => (
                            <button key={opt} type="button" onClick={() => choose(curKey, opt)} className={"flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition " + (answers[curKey] === opt ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50")}><span>{opt}</span><span className="text-slate-300">&rarr;</span></button>
                          ))}
                        </div>
                      </div>
                    ) : current.type === "volume" ? (
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">{current.q}</h3>
                        <div className="mt-5">
                          <label htmlFor="b-vol" className="text-sm font-medium text-slate-700">Enter an exact amount</label>
                          <div className="mt-1.5 flex gap-2">
                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                              <input id="b-vol" type="number" inputMode="numeric" min="0" value={volumeInput} onChange={(e) => setVolumeInput(e.target.value)} placeholder="e.g. 20000" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-7 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                            </div>
                            <button type="button" onClick={submitVolumeNumber} disabled={!volumeInput} className="shrink-0 rounded-[4px] bg-[#0A2540] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#123456] disabled:opacity-50">Continue</button>
                          </div>
                        </div>
                        <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or pick a range<span className="h-px flex-1 bg-slate-200" /></div>
                        <div className="grid gap-2.5">
                          {volumeRanges.map((opt) => (
                            <button key={opt} type="button" onClick={() => chooseVolume(opt, "")} className={"flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition " + (answers.volume === opt ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50")}><span>{opt}</span><span className="text-slate-300">&rarr;</span></button>
                          ))}
                          <button type="button" onClick={() => chooseVolume("New business (no sales yet)", "")} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-slate-50"><span>New business &mdash; no sales yet</span><span className="text-slate-300">&rarr;</span></button>
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
                        <button type="submit" disabled={status === "sending"} className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123456] disabled:opacity-60">{status === "sending" ? "Booking..." : "Book my free call"}</button>
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