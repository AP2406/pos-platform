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
  const [banner, setBanner] = useState(true);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 12); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {banner && (
        <div className="relative bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-cyan-500 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-xs font-medium sm:text-sm">
            <span>Now onboarding GTA &amp; Durham businesses</span>
            <Link href="/book" className="underline underline-offset-2 hover:opacity-80">See what you&apos;re overpaying &rarr;</Link>
          </div>
          <button type="button" onClick={() => setBanner(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/80 hover:text-white">Close</button>
        </div>
      )}
      <div className={"transition-all duration-300 " + (scrolled ? "border-b border-slate-200 bg-white/80 backdrop-blur-xl" : "bg-transparent")}>
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">Surge</Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            {LINKS.map((l) => (<Link key={l.href} href={l.href} className="transition-colors hover:text-indigo-600">{l.label}</Link>))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600">Sign in</Link>
            <Link href="/book" className="rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(79,70,229,0.6)] transition-shadow hover:shadow-[0_10px_30px_-6px_rgba(6,182,212,0.6)]">Book a call</Link>
          </div>
          <button type="button" onClick={() => setOpen(!open)} className="text-sm font-medium text-slate-700 md:hidden">{open ? "Close" : "Menu"}</button>
        </nav>
        {open && (
          <div className="border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-4 px-6 py-4 text-sm font-medium text-slate-700">
              {LINKS.map((l) => (<Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="hover:text-indigo-600">{l.label}</Link>))}
              <Link href="/login" onClick={() => setOpen(false)} className="hover:text-indigo-600">Sign in</Link>
              <Link href="/book" onClick={() => setOpen(false)} className="rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-center font-semibold text-white">Book a call</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}