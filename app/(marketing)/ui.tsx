import Link from "next/link";
import { Check } from "lucide-react";
export function Crumb({ children }: { children: React.ReactNode }) {
  return <div className="s-eyebrow">{children}</div>;
}
export function Tick() {
  return (
    <Check
      size={18}
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-[#006bd6]"
    />
  );
}
export const btnPrimary = "s-button";
export const btnOutline = "s-button s-button-secondary";
export const btnWhite = "s-button";
export function PageHero({
  crumb,
  title,
  sub,
}: {
  crumb: string;
  title: string;
  sub?: string;
}) {
  return (
    <section className="s-wrap">
      <div className="s-page-intro">
        <Crumb>{crumb}</Crumb>
        <h1>{title}</h1>
        {sub && <p className="s-lede">{sub}</p>}
      </div>
    </section>
  );
}
export function ComingSoonBadge({
  children = "Coming soon",
}: {
  children?: React.ReactNode;
}) {
  return <span className="s-badge">{children}</span>;
}
export function PaymentsComingSoon({
  heading = "Card processing and terminals: coming soon",
  body,
}: {
  heading?: string;
  body?: string;
}) {
  return (
    <aside className="s-note">
      <ComingSoonBadge />
      <h3 className="mt-4">{heading}</h3>
      <p className="mt-3">
        {body ??
          "Surge’s card processing and payment terminal are in development. They are not available to purchase today. Keep your existing processor separate during the POS pilot."}
      </p>
      <Link href="/payments-and-pos" className="s-text-link">
        Learn about payments and POS →
      </Link>
    </aside>
  );
}
export function CtaBand({
  title,
  sub,
  cta,
  href = "/book",
}: {
  title: string;
  sub: string;
  cta: string;
  href?: string;
}) {
  return (
    <section className="s-closing">
      <div className="s-wrap">
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        <Link href={href} className="s-button">
          {cta}
        </Link>
      </div>
    </section>
  );
}
