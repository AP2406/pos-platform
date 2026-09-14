"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { submitPilot } from "../../actions";
import { HoneypotField } from "../../honeypot";

// THE SRI LANKA PILOT SIGN-UP FORM.
//
// IT POSTS TO `submitPilot`, THE SAME SERVER ACTION /pricing USES. The draft
// this page was built from posted to `/api/pilot-signup`, a route that does not
// exist and was not going to be written. Creating it would have put a fourth
// unauthenticated write path on the site, and the only one outside
// app/(marketing)/actions.ts — therefore the only one without the honeypot,
// without the minimum-fill-time check, and outside the shared five-sends-per-IP
// bucket in lib/services/form-throttle.ts. Every one of those controls is there
// because these forms mail a user-supplied address from noreply@surgetechpos.com,
// the domain that also carries live merchants' receipts. A second door onto that
// domain with no throttle is an open relay, and the cost of the domain being
// blocklisted is paid by merchants, not by this page. So there is no new
// endpoint: `submitPilot` grew four optional fields instead.
//
// The three constants below are how the shared action tells these leads apart
// without a second code path — see the `segment` enum in ../../actions.ts.
//
// Validation is server-side (zod, in the action). The `required` attributes and
// `type="email"` here are a convenience on top of it, never the check itself:
// the action re-validates everything and returns per-field messages, and those
// are what get rendered.
const COUNTRY = "LK" as const;
const SEGMENT = "sri-lanka-pilot" as const;
// Stated on the page in plain English as well ("we set you up over video call").
// Carried on the lead so the reply written ten hours away cannot forget it.
const ONBOARDING = "remote" as const;

const businessTypes = ["Restaurant", "Cafe or bakery", "Bar", "Takeaway or quick-serve", "Retail shop", "Other", "Not open yet"];
const locationOptions = ["1", "2", "3 to 5", "6 or more"];

// #B42318 on white is 7.1:1. The marketing site has no error colour of its own,
// and Tailwind's red-600 (#DC2626) measures 4.0:1 — under AA for 13px text.
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-[13px] font-medium text-[#B42318]">{message}</p>;
}

// Hint and error both go in aria-describedby, in that order, or the field's help
// text disappears the moment it fails validation.
function describedBy(fieldErrors: Record<string, string>, field: string, hintId?: string): string | undefined {
  const ids: string[] = [];
  if (hintId) ids.push(hintId);
  if (fieldErrors[field]) ids.push(field + "-error");
  return ids.length ? ids.join(" ") : undefined;
}

