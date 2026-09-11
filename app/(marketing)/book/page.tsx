import type { Metadata } from "next";
import { BookWizard } from "./book-wizard";
import { OG_BASE } from "../shared-metadata";
import { JsonLd, breadcrumb } from "../jsonld";
import { Crumb } from "../ui";

// A SAVINGS CALL BECOMES A DEMO. The wizard's field keys and the server action
// behind it are untouched — only the framing moved, because the thing being
// booked is now "watch the POS run your menu" rather than "we quote you a rate".
export const metadata: Metadata = {
  title: { absolute: "Book a Free POS Demo | Surge" },
  description: "Book a free 15-minute demo of Surge POS. We will load your menu, draw your floor, and show you the register, the kitchen display and the reports on your own business.",
  alternates: { canonical: "/book" },
  openGraph: { ...OG_BASE, url: "/book" },
};

const points = ["A walkthrough on your own menu", "Straight answers about what it does and does not do", "The right setup for your business"];

export default function BookPage() {
  return (
    <section className="border-b border-[#D9E1EA] bg-[#F4F7FA] pb-28">
      <JsonLd data={breadcrumb("Book a Call", "/book")} />
      <div className="mx-auto max-w-2xl px-6 pt-40 text-center">
        <Crumb>Book a demo</Crumb>
        <h1 className="mt-4 text-[40px] font-bold leading-[1.12] tracking-[-0.015em] text-[#0A2540] sm:text-[46px]">Book your free POS demo.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#42566B]">Fifteen minutes, no pressure, no jargon. Answer a few quick questions and we will come prepared with a till set up like yours.</p>
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
