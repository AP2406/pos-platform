import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";

export const metadata: Metadata = {
  title: { absolute: "Contact Surge — Payments & POS in the GTA" },
  description: "Get in touch with Surge for payment processing, point of sale, or custom software in the GTA. Send a message and we will get back to you, or book a free call.",
  alternates: { canonical: "/contact" },
  openGraph: { ...OG_BASE, url: "/contact" },
};

const CONTACT_EMAIL = "info@surgetechpos.com";
const CONTACT_PHONE = "(888) 648-8097";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Contact", "/contact")} />
      <section className="relative overflow-hidden pb-10 pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[80%] bg-gradient-to-b from-blue-50 via-sky-50/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-300/25 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-5 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">Let&apos;s talk.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">Questions about rates, the POS, or a custom build? Send a note and a real person gets back to you &mdash; usually same day.</p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Reach us directly</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</div>
                    <a href={"mailto:" + CONTACT_EMAIL} className="mt-1 inline-block font-medium text-blue-600 hover:text-blue-700">{CONTACT_EMAIL}</a>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phone</div>
                    <a href={"tel:" + CONTACT_PHONE.replace(/[^0-9+]/g, "")} className="mt-1 inline-block font-medium text-slate-900 hover:text-blue-600">{CONTACT_PHONE}</a>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Area served</div>
                    <div className="mt-1 text-slate-700">Greater Toronto Area & Durham Region</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hours</div>
                    <div className="mt-1 text-slate-700">Mon&ndash;Fri, 9am&ndash;6pm ET</div>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Ready to switch? <Link href="/book" className="font-semibold text-blue-600 hover:text-blue-700">Book a free call &rarr;</Link></div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}