"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SurgeIcon } from "@/components/brand/surge-logo";
import { Container, btnPrimary, ArrowRight } from "./primitives";
import { TERMINAL_COPY } from "@/lib/services/terminal-availability";

// THE SITE HEADER.
//
// TWO VARIANTS, ONE COMPONENT.
//   `overlay` — 01-home.jpg draws the header with no bar of its own, sitting
//     directly on the hero, which bleeds to the top of the viewport. Used by /.
//   `solid`  — a white bar with a hairline, for every page whose hero starts
//     with a tinted band. This is the default.
//
// THE ANNOUNCEMENT STRIP IS ON `solid` AND OFF `overlay`, deliberately.
// The mockup's header has no strip and the home page carries the hardware
// caveat in its own hero ("Terminal hardware is not yet available."), directly
// under the CTAs, which is stronger placement than a 12px strip. The other
// twenty-one routes have no such line yet, so they keep the strip until Phase 2
// rebuilds them — removing it site-wide today would quietly delete the only
// launch-state disclosure several of those pages have.
//
// NAV LABELS ARE THE MOCKUP'S FOUR. "Solutions" is a disclosure rather than a
// link because there is no /solutions index in this repo yet and the rules
// forbid a nonworking navigation link; it opens onto the two industry pages
// that do exist. Every other item is a route that resolves today.

type Variant = "overlay" | "solid";

const SOLUTIONS = [
  { href: "/pos-for-restaurants", label: "Restaurants & cafés" },
  { href: "/pos-for-retail", label: "Retail & service counters" },
];

const PRODUCT_LINK = { href: "/pos", label: "Product" };

// The two labels that sit after the Solutions disclosure in the mockup's rail.
const TRAILING_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/guides", label: "Guides" },
];

export function SiteHeader({ variant }: { variant?: Variant }) {
  // The variant is derived from the route rather than passed down, because the
  // marketing layout is a server component and would otherwise have to learn
  // the route just to forward it. Overlay is a property of a page that opens
  // with a full-bleed hero, which today is exactly "/".
  const pathname = usePathname();
  const resolved: Variant = variant ?? (pathname === "/" ? "overlay" : "solid");
  const [menuOpen, setMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const solutionsRef = useRef<HTMLDivElement | null>(null);

  // Escape closes whichever thing is open, and a click outside closes the
  // disclosure. Both are listener-based rather than blur-based because a blur
  // handler fires before the click inside the panel lands and eats the choice.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setSolutionsOpen(false);
      setMenuOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!solutionsRef.current) return;
      if (!solutionsRef.current.contains(e.target as Node)) setSolutionsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const navLink =
    "rounded-[var(--surge-radius-control)] px-1 py-2 text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] transition-colors duration-[var(--surge-motion)] hover:text-[var(--surge-action)]";

  return (
    <header
      className={
        resolved === "overlay"
          ? // Absolute, not fixed: the hero photograph runs under it and there
            // is nothing to keep pinned once the reader has scrolled past.
            "absolute inset-x-0 top-0 z-40"
          : "sticky top-0 z-40 border-b border-[var(--surge-border)] bg-[var(--surge-surface)]"
      }
    >
      {resolved === "solid" ? (
        <div className="bg-[var(--surge-ink)] text-[length:var(--surge-micro)] text-[var(--surge-on-dark-muted)]">
          <Container className="flex items-center justify-between py-1.5">
            <span>Point of sale for restaurants, cafés and shops &middot; {TERMINAL_COPY.note}</span>
            <Link href="/book" className="hidden font-semibold text-white underline-offset-4 hover:underline sm:block">
              Book a demo
            </Link>
          </Container>
        </div>
      ) : null}

      <Container className="flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Surge — home">
          {/* THE MARK, NOT THE LOCKUP, AND THAT IS A DELIBERATE DEPARTURE FROM
              THE MOCKUP. 01-home.jpg draws the horizontal lockup here; measured
              against its canvas it is ~168px wide. The logo kit's floor for
              that artwork is 220px, below which its README says to reach for
              the dedicated optical icon rather than shrink the wordmark, and a
              72px header rail has nowhere near 220px to give. So: the 32px
              icon the kit draws for this size, with the wordmark typeset beside
              it in the page's own Inter — visually the same lockup, without
              breaking the kit's one hard rule. The footer, which has the room,
              uses the real lockup at its full 220px. */}
          <SurgeIcon size={32} title={null} className="h-8 w-8" />
          <span className="text-[length:var(--surge-h3)] font-bold tracking-[-0.02em] text-[var(--surge-ink)]">Surge</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          <Link href={PRODUCT_LINK.href} className={navLink}>
            {PRODUCT_LINK.label}
          </Link>

          <div className="relative" ref={solutionsRef}>
            <button
              type="button"
              aria-expanded={solutionsOpen}
              aria-controls="solutions-menu"
              onClick={() => setSolutionsOpen((v) => !v)}
              className={navLink + " inline-flex items-center gap-1"}
            >
              Solutions
              <svg viewBox="0 0 20 20" aria-hidden="true" className={"h-3 w-3 transition-transform duration-[var(--surge-motion)] " + (solutionsOpen ? "rotate-180" : "")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            {solutionsOpen ? (
              <div
                id="solutions-menu"
                className="absolute left-0 top-full z-10 mt-2 w-[260px] rounded-[var(--surge-radius-card)] border border-[var(--surge-border)] bg-[var(--surge-surface)] p-2 shadow-[0_8px_24px_-12px_rgba(23,25,29,0.3)]"
              >
                {SOLUTIONS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setSolutionsOpen(false)}
                    className="block rounded-[var(--surge-radius-control)] px-3 py-2.5 text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] transition-colors duration-[var(--surge-motion)] hover:bg-[var(--surge-canvas)]"
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {TRAILING_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={navLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] underline-offset-4 hover:underline">
            Sign in
          </Link>
          <Link href="/book" className={btnPrimary + " rounded-full"}>
            Book a demo <ArrowRight />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="surge-control inline-flex items-center justify-center border border-[var(--surge-border-control)] px-4 text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] lg:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </Container>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-[var(--surge-border)] bg-[var(--surge-surface)] lg:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {[PRODUCT_LINK, ...SOLUTIONS, ...TRAILING_LINKS].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="surge-control flex items-center justify-start px-2 text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] hover:bg-[var(--surge-canvas)]"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/contact" onClick={() => setMenuOpen(false)} className="surge-control flex items-center justify-start px-2 text-[length:var(--surge-small)] font-semibold text-[var(--surge-ink)] hover:bg-[var(--surge-canvas)]">
              Contact
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="surge-control flex items-center justify-start px-2 text-[length:var(--surge-small)] font-semibold text-[var(--surge-action)] hover:bg-[var(--surge-canvas)]">
              Sign in
            </Link>
            <Link href="/book" onClick={() => setMenuOpen(false)} className={btnPrimary + " mt-1 rounded-full"}>
              Book a demo <ArrowRight />
            </Link>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
