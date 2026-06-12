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
  "/app/orders": ShoppingBag,
  "/app/catalog": Package,
  "/app/staff": UserCog,
  "/app/audit": ScrollText,
  "/app/reports": BarChart3,
  "/app/tips": Coins,
};

type NavItem = { href: string; label: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-2 space-y-0.5">
      {items.map((item, index) => {
        const Icon = iconMap[item.href] ?? LayoutDashboard;
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: index * 0.04,
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Link
              href={item.href}
              className="relative flex items-center gap-3 px-3 py-2 text-sm rounded-md group"
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
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-sidebar-primary" : ""
                  }`}
                  strokeWidth={2}
                />
                <span>{item.label}</span>
              </span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}