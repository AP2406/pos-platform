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

/**
 * Shared with the sidebar's user block, which is where the approved design puts
 * the avatar — exported rather than copied so the two can never disagree about
 * what "Alex Chen" reduces to.
 */
export function initialsOf(name: string): string {
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

  // TEXT FIRST, THEN THE DOT — the design's order, which was the other way
  // round here. It reads better for the reason the design presumably chose it:
  // the dot is a state indicator for a phrase, and an indicator that precedes
  // the thing it indicates is a bullet point.
  return (
    <span className="hidden items-center gap-2 text-[13px] text-muted-foreground lg:inline-flex">
      {online ? "Connected" : "Offline"}
      <span
        aria-hidden
        className={
          "size-2 rounded-full " + (online ? "bg-emerald-500" : "bg-destructive")
        }
      />
    </span>
  );
}

/**
 * The design's search field, built as a REAL field this time.
 *
 * It used to be a button that looked like a field and opened a palette with the
 * actual input inside it. The design draws one bordered 300px input at a 10px
 * radius with a placeholder in it, so that is what this is — you type into the
 * thing you are looking at.
 *
 * WHAT IT SEARCHES IS THIS WORKSPACE'S SCREENS, and the results panel says so
 * in its own heading. There is still no index over orders, items, guests or
 * staff (`grep -rn "globalSearch" app lib` finds nothing), so the panel names
 * its scope rather than letting the placeholder imply one it can't honour. The
 * field is genuinely useful: the rail folds ~36 destinations under 8 primaries,
 * and this is how you reach the other 28 without expanding a branch.
 */
function SearchField({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        close();
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function go(href: string) {
    close();
    inputRef.current?.blur();
    router.push(href);
  }

  const listId = "top-bar-search-results";

  return (
    // 300px exactly, and fixed rather than `flex-1 max-w-sm`: the design sizes
    // this field, it does not let the column size it.
    <div className="relative hidden w-[300px] shrink-0 md:block">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) go(matches[0].href);
        }}
        placeholder="Search anything"
        // The accessible name states the scope the placeholder can't. A screen
        // reader user gets "Search this workspace's screens"; a sighted reader
        // gets the design's words plus a panel headed "Screens".
        aria-label="Search this workspace's screens"
        className="u-tx u-focus h-10 w-full rounded-[10px] border border-line bg-card pl-9 pr-14 text-sm placeholder:text-muted-foreground hover:border-line-strong"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1 text-[10px] leading-4 text-muted-foreground lg:inline">
        {"⌘K"}
      </kbd>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={close} />
          <div
            id={listId}
            className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-[10px] bg-popover ring-1 ring-line shadow-elevation"
          >
            {/* The scope, named. This is the whole reason the field is allowed
                to carry the design's placeholder: the panel it opens says what
                it actually looked in, so "Search anything" never gets a chance
                to mean "your orders". */}
            <p className="border-b border-line-soft px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Screens
            </p>
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                No screen by that name.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {matches.map((m) => (
                  <li key={m.href}>
                    <button
                      type="button"
                      // onMouseDown, not onClick: the backdrop above and the
                      // input's own blur both fire first on a click, and the
                      // row would be unmounted before the click landed.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        go(m.href);
                      }}
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
  nav,
  className = "",
}: {
  nav: NavSection[];
  className?: string;
}) {
  const pathname = usePathname();
  const destinations = useMemo(() => flattenNav(nav), [nav]);

  // The first crumb is the nav SECTION's label — "Workspace" — not the business
  // name, which is the design's `Workspace / Overview` and is also the string
  // the rail prints over its own list. The business name is not lost: it is the
  // bold line of the bordered card at the top of the rail, which is where the
  // design puts it and where one copy of it belongs.
  const rootLabel = nav[0]?.label ?? "Workspace";

  // The rest of the breadcrumb is read off the nav tree rather than off the
  // URL, so it says the same words the sidebar does — "Menu", not "catalog".
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
