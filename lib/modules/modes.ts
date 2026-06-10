// lib/modules/modes.ts
// Square-style business modes shown in onboarding.
// A mode = an industry enum value (for the DB column) + a config object that
// drives the actual menu/labels via validateConfig + getPreset.
//
// SAFETY: every module key below is used by a live preset, so no broken nav.
// Transportation is intentionally NOT a public mode (Pearson only, kept hidden).

import type { ModuleKey } from "./registry";

export type ModeIndustry =
  | "transportation"
  | "restaurant"
  | "retail"
  | "service"
  | "mobile_seller";

export type ModeConfig = {
  modules: ModuleKey[];
  labels?: Partial<Record<ModuleKey, string>>;
};

export type BusinessMode = {
  key: string;
  label: string;
  tagline: string;
  icon: string;
  industry: ModeIndustry;
  status: "live" | "soon";
  config: ModeConfig;
};

export const BUSINESS_MODES: BusinessMode[] = [
  {
    key: "standard",
    label: "Standard",
    tagline: "A simple register for any business.",
    icon: "register",
    industry: "retail",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "catalog", "customers", "settings"],
      labels: { catalog: "Items" },
    },
  },
  {
    key: "retail",
    label: "Retail",
    tagline: "Shops and boutiques selling products.",
    icon: "bag",
    industry: "retail",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
      labels: { catalog: "Products" },
    },
  },
  {
    key: "quick_service",
    label: "Quick service",
    tagline: "Cafes, takeout, and counter service.",
    icon: "cup",
    industry: "restaurant",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "kitchen", "catalog", "customers", "staff", "settings"],
      labels: { catalog: "Menu" },
    },
  },
  {
    key: "full_service",
    label: "Full service",
    tagline: "Sit-down dining with a ticket per table.",
    icon: "utensils",
    industry: "restaurant",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "kitchen", "catalog", "customers", "staff", "settings"],
      labels: { catalog: "Menu", orders: "Tickets" },
    },
  },
  {
    key: "bar",
    label: "Bar",
    tagline: "Bars and pubs running open tabs.",
    icon: "glass",
    industry: "restaurant",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
      labels: { catalog: "Drinks", orders: "Tabs" },
    },
  },
  {
    key: "services",
    label: "Services",
    tagline: "Salons, spas, and personal services.",
    icon: "scissors",
    industry: "service",
    status: "live",
    config: {
      modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
      labels: { pos: "Checkout", orders: "Visits", catalog: "Services" },
    },
  },
  {
    key: "appointments",
    label: "Appointments",
    tagline: "Online booking and a calendar. Coming soon.",
    icon: "calendar",
    industry: "service",
    status: "soon",
    config: {
      modules: ["dashboard", "pos", "orders", "catalog", "customers", "staff", "settings"],
      labels: { pos: "Checkout", orders: "Appointments", catalog: "Services" },
    },
  },
];

// The stored mode key for a business, read from its config JSONB (or null).
export function getBusinessMode(
  business: { config?: { mode?: string } | null } | null | undefined
): string | null {
  const c = business?.config;
  if (c && typeof c === "object" && typeof c.mode === "string") return c.mode;
  return null;
}

// True only for full-service restaurants, which get the table-service floor.
// Every other mode (and the transportation register) is unaffected.
export function hasFloorService(
  business: { config?: { mode?: string } | null } | null | undefined
): boolean {
  return getBusinessMode(business) === "full_service";
}

// Friendly display label for a business: prefer its stored mode, otherwise a
// humanized industry (so older businesses like the transportation one still
// read nicely as "Transportation").
export function modeLabel(
  modeKey?: string | null,
  industry?: string | null
): string {
  if (modeKey) {
    const m = BUSINESS_MODES.find((x) => x.key === modeKey);
    if (m) return m.label;
  }
  if (industry) {
    const s = industry.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return "Workspace";
} 