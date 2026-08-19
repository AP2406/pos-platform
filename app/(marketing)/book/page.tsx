import type { Metadata } from "next";
import { BookWizard } from "./book-wizard";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { Crumb } from "../ui";

export const metadata: Metadata = {
  title: { absolute: "Book a Free Savings Call | Surge" },
  description: "Book a free 15-minute call with Surge. We will review your numbers and show you exactly how much you could save on payment processing, plus the right POS or custom build for your business.",
  alternates: { canonical: "/book" },
  openGraph: { ...OG_BASE, url: "/book" },
};

const points = ["A clear quote on your lower rate", "Your exact savings vs what you pay now", "The right setup for your business"];

export default function BookPage() {
  return (
    <section className="border-b border-[#D9E1EA] bg-[linear-gradient(180deg,#F4F7FA,#FFFFFF)] pb-28">
      <JsonLd data={breadcrumb("Book a Call", "/book")} />
      <div className="mx-auto max-w-2xl px-6 pt-40 text-center">
        <Crumb>Book a call</Crumb>
        <h1 className="mt-4 text-[40px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[46px]">Book your free savings call.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#42566B]">Fifteen minutes, no pressure, no jargon. Answer a few quick questions and we will come prepared with your numbers.</p>
        <div className="mt-9 flex justify-center">
          <BookWizard />
        </div>
        <p className="mt-4 text-xs font-semibold text-[#7A8CA0]">Takes about 30 seconds &bull; No commitment</p>
        <div className="mx-auto mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
          {points.map((p) => (
            <div key={p} className="rounded-md border border-[#D9E1EA] bg-white p-4 text-sm font-semibold text-[#42566B]">{p}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
