"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { submitPilot } from "../actions";

// THE PILOT SIGN-UP FORM.
//
// Eight fields, five of them optional, because this is lead capture and nothing
// else: the owner reads the email and converts by hand. It creates no account, no
// business and no entitlement, and it touches no table — there is no leads table
// in the schema and adding one would be a migration this task is not allowed to
// make. The submission path is `submitPilot` in ../actions.ts, the same server
// action + Resend plumbing that /contact and /book already use.
//
// Validation is server-side (zod, in the action). The `required` attributes and
// `type="email"` below are a convenience on top of it, not the check itself — the
// action re-validates everything and returns per-field messages, which is what
// gets rendered.

const businessTypes = ["Cafe / quick-serve", "Restaurant / bar", "Retail / shop", "Salon / services", "Other", "Not open yet"];
const locationOptions = ["1", "2", "3 to 5", "6 or more"];

// #B42318 on white is 7.1:1. The marketing site has no error colour of its own,
// and Tailwind's red-600 (#DC2626) measures 4.0:1 — under AA for 13px text.
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-[13px] font-medium text-[#B42318]">{message}</p>;
}

// Both the hint and the error have to be in aria-describedby, in that order, or
// the field's help text disappears the moment it fails validation.
function describedBy(fieldErrors: Record<string, string>, field: string, hintId?: string): string | undefined {
  const ids: string[] = [];
  if (hintId) ids.push(hintId);
  if (fieldErrors[field]) ids.push(field + "-error");
  return ids.length ? ids.join(" ") : undefined;
}

export function PilotForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [locations, setLocations] = useState("");
  const [currentPos, setCurrentPos] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const doneRef = useRef<HTMLDivElement>(null);

  // Move focus to the confirmation when it replaces the form. Without this a
  // screen-reader user submits and is left on a button that no longer exists;
  // role="status" would announce the text but leave the focus ring nowhere.
  useEffect(() => {
    if (status === "ok" && doneRef.current) doneRef.current.focus();
  }, [status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    setFieldErrors({});
    const res = await submitPilot({
      businessName: businessName,
      contactName: contactName,
      email: email,
      phone: phone,
      businessType: businessType,
      locations: locations,
      currentPos: currentPos,
      painPoint: painPoint,
    });
    if (res.ok) {
      setStatus("ok");
    } else {
      setStatus("error");
      setError(res.error || "Something went wrong.");
      setFieldErrors(res.fieldErrors || {});
    }
  }

  if (status === "ok") {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="rounded-md border border-[#D9E1EA] bg-[#EDF7F1] p-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-[#1B6DC1]"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#1E7B4D] text-white">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" aria-hidden="true"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-[#0A2540]">We have your details</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#42566B]">
          Thanks{contactName ? ", " + contactName : ""} &mdash; we have your details and a receipt is on its way to {email || "your inbox"}. We will be in touch to talk the pilot through and book a day to come and set the till up with you.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[#7A8CA0]">
          Nothing is committed on your side. You keep the processor you already have, and you can tell us to stop at any point.
        </p>
      </div>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-[4px] border border-[#D9E1EA] bg-white px-4 py-3 text-sm text-[#1A2B3C] outline-none transition focus:border-[#1B6DC1] focus:ring-2 focus:ring-[#CFE3F7]";
  const errorClass = "mt-1.5 w-full rounded-[4px] border border-[#B42318] bg-white px-4 py-3 text-sm text-[#1A2B3C] outline-none transition focus:border-[#1B6DC1] focus:ring-2 focus:ring-[#CFE3F7]";
  const labelClass = "text-sm font-semibold text-[#1A2B3C]";
  const optional = <span className="font-normal text-[#7A8CA0]">(optional)</span>;

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-[#D9E1EA] bg-white p-7 sm:p-8">
      <h3 className="text-xl font-bold text-[#0A2540]">Join the pilot</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#42566B]">Tell us about the shop. We read every one of these ourselves and reply.</p>

      {/* The summary sits ABOVE the fields and is a live region, so the failure is
          announced and readable before a keyboard user tabs back into the form. */}
      {status === "error" && error ? (
        <p role="alert" className="mt-5 rounded-[4px] border border-[#B42318] bg-[#FDF3F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-business" className={labelClass}>Business name</label>
          <input id="p-business" name="businessName" type="text" required autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} aria-invalid={fieldErrors.businessName ? true : undefined} aria-describedby={describedBy(fieldErrors, "businessName")} className={fieldErrors.businessName ? errorClass : inputClass} />
          <FieldError id="businessName-error" message={fieldErrors.businessName} />
        </div>
        <div>
          <label htmlFor="p-name" className={labelClass}>Your name</label>
          <input id="p-name" name="contactName" type="text" required autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} aria-invalid={fieldErrors.contactName ? true : undefined} aria-describedby={describedBy(fieldErrors, "contactName")} className={fieldErrors.contactName ? errorClass : inputClass} />
          <FieldError id="contactName-error" message={fieldErrors.contactName} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-email" className={labelClass}>Email</label>
          <input id="p-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={describedBy(fieldErrors, "email")} className={fieldErrors.email ? errorClass : inputClass} />
          <FieldError id="email-error" message={fieldErrors.email} />
        </div>
        <div>
          <label htmlFor="p-phone" className={labelClass}>Phone {optional}</label>
          <input id="p-phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={fieldErrors.phone ? true : undefined} aria-describedby={describedBy(fieldErrors, "phone")} className={fieldErrors.phone ? errorClass : inputClass} />
          <FieldError id="phone-error" message={fieldErrors.phone} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-type" className={labelClass}>Business type</label>
          <select id="p-type" name="businessType" required value={businessType} onChange={(e) => setBusinessType(e.target.value)} aria-invalid={fieldErrors.businessType ? true : undefined} aria-describedby={describedBy(fieldErrors, "businessType")} className={fieldErrors.businessType ? errorClass : inputClass}>
            <option value="">Choose one</option>
            {businessTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <FieldError id="businessType-error" message={fieldErrors.businessType} />
        </div>
        <div>
          <label htmlFor="p-locations" className={labelClass}>Locations {optional}</label>
          <select id="p-locations" name="locations" value={locations} onChange={(e) => setLocations(e.target.value)} className={inputClass}>
            <option value="">Choose one</option>
            {locationOptions.map((l) => (<option key={l} value={l}>{l}</option>))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="p-current" className={labelClass}>What you run the till on today {optional}</label>
        <input id="p-current" name="currentPos" type="text" value={currentPos} onChange={(e) => setCurrentPos(e.target.value)} placeholder="Square, Clover, a cash drawer, nothing yet&hellip;" aria-describedby="p-current-hint" className={inputClass} />
        <p id="p-current-hint" className="mt-1.5 text-[13px] text-[#7A8CA0]">Helps us know what your staff are used to before we turn up.</p>
      </div>

      <div className="mt-4">
        <label htmlFor="p-pain" className={labelClass}>What is not working today {optional}</label>
        <textarea id="p-pain" name="painPoint" rows={4} value={painPoint} onChange={(e) => setPainPoint(e.target.value)} className={inputClass} />
      </div>

      <button type="submit" disabled={status === "sending"} className="mt-6 flex w-full items-center justify-center rounded-[4px] bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123456] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6DC1] disabled:opacity-60">
        {status === "sending" ? "Sending..." : "Join the pilot"}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#7A8CA0]">
        This is a request, not a purchase. Nothing is charged, no card is asked for, and we reply to every one.
      </p>
    </form>
  );
}
