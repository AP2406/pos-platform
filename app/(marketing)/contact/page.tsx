import Link from "next/link";
import { pageMetadata, Photo, Checklist } from "../design";
import { ContactForm } from "./contact-form";
import { JsonLd, breadcrumb } from "../jsonld";
export const metadata = pageMetadata(
  "Contact Surge",
  "Talk to Surge about your POS, business setup or the free pilot. Share your country, time zone and what your team needs.",
  "/contact",
);
export default function ContactPage() {
  return (
    // marketing.css is scoped under .surge-site, and this element is the
    // scope. It used to be the marketing layout wrapper, which put the home
    // page inside it too.
    <div className="surge-site">
      <section className="s-wrap">
      <JsonLd data={breadcrumb("Contact", "/contact")} />
      <div className="s-page-intro">
        <p className="s-eyebrow">Let’s talk</p>
        <h1>
          Good questions
          <br />
          deserve a real conversation.
        </h1>
        <p className="s-lede">
          Tell us a little about your business and what you have in mind. We’ll
          help you find the next step.
        </p>
      </div>
      <div className="s-form-layout">
        <div>
          <div className="s-contact-links">
            <a href="mailto:info@surgetechpos.com">info@surgetechpos.com ↗</a>
            <a href="tel:+18886488097">+1 (888) 648-8097</a>
            <Link href="/book" className="s-text-link">
              Want to see the POS? Book a demo →
            </Link>
          </div>
          <Checklist
            items={[
              "Questions about the product or pilot",
              "Help planning your devices and setup",
              "Enquiries from businesses worldwide",
            ]}
          />
          <Photo name="team" />
        </div>
        <div className="s-form-shell">
          <ContactForm />
          <p className="s-form-help">
            Please include your country and time zone if you’d like us to
            arrange a call.
          </p>
        </div>
      </div>
      </section>
    </div>
  );
}
