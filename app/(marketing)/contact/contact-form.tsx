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
      <div className="rounded-md border border-[#D9E1EA] bg-[#EDF7F1] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#1E7B4D] text-white"><svg viewBox="0 0 20 20" className="h-6 w-6" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <h3 className="mt-4 text-xl font-bold text-[#0A2540]">Message sent</h3>
        <p className="mt-2 text-sm text-[#42566B]">Thanks{name ? ", " + name : ""} &mdash; we will get back to you shortly.</p>
      </div>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-[4px] border border-[#D9E1EA] bg-white px-4 py-3 text-sm text-[#1A2B3C] outline-none transition focus:border-[#1B6DC1] focus:ring-2 focus:ring-[#CFE3F7]";

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-[#D9E1EA] bg-white p-7 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="text-sm font-semibold text-[#1A2B3C]">Name</label>
          <input id="c-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-phone" className="text-sm font-semibold text-[#1A2B3C]">Phone <span className="text-[#7A8CA0]">(optional)</span></label>
          <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="c-email" className="text-sm font-semibold text-[#1A2B3C]">Email</label>
        <input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div className="mt-4">
        <label htmlFor="c-message" className="text-sm font-semibold text-[#1A2B3C]">Message</label>
        <textarea id="c-message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
      </div>
      {status === "error" ? (<p className="mt-3 text-sm text-red-600">{error}</p>) : null}
      <button type="submit" disabled={status === "sending"} className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123456] disabled:opacity-60">{status === "sending" ? "Sending..." : "Send message"}</button>
    </form>
  );
}