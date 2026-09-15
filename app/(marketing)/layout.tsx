import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Public_Sans } from "next/font/google";
import { SiteNav } from "./site-nav";
import { SiteMotion } from "./site-motion";
import { SurgeLogo } from "@/components/brand/surge-logo";
import { OG_BASE } from "./shared-metadata";
import { JsonLd, ORGANIZATION } from "./jsonld";
import "./marketing.css";
const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-marketing",
});
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};
export const metadata: Metadata = {
  metadataBase: new URL("https://www.surgetechpos.com"),
  title: {
    default: "Surge — Point of sale for restaurants, cafes and retail",
    template: "%s — Surge",
  },
  description:
    "Run your menu, floor, kitchen, inventory and team with Surge POS. Explore the free pilot. Card processing and payment terminals are coming soon.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon-192.png",
  },
  openGraph: { ...OG_BASE, url: "/" },
  twitter: { card: "summary_large_image" },
};
const groups = [
  {
    title: "Explore Surge",
    links: [
      ["Point of sale", "/pos"],
      ["Restaurants", "/pos-for-restaurants"],
      ["Retail", "/pos-for-retail"],
      ["Cafes & quick service", "/solutions/cafes"],
      ["Multiple locations", "/solutions/multi-location"],
      ["Pricing & free pilot", "/pricing"],
    ],
  },
  {
    title: "Make it your own",
    links: [
      ["Choosing a POS", "/choosing-a-pos"],
      ["Understanding POS costs", "/pos-costs"],
      ["Tablets & hardware", "/pos-hardware"],
      ["Payments & POS", "/payments-and-pos"],
      ["Switching to Surge", "/switching-to-surge"],
      ["Setup & support", "/setup-and-support"],
    ],
  },
  {
    title: "Let’s talk",
    links: [
      ["Book a demo", "/book"],
      ["Contact us", "/contact"],
      ["Business guides", "/guides"],
      ["Sign in", "/login"],
      ["info@surgetechpos.com", "mailto:info@surgetechpos.com"],
    ],
  },
];
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${publicSans.variable} surge-site antialiased`}>
      <JsonLd data={ORGANIZATION} />
      <a className="s-skip" href="#main-content">
        Skip to content
      </a>
      <SiteNav />
      <SiteMotion />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="s-footer">
        <div className="s-wrap">
          <div className="s-footer-grid">
            <div>
              <SurgeLogo tone="dark" className="s-footer-brand" />
              <p>
                Good tools. Clear thinking.
                <br />
                More room for your business.
              </p>
            </div>
            {groups.map((group) => (
              <div key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href}>{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="s-footer-bottom">
            <span>
              © {new Date().getFullYear()} Surge. All rights reserved.
            </span>
            <span>Card processing & payment terminals · Coming soon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
