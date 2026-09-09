"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Car,
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

type NavItem = { href: string; label: string };
export type NavSection = { key: string; label: string; items: NavItem[] };

function matchesHref(href: string, pathname: string): boolean {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  // Highlight only the single best (longest) matching item, so a nested route
  // like /app/pos/sales lights "Tickets" — not also "POS" (/app/pos is a prefix).
  const activeHref = sections
    .flatMap((s) => s.items)
    .reduce((best, it) => {
      if (!matchesHref(it.href, pathname)) return best;
      return it.href.length > best.length ? it.href : best;
    }, "");

  return (
    <nav className="flex-1 p-2 pb-4">
      {sections.map((section, si) => (
        <div key={section.key} className={si === 0 ? "" : "mt-5"}>
          {/* A heading only earns its space when there's more than one group. */}
          {sections.length > 1 && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/70">
              {section.label}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = iconMap[item.href] ?? LayoutDashboard;
              const isActive = item.href === activeHref;

              return (
                // No entrance animation — the full nav must paint on the first
                // frame (server-rendered), or it flashes an incomplete list.
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="relative flex items-center gap-3 px-3 py-2.5 text-sm rounded-md group"
                    aria-current={isActive ? "page" : undefined}
                  >
                    {isActive && (
                      <>
                        <motion.div
                          layoutId="sidebar-active-bar"
                          className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] bg-sidebar-primary"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 bg-sidebar-accent rounded-md"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      </>
                    )}
                    <span
                      className={`relative flex items-center gap-3 z-10 transition-colors ${
                        isActive
                          ? "text-sidebar-foreground font-medium"
                          : "text-sidebar-muted group-hover:text-sidebar-foreground"
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                          isActive ? "text-sidebar-primary" : ""
                        }`}
                        strokeWidth={2}
                      />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
