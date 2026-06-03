"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SurgeMark } from "./surge-mark";

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
        <div className="relative bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-xs font-medium sm:text-sm">
            <span>Now onboarding GTA &amp; Durham businesses</span>
            <Link href="/book" className="underline underline-offset-2 hover:opacity-80">See what you&apos;re overpaying &rarr;</Link>
          </div>
          <button type="button" onClick={() => setBanner(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/80 hover:text-white">Close</button>
        </div>
      )}
      <div className="px-3 pt-3 sm:px-4">
        <nav className={"mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-slate-200/80 pl-4 pr-3 ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300 " + (scrolled ? "bg-white/90 shadow-lg shadow-slate-900/10" : "bg-white/70 shadow-md shadow-slate-900/5")}>
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <SurgeMark className="h-[28px] w-[47px] shrink-0" />
            <span className="text-lg font-bold tracking-tight text-slate-900">Surge</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (<Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600">{l.label}</Link>))}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600">Sign in</Link>
            <Link href="/book" className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_10px_30px_-6px_rgba(6,182,212,0.6)]">Book a call</Link>
          </div>
          <button type="button" onClick={() => setOpen(!open)} className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 md:hidden" aria-label="Toggle menu">{open ? "Close" : "Menu"}</button>
        </nav>
        {open && (
          <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg ring-1 ring-black/5 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              {LINKS.map((l) => (<Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100 hover:text-blue-600">{l.label}</Link>))}
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100 hover:text-blue-600">Sign in</Link>
              <Link href="/book" onClick={() => setOpen(false)} className="mt-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-center font-semibold text-white">Book a call</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}