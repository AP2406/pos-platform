"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { flattenNav, type NavItem, type NavSection } from "./sidebar-nav";

// The admin frame's top bar.
//
// The owner's mockup puts four things here: a breadcrumb, a search field, a
// status dot and a user chip. Three of those are shipped below. The fourth —
// "Search anything" — is NOT, because there is no global search in this product
// (no index over orders, items, guests or staff; `grep -rn "globalSearch" app
// lib` finds nothing), and a field that looks like search and only disappoints
// is worse than no field. What sits in its slot is the thing that IS real and
// that the newly-nested sidebar actually needs: a jump-to over this viewer's
// own destinations, so folding the long tail under eight primaries never costs
// anyone a keystroke. It says "Jump to" on it, so it does not promise more.
//
// The workspace switcher is deliberately absent. It lives at the top of the
// sidebar — one home, as in the mockup — and a second copy in the breadcrumb
// would be two controls for one piece of state.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Reports the BROWSER's connectivity, and says so in those words.
 *
 * The mockup's dot is labelled "Systems operational", which would be a claim
 * about our infrastructure that this client has no way to check — there is no
 * status endpoint to read. What a till's back office can honestly tell you is
 * whether this machine is talking to the network, which is the failure an
 * operator actually hits mid-service, so that is what the dot means.
 */
function ConnectionDot() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <span className="hidden items-center gap-2 text-xs text-muted-foreground lg:inline-flex">
      <span
        aria-hidden
        className={
          "size-2 rounded-full " + (online ? "bg-emerald-500" : "bg-destructive")
        }
      />
      {online ? "Connected" : "Offline"}
    </span>
  );
}

function JumpTo({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => i.label.toLowerCase().includes(q))
      : items;
    return pool.slice(0, 8);
  }, [items, query]);

  // The query is cleared by whatever closes the palette, not by an effect
  // watching `open` — the close is the event, and reacting to our own state
  // change a render later is how you get a flash of the previous search.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <div className="relative min-w-0 flex-1 max-w-sm">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="u-tx u-focus flex h-9 w-full items-center gap-2 rounded-lg bg-raised px-3 text-left text-sm text-muted-foreground ring-1 ring-line hover:ring-line-strong"
      >
        <SearchIcon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Jump to&hellip;</span>
        <kbd className="hidden shrink-0 rounded border border-line px-1 text-[10px] leading-4 text-muted-foreground sm:inline">
          {"⌘K"}
        </kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={close} />
          <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg bg-popover ring-1 ring-line shadow-elevation">
            <input
              // The field only exists while the palette is open, so the browser's
              // own autofocus is enough — no effect chasing `open`.
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) go(matches[0].href);
              }}
              placeholder="Jump to a screen"
              aria-label="Jump to a screen"
              className="u-focus w-full border-b border-line-soft bg-transparent px-3 py-2.5 text-sm outline-none"
            />
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Nothing here by that name.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {matches.map((m) => (
                  <li key={m.href}>
                    <button
                      type="button"
                      onClick={() => go(m.href)}
                      className="u-tx block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar({
  workspaceName,
  userName,
  roleLabel,
  nav,
  className = "",
}: {
  workspaceName: string;
  /** Display name if the account has one, otherwise the sign-in address. */
  userName: string;
  roleLabel: string;
  nav: NavSection[];
  className?: string;
}) {
  const pathname = usePathname();
  const destinations = useMemo(() => flattenNav(nav), [nav]);

  // The breadcrumb is read off the nav tree rather than off the URL, so it
  // says the same words the sidebar does — "Menu", not "catalog".
  const trail = useMemo(() => {
    let best: { labels: string[]; len: number } | null = null;
    const consider = (labels: string[], href: string) => {
      const hit =
        href === "/app" ? pathname === "/app" : pathname.startsWith(href);
      if (!hit) return;
      if (!best || href.length > best.len) best = { labels, len: href.length };
    };
    for (const section of nav) {
      for (const item of section.items) {
        consider([item.label], item.href);
        for (const child of item.children ?? []) {
          consider([item.label, child.label], child.href);
        }
      }
    }
    return (best as { labels: string[] } | null)?.labels ?? [];
  }, [nav, pathname]);

  return (
    <header
      className={
        "h-14 shrink-0 items-center gap-3 border-b border-line bg-card px-5 md:px-8 " +
        className
      }
    >
      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <li className="truncate text-muted-foreground">{workspaceName}</li>
          {trail.map((label, i) => (
            <li key={label + i} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="text-muted-foreground/50">
                /
              </span>
              <span
                className={
                  "truncate " +
                  (i === trail.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground")
                }
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        <JumpTo items={destinations} />
        <ConnectionDot />
        {/* A link to Settings, not a menu. Sign-out and the theme switch stay
            at the foot of the sidebar, which is the only copy of them that the
            phone drawer can reach — duplicating them up here would be the same
            mistake as a second workspace switcher. */}
        <Link
          href="/app/settings"
          className="u-tx u-focus flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent"
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
          >
            {initialsOf(userName)}
          </span>
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block max-w-[11rem] truncate text-[13px] font-medium">
              {userName}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {roleLabel}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
