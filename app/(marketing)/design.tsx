import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Plus,
  Tablet,
  SlidersHorizontal,
  Users,
  Package,
  BarChart3,
  LayoutGrid,
} from "lucide-react";
import { OG_BASE } from "./shared-metadata";

export const photos = {
  owner: {
    src: "/images/surge/01-home-owner.webp",
    alt: "Restaurant owner holding a compact tablet beside the counter",
  },
  team: {
    src: "/images/surge/02-team-tablet.webp",
    alt: "Two restaurant team members reviewing an order on a compact tablet",
  },
  counter: {
    src: "/images/surge/03-tablet-counter.webp",
    alt: "Slim tablet on a low stand at a restaurant counter",
  },
  service: {
    src: "/images/surge/04-male-tableside.webp",
    alt: "Server using a handheld tablet beside a restaurant table",
  },
  retail: {
    src: "/images/surge/05-retail-owner.webp",
    alt: "Shop owner using a tablet in a clothing store",
  },
  cafe: {
    src: "/images/surge/06-cafe-barista.webp",
    alt: "Barista preparing coffee while a colleague uses a tablet at the counter",
  },
  terminal: {
    src: "/images/surge/07-terminal-concept.webp",
    alt: "Unbranded payment terminal concept; coming soon and not available to purchase",
  },
  guides: {
    src: "/images/surge/08-guides-desk.webp",
    alt: "Business owner reviewing a sample statement beside a tablet and notebook",
  },
} as const;
export type PhotoName = keyof typeof photos;

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...OG_BASE,
      title: `${title} — Surge`,
      description,
      url: path,
    },
  };
}

export function Photo({
  name,
  className = "",
  eager = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  name: PhotoName;
  className?: string;
  eager?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`s-photo ${className}`}>
      <Image
        src={photos[name].src}
        alt={photos[name].alt}
        fill
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </div>
  );
}

export function Action({
  children,
  href = "/pricing#apply",
  secondary = false,
}: {
  children: React.ReactNode;
  href?: string;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`s-button${secondary ? " s-button-secondary" : ""}`}
    >
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function Hero({
  eyebrow,
  title,
  description,
  photo,
  caption,
  primary = "Join the free pilot",
  primaryHref = "/pricing#apply",
  showcase = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  photo: PhotoName;
  caption?: string;
  primary?: string;
  primaryHref?: string;
  showcase?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="s-wrap s-hero">
      <div className="s-hero-copy">
        <p className="s-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="s-lede">{description}</p>
        <div className="s-actions">
          <Action href={primaryHref}>{primary}</Action>
          <Action href="/book" secondary>
            Book a demo
          </Action>
        </div>
        {children ?? (
          <p className="s-small">
            POS software available through the pilot.
            <br />
            Card processing and terminals coming soon.
          </p>
        )}
      </div>
      <figure className={`s-hero-figure${showcase ? " s-hero-showcase" : ""}`}>
        <Photo name={photo} eager />
        {showcase && (
          <div className="s-hero-detail">
            <div className="s-hero-detail-icon">
              <Tablet size={23} aria-hidden="true" />
            </div>
            <div>
              <span>THE SURGE WORKSPACE</span>
              <strong>A little more under control.</strong>
              <p>Menu. Orders. Team. Together.</p>
            </div>
            <span className="s-hero-detail-mark" aria-hidden="true">
              <Check size={16} />
            </span>
          </div>
        )}
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="s-section-heading" data-reveal>
      <p className="s-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function FeatureGrid({
  items,
}: {
  items: {
    title: string;
    body: string;
    icon?: "menu" | "floor" | "stock" | "team" | "reports" | "locations";
    detail?: string;
  }[];
}) {
  const icons = {
    menu: SlidersHorizontal,
    floor: LayoutGrid,
    stock: Package,
    team: Users,
    reports: BarChart3,
    locations: LayoutGrid,
  };
  return (
    <div className="s-feature-grid">
      {items.map((item, index) => {
        const Icon = item.icon ? icons[item.icon] : null;
        return (
          <article className="s-feature" key={item.title} data-reveal>
            <div className="s-feature-top">
              <span className="s-feature-symbol">
                {Icon ? (
                  <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span className="s-index">
                SURGE / {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            {item.detail && (
              <div className="s-feature-detail">{item.detail}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="s-checklist">
      {items.map((item) => (
        <li key={item}>
          <Check size={17} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="s-wrap s-section s-faq">
      <div>
        <SectionHeading
          eyebrow="A few useful answers"
          title="Good questions. Clear answers."
          description="A few things to know before you take the next step."
        />
        <Link href="/contact" className="s-text-link">
          Ask us something else <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div>
        {items.map((item) => (
          <details key={item.q} data-reveal>
            <summary>
              {item.q}
              <Plus size={18} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ClosingCta({
  title = "Let’s make your next service a little smoother.",
  description = "Tell us how your business runs. We’ll walk you through Surge and help you see whether the pilot is a good fit.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="s-closing">
      <div className="s-wrap" data-reveal>
        <div>
          <p className="s-eyebrow">Made for the way you work</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="s-actions">
          <Action>Join the free pilot</Action>
          <Action href="/contact" secondary>
            Talk to us
          </Action>
        </div>
      </div>
    </section>
  );
}

export function PaymentsPreview() {
  return (
    <section className="s-wrap s-section">
      <div className="s-payment">
        <figure data-reveal>
          <Photo name="terminal" />
          <figcaption>Concept image. Final hardware may differ.</figcaption>
        </figure>
        <div data-reveal>
          <span className="s-badge">Coming soon</span>
          <h2>
            Payments.
            <br />
            Coming soon.
          </h2>
          <p>
            Card processing and a dedicated payment terminal are in development.
            Neither is available from Surge today.
          </p>
          <p>
            Your existing processor stays separate during the POS pilot. We’ll
            share supported markets, hardware and pricing when they’re ready.
          </p>
          <Link href="/payments-and-pos" className="s-text-link">
            Understand payments and POS{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
