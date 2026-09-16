"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Car,
  ChevronRight,
  Users,
  Handshake,
  Settings,
  CreditCard,
  ShoppingBag,
  Package,
  UserCog,
  ScrollText,
  BarChart3,
  Coins,
  Clock,
  Mail,
  CalendarClock,
  Activity,
  BookOpenCheck,
  Boxes,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  Download,
  Flame,
  Lightbulb,
  ListChecks,
  Megaphone,
  Percent,
  Plug,
  ShieldAlert,
  Store,
  Timer,
  Trash2,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "/app": LayoutDashboard,
  "/app/trips": Car,
  "/app/customers": Users,
  "/app/partners": Handshake,
  "/app/vehicles": Car,
  "/app/drivers": Truck,
  "/app/settings": Settings,
  "/app/pos": CreditCard,
  "/app/pos/sales": ShoppingBag,
  "/app/orders": ShoppingBag,
  "/app/kitchen": ChefHat,
  "/app/catalog": Package,
  "/app/staff": UserCog,
  "/app/audit": ScrollText,
  "/app/reports": BarChart3,
  "/app/profit": TrendingUp,
  "/app/tips": Coins,
  "/app/clock": Clock,
  "/app/marketing": Mail,
  "/app/reservations": CalendarClock,
  "/app/live-ops": Activity,
  "/app/checklists": ClipboardCheck,
  "/app/accounting": BookOpenCheck,
  "/app/exports": Download,
  "/app/approvals": ListChecks,
  "/app/exceptions": ShieldAlert,
  "/app/locations": Store,
  "/app/schedule": CalendarDays,
  "/app/labor": Timer,
  "/app/attendance": Clock,
  "/app/staff-records": UserCog,
  "/app/log": ScrollText,
  "/app/incidents": ShieldAlert,
  "/app/broadcasts": Megaphone,
  "/app/inventory": Boxes,
  "/app/purchasing": Truck,
  "/app/recipes": UtensilsCrossed,
  "/app/waste": Trash2,
  "/app/pricing": Percent,
  "/app/upsells": Flame,
  "/app/insights": Lightbulb,
  "/app/integrations": Plug,
};

export type NavItem = {
  href: string;
  label: string;
  /**
   * A live count rendered as a grey pill at the right-hand end of the row.
   *
   * The approved design puts `18` beside Orders. It is a real number — the open
   * checks (or unbumped kitchen tickets) this business has right now, the same
   * figure the Overview's `Open orders` row shows — and it is resolved in
   * app/app/layout.tsx so the rail and the dashboard cannot disagree. Absent
   * rather than `0` when there is nothing waiting: a badge reading zero is a
   * badge that has stopped meaning anything.
   */
  badge?: number;
  children?: NavItem[];
};
export type NavSection = { key: string; label: string; items: NavItem[] };

function matchesHref(href: string, pathname: string): boolean {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(href + "/");
}

