"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out";
import { ThemeToggle } from "./theme-toggle";
import { PageTransition } from "./page-transition";

type NavItem = { href: string; label: string };

export function AppShell({
  businessName,
  industry,
  role,
  nav,
  children,
}: {
  businessName: string;
  industry: string;
  role: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const asideClasses =
    "w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0 " +
    "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out md:static md:z-auto md:translate-x-0 " +
    (open ? "translate-x-0" : "-translate-x-full");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13 2L3 14h7v8l10-12h-7z" />
            </svg>
          </span>
          <span className="font-semibold text-sm tracking-tight">Surge</span>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Sidebar / drawer */}
      <aside className={asideClasses}>
        <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M13 2L3 14h7v8l10-12h-7z" />
                </svg>
              </span>
              <span className="font-semibold text-sm tracking-tight">Surge</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="md:hidden p-1 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-sidebar-muted font-medium">
              Workspace
            </div>
            <div className="font-medium text-sm mt-1 truncate">{businessName}</div>
            <div className="text-xs text-sidebar-muted capitalize mt-0.5">
              {industry.replace("_", " ")} · {role}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav items={nav} />
        </div>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-20 md:pt-8 pb-10">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}