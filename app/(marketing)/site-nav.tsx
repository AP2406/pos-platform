"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/pos", label: "Point of sale" },
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
    <header className={"fixed inset-x-0 top-0 z-50 transition-all duration-300 " + (scrolled ? "border-b border-white/10 bg-[#06070d]/70 backdrop-blur-xl" : "bg-transparent")}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">Surge</Link>
        <div className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {LINKS.map((l) => (<Link key={l.href} href={l.href} className="transition-colors hover:text-white">{l.label}</Link>))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm text-white/70 transition-colors hover:text-white">Sign in</Link>
          <Link href="/book" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#06070d] transition-opacity hover:opacity-90">Book a call</Link>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="text-sm text-white/80 md:hidden">{open ? "Close" : "Menu"}</button>
      </nav>
      {open && (
        <div className="border-t border-white/10 bg-[#06070d]/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4 px-6 py-4 text-sm text-white/80">
            {LINKS.map((l) => (<Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="hover:text-white">{l.label}</Link>))}
            <Link href="/login" onClick={() => setOpen(false)} className="hover:text-white">Sign in</Link>
            <Link href="/book" onClick={() => setOpen(false)} className="rounded-full bg-white px-4 py-2 text-center font-medium text-[#06070d]">Book a call</Link>
          </div>
        </div>
      )}
    </header>
  );
}