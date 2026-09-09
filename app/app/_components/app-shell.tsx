"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav, type NavSection } from "./sidebar-nav";
import { SignOutButton } from "./sign-out";
import { ThemeToggle } from "./theme-toggle";
import { PageTransition } from "./page-transition";
import { OnboardingNudge } from "./onboarding-nudge";
import { switchBusiness } from "@/lib/services/switch-business";
import { modeLabel } from "@/lib/modules/modes";

type BizSummary = {
  id: string;
  name: string;
  industry: string;
  role: string;
  mode?: string | null;
};

function WorkspaceSwitcher({
  businesses,
  activeBusinessId,
  fallbackName,
  fallbackIndustry,
  role,
  canViewRollup,
}: {
  businesses: BizSummary[];
  activeBusinessId: string;
  fallbackName: string;
  fallbackIndustry: string;
  role: string;
  canViewRollup?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = businesses.find((b) => b.id === activeBusinessId) ?? null;
  const name = active ? active.name : fallbackName;
  const typeLabel = active
    ? modeLabel(active.mode, active.industry)
    : modeLabel(null, fallbackIndustry);
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  function choose(id: string) {
    if (id === activeBusinessId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchBusiness(id);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left rounded-md p-1.5 -m-1.5 hover:bg-sidebar-accent transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.08em] text-sidebar-muted font-medium">
            Workspace
          </span>
          <span className="block font-medium text-sm mt-1 truncate">{name}</span>
          <span className="block text-xs text-sidebar-muted mt-0.5">
            {typeLabel} {"\u00B7"} {roleLabel}
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-sidebar-muted">
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-sidebar-border bg-sidebar shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1">
              {businesses.map((b) => {
                const isActive = b.id === activeBusinessId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => choose(b.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-sidebar-accent transition-colors disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{b.name}</span>
                      <span className="block text-xs text-sidebar-muted">
                        {modeLabel(b.mode, b.industry)}
                      </span>
                    </span>
                    {isActive && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-sidebar-primary">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Multi-location owners need to look at the group, not just hop
                between locations one at a time. */}
            {canViewRollup && businesses.length > 1 && (
              <div className="border-t border-sidebar-border">
                <a href="/app/locations" className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-sidebar-accent transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-sidebar-muted">
                    <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
                  </svg>
                  All {businesses.length} locations
                </a>
                <a href="/app/accounting/consolidated" className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-sidebar-accent transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-sidebar-muted">
                    <path d="M4 19V5m0 14h16M8 15V9m4 6V7m4 8v-4" />
                  </svg>
                  Consolidated books
                </a>
              </div>
            )}
          <div className="border-t border-sidebar-border">
              <a href="/onboarding?add=1" className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-sidebar-accent transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-sidebar-muted">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add a business
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mt-0.5">
        <path d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" />
      </svg>
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">Demo mode.</span> You&rsquo;re exploring a
        sandbox — take orders and run the floor freely. The menu, floor plan and
        settings are locked, and no real payments are processed.
      </p>
    </div>
  );
}

export function AppShell({
  businessName,
  industry,
  role,
  businesses,
  activeBusinessId,
  nav,
  canViewRollup,
  showOnboarding,
  isDemo,
  children,
}: {
  businessName: string;
  industry: string;
  role: string;
  businesses: BizSummary[];
  activeBusinessId: string;
  nav: NavSection[];
  canViewRollup?: boolean;
  showOnboarding?: boolean;
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The register is a full-screen till: no static sidebar, menu button at every
  // size, and the content fills the screen instead of the centered page wrapper.
  const isTill = pathname === "/app/pos";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The till is a focused kiosk: no admin sidebar, no header, no backdrop. The
  // register's own slim top bar provides the only way out (exit to dashboard).
  if (isTill) {
    return (
      <main className="h-[100dvh] overflow-hidden bg-background">{children}</main>
    );
  }

  const asideClasses =
    "w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shrink-0 " +
    "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out " +
    (isTill ? "" : "md:static md:z-auto md:translate-x-0 ") +
    (open ? "translate-x-0" : "-translate-x-full");

  const headerClasses =
    "fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border " +
    (isTill ? "" : "md:hidden");

  const backdropClasses =
    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm " + (isTill ? "" : "md:hidden");

  return (
    <div className="min-h-screen flex bg-background">
      <header className={headerClasses}>
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
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/surge-appicon.svg" alt="Surge" className="w-9 h-9 rounded-lg shrink-0" />
          <span className="font-semibold text-base tracking-tight">Surge</span>
          {isTill && (
            <span className="text-sm text-sidebar-foreground/70 truncate hidden sm:inline">
              {"\u00B7"} {businessName}
            </span>
          )}
        </div>
      </header>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className={backdropClasses}
          aria-hidden="true"
        />
      )}

      <aside className={asideClasses}>
        <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/surge-appicon.svg" alt="Surge" className="w-9 h-9 rounded-lg shrink-0 shadow-sm" />
              <span className="font-semibold text-base tracking-tight">Surge</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className={"p-1 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors " + (isTill ? "" : "md:hidden")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          <WorkspaceSwitcher
            businesses={businesses}
            activeBusinessId={activeBusinessId}
            fallbackName={businessName}
            fallbackIndustry={industry}
            role={role}
            canViewRollup={canViewRollup}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav sections={nav} />
        </div>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        {isTill ? (
          <div className="h-[100dvh] pt-14 overflow-hidden">{children}</div>
        ) : (
          <div className="max-w-7xl mx-auto px-5 md:px-8 pt-20 md:pt-8 pb-10">
            {isDemo && <DemoBanner />}
            {showOnboarding && <OnboardingNudge />}
            <PageTransition>{children}</PageTransition>
          </div>
        )}
      </main>
    </div>
  );
}