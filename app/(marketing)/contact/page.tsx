import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { PageHero } from "../ui";

export const metadata: Metadata = {
  title: { absolute: "Contact Surge — Payments & POS in the GTA" },
  description: "Get in touch with Surge for payment processing, point of sale, or custom software in the GTA. Send a message and we will get back to you, or book a free call.",
  alternates: { canonical: "/contact" },
  openGraph: { ...OG_BASE, url: "/contact" },
};

const CONTACT_EMAIL = "info@surgetechpos.com";
const CONTACT_PHONE = "(888) 648-8097";

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumb("Contact", "/contact")} />

      <PageHero crumb="Contact" title="Let's talk." sub="Questions about rates, the POS, or a custom build? Send a note and a real person gets back to you — usually same day." />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-start gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="rounded-md border border-[#D9E1EA] bg-white p-7">
                <h2 className="text-lg font-bold text-[#0A2540]">Reach us directly</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Email</div>
                    <a href={"mailto:" + CONTACT_EMAIL} className="mt-1 inline-block font-semibold text-[#1B6DC1] hover:underline">{CONTACT_EMAIL}</a>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Phone</div>
                    <a href={"tel:" + CONTACT_PHONE.replace(/[^0-9+]/g, "")} className="mt-1 inline-block font-semibold text-[#0A2540] hover:text-[#1B6DC1]">{CONTACT_PHONE}</a>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Area served</div>
                    <div className="mt-1 text-[#42566B]">Greater Toronto Area & Durham Region</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#7A8CA0]">Hours</div>
                    <div className="mt-1 text-[#42566B]">Mon&ndash;Fri, 9am&ndash;6pm ET</div>
                  </div>
                </div>
                <div className="mt-6 rounded-[4px] border border-[#D9E1EA] bg-[#F4F7FA] p-4 text-sm text-[#42566B]">Ready to switch? <Link href="/book" className="font-bold text-[#1B6DC1] hover:underline">Book a free call &rarr;</Link></div>
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
