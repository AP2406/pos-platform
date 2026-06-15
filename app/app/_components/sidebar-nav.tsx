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
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "/app": LayoutDashboard,
  "/app/trips": Car,
  "/app/customers": Users,
  "/app/partners": Handshake,
  "/app/vehicles": Car,
  "/app/settings": Settings,
  "/app/pos": CreditCard,
  "/app/pos/sales": ShoppingBag,
  "/app/catalog": Package,
  "/app/staff": UserCog,
  "/app/audit": ScrollText,
  "/app/reports": BarChart3,
  "/app/tips": Coins,
  "/app/clock": Clock,
  "/app/marketing": Mail,
  "/app/reservations": CalendarClock,
};

type NavItem = { href: string; label: string };

function matchesHref(href: string, pathname: string): boolean {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // Highlight only the single best (longest) matching item, so a nested route
  // like /app/pos/sales lights "Tickets" — not also "POS" (/app/pos is a prefix).
  const activeHref = items.reduce((best, it) => {
    if (!matchesHref(it.href, pathname)) return best;
    return it.href.length > best.length ? it.href : best;
  }, "");

  return (
    <nav className="flex-1 p-2 space-y-0.5">
      {items.map((item) => {
        const Icon = iconMap[item.href] ?? LayoutDashboard;
        const isActive = item.href === activeHref;

        return (
          // No entrance animation — the full nav must paint on the first frame
          // (server-rendered), or it flashes an incomplete list on every load.
          <div key={item.href}>
            <Link
              href={item.href}
              className="relative flex items-center gap-3 px-3 py-2.5 text-sm rounded-md group"
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
    </nav>
  );
}