"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { submitContact } from "../actions";
import { HoneypotField } from "../honeypot";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  // Stamped once on mount — when the visitor got the form, not when they
  // submitted it. See MIN_FILL_MS in lib/services/form-throttle.ts. The stamp is
  // taken in an effect rather than in the useRef initialiser because Date.now()
  // during render is impure (react-hooks/purity); 0 until the effect runs, which
  // the server-side check reads as an implausible stamp and ignores, so the
  // failure mode is "no signal", never a false positive against a real visitor.
  const startedAtRef = useRef<number>(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
    const res = await submitContact({
      name: name,
      email: email,
      phone: phone,
      message: message,
      website: honeypotRef.current?.value || "",
      startedAt: startedAtRef.current,
    });
    if (res.ok) {
      setStatus("ok");
    } else {
      setStatus("error");
      setError(res.error || "Something went wrong.");
    }
    } catch {
      setStatus("error");
      setError("We could not send your request. Please try again or email info@surgetechpos.com.");
    }
  }

  if (status === "ok") {
    return (
      <div role="status" className="rounded-xl border border-[#d9dddf] bg-[#EDF7F1] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[7px] bg-[#1E7B4D] text-white"><svg viewBox="0 0 20 20" className="h-6 w-6" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <h3 className="mt-4 text-xl font-bold text-[#171a1f]">Message sent</h3>
        <p className="mt-2 text-sm text-[#59616b]">Thanks{name ? ", " + name : ""} &mdash; we will get back to you shortly.</p>
      </div>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-[7px] border border-[#d9dddf] bg-white px-4 py-3 text-sm text-[#171a1f] outline-none transition focus:border-[#1B6DC1] focus:ring-2 focus:ring-[#CFE3F7]";

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-[#d9dddf] bg-white p-7 sm:p-8">
      <HoneypotField formId="contact" inputRef={honeypotRef} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="text-sm font-semibold text-[#171a1f]">Name</label>
          <input id="c-name" autoComplete="name" maxLength={120} type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-phone" className="text-sm font-semibold text-[#171a1f]">Phone <span className="text-[#626c77]">(optional)</span></label>
          <input id="c-phone" autoComplete="tel" maxLength={40} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="c-email" className="text-sm font-semibold text-[#171a1f]">Email</label>
        <input id="c-email" autoComplete="email" maxLength={200} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div className="mt-4">
        <label htmlFor="c-message" className="text-sm font-semibold text-[#171a1f]">Message</label>
        <textarea id="c-message" maxLength={4000} placeholder="Tell us about your business and where you operate…" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
      </div>
      {status === "error" ? (<p role="alert" className="mt-3 text-sm text-[#B42318]">{error}</p>) : null}
      <button type="submit" disabled={status === "sending"} className="mt-5 flex w-full items-center justify-center rounded-[7px] bg-[#171a1f] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#343b45] disabled:opacity-60">{status === "sending" ? "Sending..." : "Send message"}</button>
    </form>
  );
}