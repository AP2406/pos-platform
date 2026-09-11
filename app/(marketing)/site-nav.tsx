"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SurgeMark } from "./surge-mark";

// POS-FIRST ORDER. "Point of sale" was third behind Home and Pricing; it is now
// the first thing after the logo, and the two industry pages sit beside it so a
// restaurant owner can self-select in the nav instead of reading a home page
// first. "Home" is dropped as a label — the logo is the home link on every site
// and repeating it cost the slot that "Restaurants" now occupies.
const LINKS = [
  { href: "/pos", label: "Point of sale" },
  { href: "/pos-for-restaurants", label: "Restaurants" },
  { href: "/pos-for-retail", label: "Retail" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 12); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="bg-[#0A2540] text-[#B9C8D8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-1.5 text-xs">
          <span>Point of sale for the GTA &amp; Durham Region &middot; card processing coming soon</span>
          <Link href="/book" className="hidden font-semibold text-white hover:underline sm:block">Book a demo &rarr;</Link>
        </div>
      </div>
      <div className={"border-b border-[#D9E1EA] bg-white transition-shadow " + (scrolled ? "shadow-[0_2px_12px_rgba(10,37,64,0.08)]" : "")}>
        <nav className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-3 px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* Square now, not 47x28: the old mark was a wide card-and-bolt
                drawing; the new symbol is drawn on a square grid and would be
                stretched by a non-square box, which the kit forbids. */}
            <SurgeMark className="h-8 w-8 shrink-0" />
            <span className="text-lg font-bold tracking-tight text-[#0A2540]">Surge</span>
          </Link>
          {/* md -> lg. The rail carried four labels at 768px; it now carries
              five, and "Restaurants"/"Retail" are longer than the "Home" they
              replaced, so the row collided with the Sign in + Book pair at the
              md breakpoint. The burger now covers tablet as well, and the gap
              drops a notch so the five still sit comfortably at lg. */}
          <div className="hidden items-center gap-6 lg:flex">
            {LINKS.map((l) => (<Link key={l.href} href={l.href} className="text-[14.5px] font-semibold text-[#1A2B3C] transition-colors hover:text-[#1B6DC1]">{l.label}</Link>))}
          </div>
          <div className="hidden items-center gap-5 lg:flex">
            <Link href="/login" className="text-[14.5px] font-semibold text-[#1B6DC1] hover:underline">Sign in</Link>
            <Link href="/book" className="rounded-[4px] bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#123456]">Book a demo</Link>
          </div>
          <button type="button" onClick={() => setOpen(!open)} className="rounded-[4px] border border-[#D9E1EA] px-3 py-2 text-sm font-semibold text-[#1A2B3C] lg:hidden" aria-label="Toggle menu">{open ? "Close" : "Menu"}</button>
        </nav>
        {open && (
          <div className="border-t border-[#D9E1EA] bg-white px-6 py-3 lg:hidden">
            <div className="flex flex-col gap-1 text-sm font-semibold text-[#1A2B3C]">
              {LINKS.map((l) => (<Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-[4px] px-2 py-2.5 hover:bg-[#F4F7FA]">{l.label}</Link>))}
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-[4px] px-2 py-2.5 text-[#1B6DC1] hover:bg-[#F4F7FA]">Sign in</Link>
              <Link href="/book" onClick={() => setOpen(false)} className="mt-1 rounded-[4px] bg-[#0A2540] px-4 py-2.5 text-center font-bold text-white">Book a demo</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