/** Every destination in the tree, parents and children alike. */
export function flattenNav(sections: NavSection[]): NavItem[] {
  const out: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push(item);
      for (const child of item.children ?? []) out.push(child);
    }
  }
  return out;
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  // Highlight only the single best (longest) matching destination, so a nested
  // route like /app/pos/sales lights "Tickets" — not also "POS" (a prefix).
  const activeHref = useMemo(
    () =>
      flattenNav(sections).reduce((best, it) => {
        if (!matchesHref(it.href, pathname)) return best;
        return it.href.length > best.length ? it.href : best;
      }, ""),
    [sections, pathname]
  );

  // The branch the current page lives in, so arriving on /app/waste finds Menu
  // already open with Waste lit rather than a collapsed rail that gives no clue
  // where you are.
  const activeBranch = useMemo(() => {
    for (const item of flattenNav(sections)) {
      if ((item.children ?? []).some((c) => c.href === activeHref)) return item.href;
    }
    return null;
  }, [sections, activeHref]);

  // Derived, not stored: an entry appears only once the viewer has overridden
  // the default for that branch, so navigating still re-opens the right one.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (href: string) => overrides[href] ?? href === activeBranch;
  const toggle = (href: string) =>
    setOverrides((prev) => ({ ...prev, [href]: !isOpen(href) }));

  return (
    // px-4 outside, px-3.5 inside each row. The two together put every icon's
    // left edge at 30px from the rail — which is exactly where the workspace
    // card's title sits, because that card is inset 16px and padded 14px. One
    // vertical line down the whole rail, for the price of picking the paddings
    // to agree rather than picking them separately.
    <nav className="flex-1 px-4 pb-4">
      {sections.map((section, si) => (
        <div key={section.key} className={si === 0 ? "" : "mt-5"}>
          {/* `WORKSPACE`. It used to render only when there was more than one
              group — i.e. never, since the rail collapsed to one list — and the
              approved design brings it back as a permanent micro-label over the
              list. 10px at 0.08em, and mb-4 because the design puts 16px of air
              between the label and the first row: a caption that sits tight
              against what it captions reads as the first item of the list. */}
          <p className="mb-4 px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = iconMap[item.href] ?? LayoutDashboard;
              const isActive = item.href === activeHref;
              const children = item.children ?? [];
              const expanded = children.length > 0 && isOpen(item.href);
              const panelId = "nav-" + item.href.replace(/\W+/g, "-");

              return (
                // No entrance animation — the full nav must paint on the first
                // frame (server-rendered), or it flashes an incomplete list.
                <div key={item.href}>
                  <div className="relative flex items-center">
                    <Link
                      href={item.href}
                      // h-11 = 44px, the design's row height, set as a real
                      // height rather than left to fall out of padding + line
                      // box: the badge and the 18px icon both change the row's
                      // natural height, and three rows of different heights in a
                      // list of seven is the kind of thing you see without being
                      // able to say what you are seeing.
                      className="group relative flex h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3.5 text-sm"
                      aria-current={isActive ? "page" : undefined}
                    >
                      {isActive && (
                        // ONE marker now, not two. There used to be a 3px bar in
                        // the gutter AND a tinted pill; the design draws a single
                        // pale blue rounded rectangle, and a bar outside it was
                        // a second encoding of the same fact — with nowhere to
                        // live, now that the rail's own padding is the gutter.
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-md bg-sidebar-accent"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span
                        className={`relative z-10 flex min-w-0 flex-1 items-center gap-3 transition-colors ${
                          isActive
                            ? "font-semibold text-sidebar-accent-foreground"
                            : "text-sidebar-muted group-hover:text-sidebar-foreground"
                        }`}
                      >
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                            isActive ? "text-sidebar-primary" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge != null && item.badge > 0 && (
                        // The design's `18` beside Orders: a small grey rounded
                        // rect, not a coloured dot. It is a quantity you glance
                        // at, not an alarm — the alarm for a ticket that has
                        // gone stale is a row in Needs attention, which says so
                        // in words and links to the screen that clears it.
                        <span className="relative z-10 ml-auto shrink-0 rounded-[5px] bg-sidebar-chip px-1.5 py-0.5 text-[12px] font-medium leading-4 tabular-nums text-sidebar-chip-foreground">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>

                    {/* The chevron is a SEPARATE control from the link, which is
                        the whole point of the pattern: the parent is a real page
                        (clicking "Reports" opens Reports) and expanding it to
                        reach Accounting is a different intent that must not
                        navigate you somewhere first. */}
                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggle(item.href)}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        aria-label={
                          (expanded ? "Collapse " : "Expand ") + item.label
                        }
                        className="relative z-10 mr-1 rounded-md p-1 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <ChevronRight
                          className={
                            "w-4 h-4 transition-transform duration-200 " +
                            (expanded ? "rotate-90" : "")
                          }
                          strokeWidth={2}
                        />
                      </button>
                    )}
                  </div>

                  {expanded && (
                    // Indented under the parent's LABEL, not its icon, and hung
                    // off a hairline so the group reads as one object while
                    // scrolling past it.
                    <div
                      id={panelId}
                      // 30 + 1 + 12 lands a child's label within a pixel of its
                      // parent's, now that the row's own inset is 14px.
                      className="mt-0.5 ml-[30px] space-y-0.5 border-l border-sidebar-border pl-3"
                    >
                      {children.map((child) => {
                        const childActive = child.href === activeHref;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            aria-current={childActive ? "page" : undefined}
                            className={
                              "block truncate rounded-md px-3 py-2 text-[13px] transition-colors " +
                              (childActive
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")
                            }
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