export function PilotLkForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [locations, setLocations] = useState("");
  const [currentPos, setCurrentPos] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const doneRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  // Stamped once on mount — when the visitor got the form, not when they
  // submitted it. See MIN_FILL_MS in lib/services/form-throttle.ts. Taken in an
  // effect rather than in the useRef initialiser because Date.now() during
  // render is impure (react-hooks/purity); 0 until the effect runs, which the
  // server reads as an implausible stamp and ignores, so the failure mode is
  // "no signal", never a false positive against a real visitor.
  const startedAtRef = useRef<number>(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

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
      // This page asks for WhatsApp instead of a landline, so the shared action's
      // `phone` field goes unused rather than being filled with the same number
      // twice. `whatsapp` is its own field in the lead email.
      phone: "",
      whatsapp: whatsapp,
      city: city,
      businessType: businessType,
      locations: locations,
      currentPos: currentPos,
      painPoint: painPoint,
      country: COUNTRY,
      segment: SEGMENT,
      onboarding: ONBOARDING,
      website: honeypotRef.current?.value || "",
      startedAt: startedAtRef.current,
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
        {/* The confirmation promises a reply and a call. It does NOT promise a
            place on the pilot, a start date, or when the reply will arrive — we
            are ten hours behind, and this page exists to stop exactly that kind
            of small unkeepable promise. */}
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#42566B]">
          Thanks{contactName ? ", " + contactName : ""} &mdash; a receipt is on its way to {email || "your inbox"}. We read these ourselves and reply, then book a video call to set the till up with you.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[#7A8CA0]">
          Nothing is committed on your side. You keep taking payment exactly as you do now, and you can tell us to stop at any point.
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
      <HoneypotField formId="pilot-lk" inputRef={honeypotRef} />
      <h3 className="text-xl font-bold text-[#0A2540]">Join the free pilot</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#42566B]">Tell us about the shop. We read every one of these ourselves and reply.</p>

      {/* The summary sits ABOVE the fields and is a live region, so the failure
          is announced and readable before a keyboard user tabs back in. */}
      {status === "error" && error ? (
        <p role="alert" className="mt-5 rounded-[4px] border border-[#B42318] bg-[#FDF3F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lk-business" className={labelClass}>Business name</label>
          <input id="lk-business" name="businessName" type="text" required autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} aria-invalid={fieldErrors.businessName ? true : undefined} aria-describedby={describedBy(fieldErrors, "businessName")} className={fieldErrors.businessName ? errorClass : inputClass} />
          <FieldError id="businessName-error" message={fieldErrors.businessName} />
        </div>
        <div>
          <label htmlFor="lk-name" className={labelClass}>Your name</label>
          <input id="lk-name" name="contactName" type="text" required autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} aria-invalid={fieldErrors.contactName ? true : undefined} aria-describedby={describedBy(fieldErrors, "contactName")} className={fieldErrors.contactName ? errorClass : inputClass} />
          <FieldError id="contactName-error" message={fieldErrors.contactName} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lk-email" className={labelClass}>Email</label>
          <input id="lk-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={describedBy(fieldErrors, "email")} className={fieldErrors.email ? errorClass : inputClass} />
          <FieldError id="email-error" message={fieldErrors.email} />
        </div>
        <div>
          {/* WhatsApp rather than "phone". It is the channel Sri Lankan
              businesses actually answer, and asking for the right one is worth
              more than a generic field nobody fills in. Still optional. */}
          <label htmlFor="lk-whatsapp" className={labelClass}>WhatsApp number {optional}</label>
          <input id="lk-whatsapp" name="whatsapp" type="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+94&hellip;" aria-invalid={fieldErrors.whatsapp ? true : undefined} aria-describedby={describedBy(fieldErrors, "whatsapp", "lk-whatsapp-hint")} className={fieldErrors.whatsapp ? errorClass : inputClass} />
          <p id="lk-whatsapp-hint" className="mt-1.5 text-[13px] text-[#7A8CA0]">Usually faster than email, given the time difference.</p>
          <FieldError id="whatsapp-error" message={fieldErrors.whatsapp} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lk-city" className={labelClass}>City or town {optional}</label>
          <input id="lk-city" name="city" type="text" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Colombo, Kandy, Galle&hellip;" aria-invalid={fieldErrors.city ? true : undefined} aria-describedby={describedBy(fieldErrors, "city")} className={fieldErrors.city ? errorClass : inputClass} />
          <FieldError id="city-error" message={fieldErrors.city} />
        </div>
        <div>
          <label htmlFor="lk-type" className={labelClass}>Business type</label>
          <select id="lk-type" name="businessType" required value={businessType} onChange={(e) => setBusinessType(e.target.value)} aria-invalid={fieldErrors.businessType ? true : undefined} aria-describedby={describedBy(fieldErrors, "businessType")} className={fieldErrors.businessType ? errorClass : inputClass}>
            <option value="">Choose one</option>
            {businessTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <FieldError id="businessType-error" message={fieldErrors.businessType} />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="lk-locations" className={labelClass}>Locations {optional}</label>
        <select id="lk-locations" name="locations" value={locations} onChange={(e) => setLocations(e.target.value)} className={inputClass}>
          <option value="">Choose one</option>
          {locationOptions.map((l) => (<option key={l} value={l}>{l}</option>))}
        </select>
      </div>

      {/* Full width rather than paired, same as the /pricing form. The label is
          long enough to wrap into two lines at half width, which pushed this
          input out of line with whatever sat beside it. */}
      <div className="mt-4">
        <label htmlFor="lk-current" className={labelClass}>What you run the till on today {optional}</label>
        <input id="lk-current" name="currentPos" type="text" value={currentPos} onChange={(e) => setCurrentPos(e.target.value)} placeholder="Paper, a cash register, a POS&hellip;" aria-describedby="lk-current-hint" className={inputClass} />
        <p id="lk-current-hint" className="mt-1.5 text-[13px] text-[#7A8CA0]">Helps us know what your staff are used to before the call.</p>
      </div>

      <div className="mt-4">
        <label htmlFor="lk-pain" className={labelClass}>What is not working today {optional}</label>
        <textarea id="lk-pain" name="painPoint" rows={4} value={painPoint} onChange={(e) => setPainPoint(e.target.value)} className={inputClass} />
      </div>

      <button type="submit" disabled={status === "sending"} className="mt-6 flex w-full items-center justify-center rounded-[4px] bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123456] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6DC1] disabled:opacity-60">
        {status === "sending" ? "Sending..." : "Join the free pilot"}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#7A8CA0]">
        No card required. No contract. Stop whenever you like.
      </p>
    </form>
  );
}
