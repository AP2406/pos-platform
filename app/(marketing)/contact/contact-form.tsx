"use client";

import { useState, type FormEvent } from "react";
import { submitContact } from "../actions";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const res = await submitContact({ name: name, email: email, phone: phone, message: message });
    if (res.ok) {
      setStatus("ok");
    } else {
      setStatus("error");
      setError(res.error || "Something went wrong.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg viewBox="0 0 20 20" className="h-6 w-6" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <h3 className="mt-4 text-xl font-semibold text-slate-900">Message sent</h3>
        <p className="mt-2 text-sm text-slate-600">Thanks{name ? ", " + name : ""} &mdash; we will get back to you shortly.</p>
      </div>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="text-sm font-medium text-slate-700">Name</label>
          <input id="c-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-phone" className="text-sm font-medium text-slate-700">Phone <span className="text-slate-400">(optional)</span></label>
          <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="c-email" className="text-sm font-medium text-slate-700">Email</label>
        <input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div className="mt-4">
        <label htmlFor="c-message" className="text-sm font-medium text-slate-700">Message</label>
        <textarea id="c-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
      </div>
      {status === "error" ? (<p className="mt-3 text-sm text-red-600">{error}</p>) : null}
      <button type="submit" disabled={status === "sending"} className="mt-5 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)] disabled:opacity-60">{status === "sending" ? "Sending..." : "Send message"}</button>
    </form>
  );
}