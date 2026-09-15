"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { submitBooking } from "../actions";
import { HoneypotField } from "../honeypot";
const businessTypes = [
  "Restaurant / bar",
  "Cafe / quick-serve",
  "Retail / shop",
  "Other",
  "New / not open yet",
];
export function BookWizard() {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [business, setBusiness] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferred, setPreferred] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (open) title.current?.focus();
  }, [open, step, status]);
  function start() {
    setStep(0);
    setStatus("idle");
    setError("");
    setBusinessType("");
    setBusiness("");
    setName("");
    setEmail("");
    setPhone("");
    setPreferred("");
    setMessage("");
    startedAt.current = Date.now();
    setOpen(true);
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setOpen(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const result = await submitBooking({
        name,
        business,
        email,
        phone,
        businessType,
        preferred,
        message,
        interest: "POS software",
        website: honeypotRef.current?.value || "",
        startedAt: startedAt.current,
      });
      if (result.ok) setStatus("ok");
      else {
        setStatus("error");
        setError(result.error || "Please try again.");
      }
    } catch {
      setStatus("error");
      setError(
        "We could not send your request. Please try again or email info@surgetechpos.com.",
      );
    }
  }
  return (
    <>
      <button type="button" className="s-button" onClick={start}>
        Book my free demo →
      </button>
      <dialog
        ref={dialog}
        className="s-book-dialog"
        aria-labelledby="booking-title"
        onClose={() => setOpen(false)}
      >
        <button
          type="button"
          className="s-dialog-close"
          aria-label="Close demo request"
          onClick={close}
        >
          <X size={20} />
        </button>
        {status === "ok" ? (
          <div role="status">
            <h2 id="booking-title" ref={title} tabIndex={-1}>
              Your request is in.
            </h2>
            <p>
              Thanks, {name}. We’ll get in touch to confirm a time for your
              demo.
            </p>
            <button className="s-button" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="s-eyebrow">Free POS demo · Step {step + 1} of 2</p>
            <h2 id="booking-title" ref={title} tabIndex={-1}>
              {step === 0
                ? "Tell us about your business."
                : "Where can we reach you?"}
            </h2>
            {step === 0 ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep(1);
                }}
              >
                <label htmlFor="b-type">Business type</label>
                <select
                  id="b-type"
                  required
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                >
                  <option value="">Choose one</option>
                  {businessTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <label htmlFor="b-business">
                  Business name <span>(optional)</span>
                </label>
                <input
                  id="b-business"
                  autoComplete="organization"
                  maxLength={160}
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                />
                <label htmlFor="b-message">
                  What would you like to explore? <span>(optional)</span>
                </label>
                <textarea
                  id="b-message"
                  rows={3}
                  maxLength={4000}
                  placeholder="Your menu, devices, country or everyday workflow…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button type="submit" className="s-button">
                  Continue →
                </button>
              </form>
            ) : (
              <form onSubmit={submit}>
                <HoneypotField formId="book" inputRef={honeypotRef} />
                <label htmlFor="b-name">Your name</label>
                <input
                  id="b-name"
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <label htmlFor="b-email">Email</label>
                <input
                  id="b-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={200}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="b-phone">
                  Phone <span>(optional)</span>
                </label>
                <input
                  id="b-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <label htmlFor="b-preferred">
                  Preferred time & time zone <span>(optional)</span>
                </label>
                <input
                  id="b-preferred"
                  maxLength={200}
                  value={preferred}
                  onChange={(event) => setPreferred(event.target.value)}
                  placeholder="For example, weekday mornings in your time zone"
                />
                {error && (
                  <p role="alert" className="s-form-error">
                    {error}
                  </p>
                )}
                <div className="s-actions">
                  <button
                    type="button"
                    className="s-button s-button-secondary"
                    disabled={status === "sending"}
                    onClick={() => setStep(0)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="s-button"
                    disabled={status === "sending"}
                  >
                    {status === "sending" ? "Sending…" : "Request my demo"}
                  </button>
                </div>
                <p className="s-small">
                  We’ll confirm the time by email. This does not book a calendar
                  slot automatically.
                </p>
              </form>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
